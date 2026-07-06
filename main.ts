import { Plugin, PluginSettingTab, Setting, MarkdownRenderer, TFile, App } from 'obsidian';
import { EditorView, Decoration, ViewPlugin, WidgetType } from '@codemirror/view';

interface LogseqFormaterSettings {
  convertTodoToCheckbox: boolean;
}

const DEFAULT_SETTINGS: LogseqFormaterSettings = {
  convertTodoToCheckbox: false
};

export default class LogseqFormater extends Plugin {
  settings: LogseqFormaterSettings;
  statusBarItem: HTMLElement;

  async onload() {
    console.debug('LogseqFormater plugin loaded - version 0.2.2');

    await this.loadSettings();

    this.addSettingTab(new LogseqFormaterSettingTab(this.app, this));
    
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          this.convertSyntax(file);
        } else {
          console.debug(`[LogseqFormater] skip non-MD file: ${file ? file.path : 'null'}`);
        }
      })
    );
    
    this.registerMarkdownPostProcessor((element, context) => {
      this.renderBlockReferences(element, context);
    });
    
    this.registerEditorExtension(this.createBlockRefExtension());
    
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('LogseqFormater: enabled');
    console.debug('LogseqFormater plugin initialized');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  createBlockRefExtension() {
    const plugin = this;
    
    class BlockRefWidget extends WidgetType {
      blockId: string;

      constructor(blockId: string) {
        super();
        this.blockId = blockId;
      }
      
      toDOM() {
        const span = document.createElement('span');
        span.className = 'logseq-block-ref';
        span.style.cssText = 'display: inline;';
        
        const refIcon = document.createElement('span');
        refIcon.textContent = '↗ ';
        refIcon.style.cssText = 'opacity: 0.5; font-size: 0.9em;';
        span.appendChild(refIcon);
        
        const contentSpan = document.createElement('span');
        contentSpan.textContent = '加载中...';
        span.appendChild(contentSpan);
        
        plugin.findBlockContent(this.blockId).then(async (result) => {
          if (result) {
            contentSpan.empty();
            await MarkdownRenderer.renderMarkdown(
              result.content,
              contentSpan,
              '',
              plugin
            );
            span.title = `块引用: ${this.blockId}`;
            console.debug(`[LogseqFormater] live preview rendered block content: ${result.content} (file: ${result.file.basename})`);
          } else {
            contentSpan.textContent = `((${this.blockId}))`;
            contentSpan.style.color = 'var(--text-error)';
            span.title = '未找到块内容';
            console.debug(`[LogseqFormater] live preview block not found: ${this.blockId}`);
          }
        }).catch(err => {
          console.error(`[LogseqFormater] live preview load failed: ${err}`);
          contentSpan.textContent = `((${this.blockId}))`;
          contentSpan.style.color = 'var(--text-error)';
        });
        
        return span;
      }
      
      ignoreEvent() {
        return false;
      }
    }
    
    return ViewPlugin.fromClass(class {
      decorations: any;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }
      
      update(update: any) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }
      
      buildDecorations(view: EditorView) {
        const widgets = [];
        const blockRefPattern = /\(\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\)/g;
        
        for (let { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          let match;
          
          while ((match = blockRefPattern.exec(text)) !== null) {
            const blockId = match[1];
            const start = from + match.index;
            const end = start + match[0].length;
            
            console.debug(`[LogseqFormater] live preview found block reference: ${blockId}`);
            
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

  async findBlockContent(blockId: string): Promise<{ content: string; file: TFile } | null> {
    const searchPaths = ['journals', 'pages'];
    
    const searchFolder = async (folder: any): Promise<{ content: string; file: TFile } | null> => {
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
  
  extractBlockContent(fileContent: string, blockId: string): string | null {
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
      
      const blockRefMatch = lines[i].match(/^(.+?)\s*\^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i);
      if (blockRefMatch && blockRefMatch[2] === blockId) {
        return blockRefMatch[1].trim();
      }
    }
    
    return null;
  }
  
  async renderBlockReferences(element: HTMLElement, context: any) {
    const blockRefPattern = /\(\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\)/g;
    
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (blockRefPattern.test(text)) {
          console.debug(`[LogseqFormater] found block reference: ${text}`);
          blockRefPattern.lastIndex = 0;

          let match;
          let lastIndex = 0;
          const fragments: Node[] = [];

          while ((match = blockRefPattern.exec(text)) !== null) {
            const blockId = match[1];
            console.debug(`[LogseqFormater] processing block ID: ${blockId}`);
            
            if (match.index > lastIndex) {
              fragments.push(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            
            const blockRefEl = document.createElement('span');
            blockRefEl.className = 'logseq-block-ref';
            blockRefEl.style.cssText = 'display: inline;';
            
            const refIcon = document.createElement('span');
            refIcon.textContent = '↗ ';
            refIcon.style.cssText = 'opacity: 0.5; font-size: 0.9em;';
            blockRefEl.appendChild(refIcon);
            
            const contentSpan = document.createElement('span');
            contentSpan.textContent = '加载中...';
            blockRefEl.appendChild(contentSpan);
            
            this.findBlockContent(blockId).then(async (result) => {
              if (result) {
                contentSpan.empty();
                await MarkdownRenderer.renderMarkdown(
                  result.content,
                  contentSpan,
                  context.sourcePath,
                  this
                );
                blockRefEl.title = `块引用: ${blockId}`;
                console.debug(`[LogseqFormater] rendered block content: ${result.content} (file: ${result.file.basename})`);
              } else {
                contentSpan.textContent = `((${blockId}))`;
                contentSpan.style.color = 'var(--text-error)';
                blockRefEl.title = '未找到块内容';
                console.debug(`[LogseqFormater] block content not found: ${blockId}`);
              }
            }).catch(err => {
              console.error(`[LogseqFormater] failed to load block content: ${err}`);
              contentSpan.textContent = `((${blockId}))`;
              contentSpan.style.color = 'var(--text-error)';
            });
            
            fragments.push(blockRefEl);
            lastIndex = blockRefPattern.lastIndex;
          }
          
          if (lastIndex < text.length) {
            fragments.push(document.createTextNode(text.substring(lastIndex)));
          }
          
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
        const el = node as HTMLElement;
        if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.classList?.contains('logseq-block-ref')) {
          return;
        }
        const children = Array.from(node.childNodes);
        children.forEach(child => processNode(child));
      }
    };
    
    processNode(element);
  }

  async convertSyntax(file: TFile) {
    const content = await this.app.vault.read(file);
    let newContent = content;
    
    const timeStrToSeconds = function(t: string): number {
      const [h, m, s] = t.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    };

    const formatDuration = function(seconds: number): string {
      if (seconds < 60) return `${seconds}秒`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
      return `${Math.floor(seconds / 3600)}小时`;
    };

    let linesForIdProcessing = newContent.split('\n');
    let updatedLines: string[] = [];
    let skipIndices = new Set<number>();
    
    const idLinePattern = /^(.*?)\s*id::\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/;
    
    for (let i = 0; i < linesForIdProcessing.length; i++) {
      const match = idLinePattern.exec(linesForIdProcessing[i]);
      if (match) {
        const blockId = match[2];
        for (let j = i - 1; j >= 0; j--) {
          if (linesForIdProcessing[j].trim() !== '' && !linesForIdProcessing[j].includes('id::')) {
            const blockLine = linesForIdProcessing[j];
            const leadingSpaces = blockLine.match(/^\s*/)?.[0] || '';
            const contentAfterSpaces = blockLine.substring(leadingSpaces.length);
            linesForIdProcessing[j] = leadingSpaces + contentAfterSpaces.trim() + ` ^${blockId}`;
            
            let needsEmptyLineAfterBlock = false;
            let firstContentLineIndex = -1;
            for (let k = i + 1; k < linesForIdProcessing.length && !skipIndices.has(k); k++) {
              const lineAfterIdLine = linesForIdProcessing[k];
              if (lineAfterIdLine.trim() !== '') {
                needsEmptyLineAfterBlock = true;
                firstContentLineIndex = k;
                linesForIdProcessing[firstContentLineIndex] = lineAfterIdLine.trim();
                break;
              }
            }
            
            if (needsEmptyLineAfterBlock) {
              linesForIdProcessing.splice(j + 1, 0, '', '');
              for (let k = 0; k < linesForIdProcessing.length; k++) {
                if (k > j) {
                  if (skipIndices.has(k)) {
                    skipIndices.delete(k);
                    skipIndices.add(k + 2);
                  }
                }
              }
              i += 2;
            }
            
            skipIndices.add(i);
            break;
          }
        }
      }
    }
    
    for (let i = 0; i < linesForIdProcessing.length; i++) {
      if (!skipIndices.has(i)) {
        updatedLines.push(linesForIdProcessing[i]);
      }
    }
    
    newContent = updatedLines.join('\n');
    
    let linesForExistingBlocks = newContent.split('\n');
    for (let i = 0; i < linesForExistingBlocks.length; i++) {
      const line = linesForExistingBlocks[i];
      const blockMatch = line.match(/^(.+?)\s*\^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/);
      if (blockMatch) {
        if (i + 1 < linesForExistingBlocks.length) {
          const nextLine = linesForExistingBlocks[i + 1];
          if (nextLine.trim() !== '') {
            linesForExistingBlocks.splice(i + 1, 0, '', '');
            i += 2;
          }
        }
      }
    }
    newContent = linesForExistingBlocks.join('\n');
    
    newContent = newContent.replace(
      /([ \t]*)- DONE (.+?)\s*\n([ \t]*:LOGBOOK:\s*\n((?:[ \t]*CLOCK: \[.*?\]--\[.*?\] =>\s*\d{2}:\d{2}:\d{2}\s*\n)+)[ \t]*:END:)/gms,
      (match, indent, taskText, logbook, clockBlock) => {
        const times = clockBlock.match(/=> *(\d{2}:\d{2}:\d{2})/g) || [];
        const totalSeconds = times.reduce((sum: number, t: string) => sum + timeStrToSeconds(t.replace(/=> */g, '')), 0);
        const durationStr = formatDuration(totalSeconds);
        return `${indent}- DONE ${taskText.trim()} ${durationStr}`;
      }
    );

    if (this.settings.convertTodoToCheckbox) {
      newContent = newContent.replace(/([ \t]*)- TODO\b/gm, '$1- [ ]');
      newContent = newContent.replace(/([ \t]*)- DOING\b/gm, '$1- [ ]');
      newContent = newContent.replace(/([ \t]*)- DONE\b(.*)/gm, '$1- [x]$2');
    }

    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
    }
  }
}

class LogseqFormaterSettingTab extends PluginSettingTab {
  plugin: LogseqFormater;

  constructor(app: App, plugin: LogseqFormater) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('转换 TODO 为复选框')
      .setDesc('启用后，将 Logseq 的 TODO/DOING/DONE 转换为 Markdown 的 [ ] 和 [x] 复选框。禁用后保持 Logseq 原格式。')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.convertTodoToCheckbox)
        .onChange(async (value) => {
          this.plugin.settings.convertTodoToCheckbox = value;
          await this.plugin.saveSettings();
        }));

    const donateSection = containerEl.createDiv({ cls: 'plugin-donate-section' });
    donateSection.createEl('h3', { text: '☕ 请作者喝杯咖啡' });
    donateSection.createEl('p', { text: '如果这个插件帮助了你，欢迎请作者喝杯咖啡 ☕', cls: 'plugin-donate-desc' });
    const imgWrap = donateSection.createDiv({ cls: 'plugin-donate-qr' });
    imgWrap.createEl('img', { attr: { src: "https://raw.githubusercontent.com/fengshuzi/images/main/wechat-donate.jpg", alt: '微信打赏', width: '160' } });
    imgWrap.createEl('p', { text: '微信扫码', cls: 'plugin-donate-label' });
  }
}
