// 从 Obsidian 的 API 导入 Plugin 类和设置相关类
const { Plugin, PluginSettingTab, Setting, MarkdownRenderer } = require('obsidian');
const { EditorView, Decoration, ViewPlugin, WidgetType } = require('@codemirror/view');

// 默认设置
const DEFAULT_SETTINGS = {
  convertTodoToCheckbox: false  // 默认不转换 TODO 为复选框
};

// 导出插件类
module.exports = class LogseqToObsidian extends Plugin {
  // onload 方法在插件加载时被调用
  async onload() {
    console.log('LogseqToObsidian 插件已加载 - 版本 0.2.2');
    
    // 加载设置
    await this.loadSettings();
    
    // 添加设置选项卡
    this.addSettingTab(new LogseqToObsidianSettingTab(this.app, this));
    
    // 注册文件打开事件监听器
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        // 检查打开的文件是否是 Markdown 文件
        if (file && file.extension === 'md') {
          // 调用转换函数
          this.convertSyntax(file);
        } else {
          console.log(`[LogseqToObsidian] 跳过非MD文件: ${file ? file.path : 'null'}`);
        }
      })
    );
    
    // 注册 Markdown 后处理器来渲染块引用（阅读模式）
    this.registerMarkdownPostProcessor((element, context) => {
      this.renderBlockReferences(element, context);
    });
    
    // 注册编辑器扩展来渲染块引用（实时预览模式）
    this.registerEditorExtension(this.createBlockRefExtension());
    
    // 添加状态栏项目
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('LogseqToObsidian: 已启用');
    console.log('LogseqToObsidian 插件初始化完成');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // 创建 CodeMirror 扩展用于实时预览模式
  createBlockRefExtension() {
    const plugin = this;
    
    // 创建块引用 Widget
    class BlockRefWidget extends WidgetType {
      constructor(blockId) {
        super();
        this.blockId = blockId;
      }
      
      toDOM() {
        const span = document.createElement('span');
        span.className = 'logseq-block-ref';
        span.style.cssText = 'display: inline;';
        
        // 添加引用标识
        const refIcon = document.createElement('span');
        refIcon.textContent = '↗ ';
        refIcon.style.cssText = 'opacity: 0.5; font-size: 0.9em;';
        span.appendChild(refIcon);
        
        const contentSpan = document.createElement('span');
        contentSpan.textContent = '加载中...';
        span.appendChild(contentSpan);
        
        // 异步加载并渲染块内容
        plugin.findBlockContent(this.blockId).then(async (result) => {
          if (result) {
            // 清空内容容器
            contentSpan.empty();
            // 渲染块内容
            const { MarkdownRenderer } = require('obsidian');
            await MarkdownRenderer.renderMarkdown(
              result.content,
              contentSpan,
              '',
              plugin
            );
            span.title = `块引用: ${this.blockId}`;
            console.log(`[LogseqToObsidian] 实时预览渲染块内容: ${result.content} (文件: ${result.file.basename})`);
          } else {
            contentSpan.textContent = `((${this.blockId}))`;
            contentSpan.style.color = 'var(--text-error)';
            span.title = '未找到块内容';
            console.log(`[LogseqToObsidian] 实时预览未找到块: ${this.blockId}`);
          }
        }).catch(err => {
          console.error(`[LogseqToObsidian] 实时预览加载失败: ${err}`);
          contentSpan.textContent = `((${this.blockId}))`;
          contentSpan.style.color = 'var(--text-error)';
        });
        
        return span;
      }
      
      // 忽略事件，让光标可以正常移动
      ignoreEvent() {
        return false;
      }
    }
    
    // 创建 ViewPlugin
    return ViewPlugin.fromClass(class {
      constructor(view) {
        this.decorations = this.buildDecorations(view);
      }
      
      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }
      
      buildDecorations(view) {
        const widgets = [];
        const blockRefPattern = /\(\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\)/g;
        
        for (let { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          let match;
          
          while ((match = blockRefPattern.exec(text)) !== null) {
            const blockId = match[1];
            const start = from + match.index;
            const end = start + match[0].length;
            
            console.log(`[LogseqToObsidian] 实时预览找到块引用: ${blockId}`);
            
            // 使用 replace 装饰器替换整个 ((blockId))，不添加额外空行
            widgets.push(
              Decoration.replace({
                widget: new BlockRefWidget(blockId),
                inclusive: false,
                block: false
              }).range(start, end)
            );
          }
        }
        
        return Decoration.set(widgets);
      }
    }, {
      decorations: v => v.decorations
    });
  }

  // 查找包含指定 ID 的块内容（用于渲染）
  async findBlockContent(blockId) {
    const searchPaths = ['journals', 'pages'];
    
    const searchFolder = async (folder) => {
      if (!folder || !folder.children) return null;
      
      for (const child of folder.children) {
        if (child.extension === 'md') {
          const fileContent = await this.app.vault.read(child);
          const blockContent = this.extractBlockContent(fileContent, blockId);
          if (blockContent) {
            return { content: blockContent, file: child };
          }
        } else if (child.children) {
          const result = await searchFolder(child);
          if (result) return result;
        }
      }
      return null;
    };
    
    for (const path of searchPaths) {
      const folder = this.app.vault.getAbstractFileByPath(path);
      if (folder) {
        const result = await searchFolder(folder);
        if (result) return result;
      }
    }
    
    const allFiles = this.app.vault.getMarkdownFiles();
    for (const mdFile of allFiles) {
      if (searchPaths.some(path => mdFile.path.startsWith(path))) continue;
      
      const fileContent = await this.app.vault.read(mdFile);
      const blockContent = this.extractBlockContent(fileContent, blockId);
      if (blockContent) {
        return { content: blockContent, file: mdFile };
      }
    }
    
    return null;
  }
  
  // 从文件内容中提取指定 ID 的块内容
  extractBlockContent(fileContent, blockId) {
    const lines = fileContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const idMatch = lines[i].match(/^\s*id::\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i);
      if (idMatch && idMatch[1] === blockId) {
        for (let j = i - 1; j >= 0; j--) {
          const line = lines[j].trim();
          if (line !== '') {
            return line;
          }
        }
      }
      
      const obsidianMatch = lines[i].match(/^(.+?)\s*\^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i);
      if (obsidianMatch && obsidianMatch[2] === blockId) {
        return obsidianMatch[1].trim();
      }
    }
    
    return null;
  }
  
  // 渲染块引用（在预览模式下，不修改源文件）
  async renderBlockReferences(element, context) {
    // 查找所有包含 ((blockId)) 的文本节点
    const blockRefPattern = /\(\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\)/g;
    
    // 递归处理所有文本节点
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (blockRefPattern.test(text)) {
          console.log(`[LogseqToObsidian] 找到块引用: ${text}`);
          // 重置正则表达式
          blockRefPattern.lastIndex = 0;
          
          let match;
          let lastIndex = 0;
          const fragments = [];
          
          while ((match = blockRefPattern.exec(text)) !== null) {
            const blockId = match[1];
            console.log(`[LogseqToObsidian] 处理块ID: ${blockId}`);
            
            // 添加匹配前的文本
            if (match.index > lastIndex) {
              fragments.push(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            
            // 创建块引用容器
            const blockRefEl = document.createElement('span');
            blockRefEl.className = 'logseq-block-ref';
            blockRefEl.style.cssText = 'display: inline;';
            
            // 添加引用标识
            const refIcon = document.createElement('span');
            refIcon.textContent = '↗ ';
            refIcon.style.cssText = 'opacity: 0.5; font-size: 0.9em;';
            blockRefEl.appendChild(refIcon);
            
            const contentSpan = document.createElement('span');
            contentSpan.textContent = '加载中...';
            blockRefEl.appendChild(contentSpan);
            
            // 异步加载并渲染块内容
            this.findBlockContent(blockId).then(async (result) => {
              if (result) {
                // 清空内容容器
                contentSpan.empty();
                // 渲染块内容
                await MarkdownRenderer.renderMarkdown(
                  result.content,
                  contentSpan,
                  context.sourcePath,
                  this
                );
                blockRefEl.title = `块引用: ${blockId}`;
                console.log(`[LogseqToObsidian] 成功渲染块内容: ${result.content} (文件: ${result.file.basename})`);
              } else {
                contentSpan.textContent = `((${blockId}))`;
                contentSpan.style.color = 'var(--text-error)';
                blockRefEl.title = '未找到块内容';
                console.log(`[LogseqToObsidian] 未找到块内容: ${blockId}`);
              }
            }).catch(err => {
              console.error(`[LogseqToObsidian] 加载块内容失败: ${err}`);
              contentSpan.textContent = `((${blockId}))`;
              contentSpan.style.color = 'var(--text-error)';
            });
            
            fragments.push(blockRefEl);
            lastIndex = blockRefPattern.lastIndex;
          }
          
          // 添加剩余文本
          if (lastIndex < text.length) {
            fragments.push(document.createTextNode(text.substring(lastIndex)));
          }
          
          // 替换原节点
          if (fragments.length > 0) {
            const parent = node.parentNode;
            if (parent) {
              fragments.forEach(fragment => {
                parent.insertBefore(fragment, node);
              });
              parent.removeChild(node);
            }
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // 跳过代码块和已处理的块引用
        if (node.tagName === 'CODE' || node.tagName === 'PRE' || node.classList?.contains('logseq-block-ref')) {
          return;
        }
        // 递归处理子节点（需要复制数组，因为我们会修改DOM）
        const children = Array.from(node.childNodes);
        children.forEach(child => processNode(child));
      }
    };
    
    processNode(element);
  }

  
  // 将 Logseq 语法转换为 Obsidian 语法的函数
  async convertSyntax(file) {
    // 读取文件内容
    const content = await this.app.vault.read(file);
    let newContent = content;
    
    // 注意：块引用 ((id)) 现在通过 renderBlockReferences 在预览时渲染，不再修改源文件
    
    // 辅助函数：将时间字符串 'hh:mm:ss' 转换为秒
    const timeStrToSeconds = function(t) {
      const [h, m, s] = t.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    };

    // 辅助函数：将总秒数格式化为可读的持续时间字符串
    const formatDuration = function(seconds) {
      if (seconds < 60) return `${seconds}秒`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
      return `${Math.floor(seconds / 3600)}小时`;
    };

    // 处理文件中的id::行，将^blockId追加到对应块的末尾并删除id::行
    const idLinePattern = /^(.*?)\s*id::\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/gm;
    
    // 同时处理已存在的块引用格式，确保它们后面有空行分离
    const existingBlockPattern = /^(.+?)\s*\^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/gm;
    // 重新分割内容为行数组，避免变量重复声明
    let linesForIdProcessing = newContent.split('\n');
    let updatedLines = [];
    let skipIndices = new Set();
    
    // 查找所有id::行及其所属的块
     for (let i = 0; i < linesForIdProcessing.length; i++) {
       const match = idLinePattern.exec(linesForIdProcessing[i]);
       if (match) {
         const blockId = match[2];
         // 向上查找所属的块（非空行且不是id::行）
         for (let j = i - 1; j >= 0; j--) {
           if (linesForIdProcessing[j].trim() !== '' && !linesForIdProcessing[j].includes('id::')) {
             // 将^blockId追加到块的末尾，保留原有缩进
             const blockLine = linesForIdProcessing[j];
             const leadingSpaces = blockLine.match(/^\s*/)[0];
             const contentAfterSpaces = blockLine.substring(leadingSpaces.length);
             linesForIdProcessing[j] = leadingSpaces + contentAfterSpaces.trim() + ` ^${blockId}`;
             
             // 检查并确保块引用后有空行，以防止引用包含后续内容
             // 遍历id::行下面的所有行，找到第一个有内容的行
             let needsEmptyLineAfterBlock = false;
             let firstContentLineIndex = -1;
             for (let k = i + 1; k < linesForIdProcessing.length && !skipIndices.has(k); k++) {
               const lineAfterIdLine = linesForIdProcessing[k];
               // 找到第一个有内容的行（不是空行）
               if (lineAfterIdLine.trim() !== '') {
                 needsEmptyLineAfterBlock = true;
                 firstContentLineIndex = k;
                 // 去掉这一行的前导空格
                 linesForIdProcessing[firstContentLineIndex] = lineAfterIdLine.trim();
                 break;
               }
             }
             
             if (needsEmptyLineAfterBlock) {
               // 在块引用行后插入两行空行
               linesForIdProcessing.splice(j + 1, 0, '', '');
               // 调整后续行的索引
                for (let k = 0; k < linesForIdProcessing.length; k++) {
                  if (k > j) {
                    // 更新skipIndices中的索引
                    if (skipIndices.has(k)) {
                      skipIndices.delete(k);
                      skipIndices.add(k + 2);
                    }
                  }
                }
                i += 2;
              }
              
              // 删除id::行
              skipIndices.add(i);
              break;
            }
          }
        }
      }
      
      // 构建新内容，跳过id::行
      for (let i = 0; i < linesForIdProcessing.length; i++) {
        if (!skipIndices.has(i)) {
          updatedLines.push(linesForIdProcessing[i]);
        }
      }
      
      newContent = updatedLines.join('\n');
      
    // 处理已存在的块引用，确保它们后面有空行分离
    let linesForExistingBlocks = newContent.split('\n');
    for (let i = 0; i < linesForExistingBlocks.length; i++) {
      const line = linesForExistingBlocks[i];
      const blockMatch = line.match(/^(.+?)\s*\^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/);
      if (blockMatch) {
        // 检查下一行是否为空行，如果不是且有内容，则插入空行
        if (i + 1 < linesForExistingBlocks.length) {
          const nextLine = linesForExistingBlocks[i + 1];
          if (nextLine.trim() !== '') {
            // 在块引用后插入两行空行
            linesForExistingBlocks.splice(i + 1, 0, '', '');
            i += 2; // 跳过新插入的两行空行
          }
        }
      }
    }
    newContent = linesForExistingBlocks.join('\n');
      
    // 处理 DONE 任务的 LOGBOOK 部分：计算总时间并附加到任务
    const originalContent = newContent;
    newContent = newContent.replace(
      /([ \t]*)- DONE (.+?)\s*\n([ \t]*:LOGBOOK:\s*\n((?:[ \t]*CLOCK: \[.*?\]--\[.*?\] =>\s*\d{2}:\d{2}:\d{2}\s*\n)+)[ \t]*:END:)/gms,
      (match, indent, taskText, logbook, clockBlock) => {
        // 从 CLOCK 行中提取所有持续时间字符串
        const times = clockBlock.match(/=> *(\d{2}:\d{2}:\d{2})/g) || [];
        // 通过求和所有持续时间计算总秒数
        const totalSeconds = times.reduce((sum, t) => sum + timeStrToSeconds(t.replace(/=> */g, '')), 0);
        // 格式化总持续时间
        const durationStr = formatDuration(totalSeconds);
        // 返回修改后的任务行，包含持续时间，并移除 LOGBOOK
        return `${indent}- DONE ${taskText.trim()} ${durationStr}`;
      }
    );

    // TODO 和 DOING 变为未选中复选框（仅在启用时）
    if (this.settings.convertTodoToCheckbox) {
      newContent = newContent.replace(/([ \t]*)- TODO\b/gm, '$1- [ ]');
      newContent = newContent.replace(/([ \t]*)- DOING\b/gm, '$1- [ ]');
      // DONE 变为选中复选框，保留任何附加文本（如持续时间）
      newContent = newContent.replace(/([ \t]*)- DONE\b(.*)/gm, '$1- [x]$2');
    }

    // 如果内容已更改，将新内容保存回文件
    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
      // 记录转换以进行调试
    } 
  }
}


// 设置选项卡类
class LogseqToObsidianSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Logseq to Obsidian 转换设置' });

    new Setting(containerEl)
      .setName('转换 TODO 为复选框')
      .setDesc('启用后，将 Logseq 的 TODO/DOING/DONE 转换为 Obsidian 的 [ ] 和 [x] 复选框。禁用后保持 Logseq 原格式。')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.convertTodoToCheckbox)
        .onChange(async (value) => {
          this.plugin.settings.convertTodoToCheckbox = value;
          await this.plugin.saveSettings();
        }));
  }
}
