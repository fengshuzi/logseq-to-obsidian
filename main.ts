import { Plugin, PluginSettingTab, Setting, MarkdownRenderer, TFile, App, TFolder, MarkdownPostProcessorContext } from 'obsidian';
import { EditorView, Decoration, ViewPlugin, WidgetType, DecorationSet, ViewUpdate, Range } from '@codemirror/view';

declare const activeDocument: Document;

type TodoRenderMode = 'preserve' | 'render-as-task' | 'convert-to-checkbox';

interface LogseqFormaterSettings {
  todoRenderMode: TodoRenderMode;
}

const DEFAULT_SETTINGS: LogseqFormaterSettings = {
  todoRenderMode: 'render-as-task'
};

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const BLOCK_REF_REGEX = new RegExp(`\\((${UUID_PATTERN})\\)`, 'g');
const ID_LINE_REGEX = new RegExp(`^(.*?)\\s*id::\\s*(${UUID_PATTERN})\\s*$`);
const BLOCK_ANCHOR_REGEX = new RegExp(`^(.+?)\\s*\\^(${UUID_PATTERN})\\s*$`);
const ID_ONLY_LINE_REGEX = new RegExp(`^\\s*id::\\s*(${UUID_PATTERN})\\s*$`, 'i');
const BLOCK_ANCHOR_CONTENT_REGEX = new RegExp(`^(.+?)\\s*\\^(${UUID_PATTERN})\\s*$`, 'i');
const LOGBOOK_REGEX = /([ \t]*)- DONE (.+?)\s*\n([ \t]*:LOGBOOK:\s*\n((?:[ \t]*CLOCK: \[.*?\]--\[.*?\] =>\s*\d{2}:\d{2}:\d{2}\s*\n)+)[ \t]*:END:)/gms;
const CLOCK_REGEX = /=> *(\d{2}:\d{2}:\d{2})/g;
const TODO_STATUS_REGEX = /^\s*(TODO|DOING|DONE)\s+(.*)$/is;

function parseTimeToSeconds(t: string): number {
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  return `${Math.floor(seconds / 3600)}小时`;
}

function convertLogbook(content: string): string {
  return content.replace(LOGBOOK_REGEX, (_match: string, indent: string, taskText: string, _logbook: string, clockBlock: string) => {
    const times = clockBlock.match(CLOCK_REGEX) ?? [];
    const totalSeconds = times.reduce((sum: number, t: string) => sum + parseTimeToSeconds(t.replace(/=> */g, '')), 0);
    return `${indent}- DONE ${taskText.trim()} ${formatDuration(totalSeconds)}`;
  });
}

function convertTodosToCheckboxes(content: string): string {
  return content
    .replace(/([ \t]*)- TODO\b/gm, '$1- [ ]')
    .replace(/([ \t]*)- DOING\b/gm, '$1- [ ]')
    .replace(/([ \t]*)- DONE\b(.*)/gm, '$1- [x]$2');
}

class BlockRefWidget extends WidgetType {
  constructor(
    private plugin: LogseqFormater,
    private blockId: string
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = activeDocument.createElement('span');
    span.className = 'logseq-block-ref';
    this.plugin.populateBlockRef(span, this.blockId, '');
    return span;
  }

  eq(other: WidgetType): boolean {
    return other instanceof BlockRefWidget && other.blockId === this.blockId;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export default class LogseqFormater extends Plugin {
  settings: LogseqFormaterSettings;
  statusBarItem: HTMLElement;
  private blockContentCache = new Map<string, { result: { content: string; file: TFile } | null; timestamp: number }>();
  private readonly BLOCK_CACHE_TTL_MS = 3000;

  async onload() {
    console.debug('LogseqFormater plugin loaded - version 1.0.1');

    await this.loadSettings();

    this.addSettingTab(new LogseqFormaterSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          void this.convertSyntax(file);
        } else {
          console.debug(`[LogseqFormater] skip non-MD file: ${file ? file.path : 'null'}`);
        }
      })
    );

    this.registerMarkdownPostProcessor((element, context) => {
      this.renderBlockReferences(element, context);
      this.renderTodosAsTasks(element);
    });

    this.registerEditorExtension(this.createBlockRefExtension());

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('LogseqFormater: enabled');
    console.debug('LogseqFormater plugin initialized');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LogseqFormaterSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  createBlockRefExtension() {
    const plugin = this;

    return ViewPlugin.fromClass(class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const widgets: Range<Decoration>[] = [];
        const pattern = new RegExp(BLOCK_REF_REGEX.source, BLOCK_REF_REGEX.flags);

        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          let match: RegExpExecArray | null;

          while ((match = pattern.exec(text)) !== null) {
            const blockId = match[1];
            const start = from + match.index;
            const end = start + match[0].length;

            console.debug(`[LogseqFormater] live preview found block reference: ${blockId}`);

            widgets.push(
              Decoration.replace({
                widget: new BlockRefWidget(plugin, blockId),
                inclusive: false,
                block: false
              }).range(start, end)
            );
          }
        }

        return Decoration.set(widgets);
      }
    }, {
      decorations: (v: { decorations: DecorationSet }) => v.decorations
    });
  }

  async findBlockContent(blockId: string): Promise<{ content: string; file: TFile } | null> {
    const cached = this.blockContentCache.get(blockId);
    if (cached && Date.now() - cached.timestamp < this.BLOCK_CACHE_TTL_MS) {
      return cached.result;
    }

    const result = await this.searchBlockContent(blockId);
    this.blockContentCache.set(blockId, { result, timestamp: Date.now() });
    return result;
  }

  private async searchBlockContent(blockId: string): Promise<{ content: string; file: TFile } | null> {
    const searchPaths = ['journals', 'pages'];

    const searchFolder = async (folder: TFolder): Promise<{ content: string; file: TFile } | null> => {
      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === 'md') {
          const fileContent = await this.app.vault.read(child);
          const blockContent = this.extractBlockContent(fileContent, blockId);
          if (blockContent) {
            return { content: blockContent, file: child };
          }
        } else if (child instanceof TFolder) {
          const result = await searchFolder(child);
          if (result) return result;
        }
      }
      return null;
    };

    for (const path of searchPaths) {
      const folder = this.app.vault.getAbstractFileByPath(path);
      if (folder instanceof TFolder) {
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
      const idMatch = lines[i].match(ID_ONLY_LINE_REGEX);
      if (idMatch && idMatch[1] === blockId) {
        for (let j = i - 1; j >= 0; j--) {
          const line = lines[j].trim();
          if (line !== '') {
            return line;
          }
        }
      }

      const blockRefMatch = lines[i].match(BLOCK_ANCHOR_CONTENT_REGEX);
      if (blockRefMatch && blockRefMatch[2] === blockId) {
        return blockRefMatch[1].trim();
      }
    }

    return null;
  }

  populateBlockRef(container: HTMLElement, blockId: string, sourcePath: string): void {
    const refIcon = activeDocument.createElement('span');
    refIcon.textContent = '↗ ';
    refIcon.className = 'logseq-block-ref-icon';

    const contentSpan = activeDocument.createElement('span');
    contentSpan.textContent = '加载中...';

    void this.findBlockContent(blockId).then(async (result) => {
      if (result) {
        contentSpan.empty();
        await MarkdownRenderer.render(result.content, contentSpan, sourcePath, this);
        container.title = `块引用: ${blockId}`;
        console.debug(`[LogseqFormater] rendered block content: ${result.content} (file: ${result.file.basename})`);
      } else {
        contentSpan.textContent = `(({blockId}))`;
        contentSpan.className = 'logseq-block-ref-missing';
        container.title = '未找到块内容';
        console.debug(`[LogseqFormater] block content not found: ${blockId}`);
      }
    }).catch((err: unknown) => {
      console.error(`[LogseqFormater] failed to load block content: ${err}`);
      contentSpan.textContent = `(({blockId}))`;
      contentSpan.className = 'logseq-block-ref-missing';
    });
  }

  renderBlockReferences(element: HTMLElement, context: MarkdownPostProcessorContext): void {
    this.walkAndRenderBlockRefs(element, context.sourcePath);
  }

  private walkAndRenderBlockRefs(element: HTMLElement, sourcePath: string): void {
    const pattern = new RegExp(BLOCK_REF_REGEX.source, BLOCK_REF_REGEX.flags);

    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (!pattern.test(text)) {
          pattern.lastIndex = 0;
          return;
        }
        pattern.lastIndex = 0;

        const fragments: Node[] = [];
        let match: RegExpExecArray | null;
        let lastIndex = 0;

        while ((match = pattern.exec(text)) !== null) {
          const blockId = match[1];
          console.debug(`[LogseqFormater] processing block ID: ${blockId}`);

          if (match.index > lastIndex) {
            fragments.push(activeDocument.createTextNode(text.substring(lastIndex, match.index)));
          }

          const blockRefEl = activeDocument.createElement('span');
          blockRefEl.className = 'logseq-block-ref';
          this.populateBlockRef(blockRefEl, blockId, sourcePath);

          fragments.push(blockRefEl);
          lastIndex = pattern.lastIndex;
        }

        if (lastIndex < text.length) {
          fragments.push(activeDocument.createTextNode(text.substring(lastIndex)));
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
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.classList.contains('logseq-block-ref')) {
          return;
        }
        Array.from(node.childNodes).forEach(child => processNode(child));
      }
    };

    processNode(element);
  }

  async convertSyntax(file: TFile) {
    const content = await this.app.vault.read(file);
    let newContent = content;

    const linesForIdProcessing = newContent.split('\n');
    const updatedLines: string[] = [];
    const skipIndices = new Set<number>();

    for (let i = 0; i < linesForIdProcessing.length; i++) {
      const match = ID_LINE_REGEX.exec(linesForIdProcessing[i]);
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
                if (k > j && skipIndices.has(k)) {
                  skipIndices.delete(k);
                  skipIndices.add(k + 2);
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

    const linesForExistingBlocks = newContent.split('\n');
    for (let i = 0; i < linesForExistingBlocks.length; i++) {
      const blockMatch = linesForExistingBlocks[i].match(BLOCK_ANCHOR_REGEX);
      if (blockMatch && i + 1 < linesForExistingBlocks.length && linesForExistingBlocks[i + 1].trim() !== '') {
        linesForExistingBlocks.splice(i + 1, 0, '', '');
        i += 2;
      }
    }
    newContent = linesForExistingBlocks.join('\n');

    newContent = convertLogbook(newContent);

    if (this.settings.todoRenderMode === 'convert-to-checkbox') {
      newContent = convertTodosToCheckboxes(newContent);
    }

    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
    }
  }

  renderTodosAsTasks(element: HTMLElement) {
    if (this.settings.todoRenderMode !== 'render-as-task') {
      return;
    }

    element.querySelectorAll('li').forEach((item) => {
      if (item.closest('pre, code') || item.classList.contains('logseq-formater-task')) {
        return;
      }

      const text = item.textContent || '';
      const match = text.match(TODO_STATUS_REGEX);
      if (!match) {
        return;
      }

      const status = match[1].toUpperCase() as 'TODO' | 'DOING' | 'DONE';
      const prefixPattern = new RegExp(`^\\s*${status}\\s+`, 'i');
      const originalChildren = Array.from(item.childNodes);

      item.empty();
      item.addClass('logseq-formater-task', `logseq-formater-task-${status.toLowerCase()}`);

      const checkbox = item.createEl('input', {
        type: 'checkbox',
        cls: 'logseq-formater-task-checkbox task-list-item-checkbox'
      });
      checkbox.checked = status === 'DONE';
      checkbox.disabled = true;

      if (status === 'DOING') {
        item.createEl('span', {
          cls: 'logseq-formater-task-status logseq-formater-status-doing',
          text: status
        });
      }

      const contentSpan = item.createEl('span', { cls: 'logseq-formater-task-content' });
      let prefixRemoved = false;
      originalChildren.forEach((child) => {
        if (!prefixRemoved && child.nodeType === Node.TEXT_NODE) {
          const childText = child.textContent || '';
          const remaining = childText.replace(prefixPattern, '');
          if (remaining !== childText) {
            prefixRemoved = true;
            if (remaining) {
              contentSpan.appendChild(activeDocument.createTextNode(remaining));
            }
            return;
          }
        }
        contentSpan.appendChild(child);
      });
    });
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
      .setName('TODO 渲染方式')
      .setDesc('选择 Logseq 的 TODO/DOING/DONE 在 Obsidian 中的显示方式。')
      .addDropdown(dropdown => dropdown
        .addOption('preserve', '保留原样（TODO / DOING / DONE）')
        .addOption('render-as-task', '渲染为任务（推荐，不改笔记原文）')
        .addOption('convert-to-checkbox', '转换为标准 Markdown 复选框（会修改笔记原文）')
        .setValue(this.plugin.settings.todoRenderMode)
        .onChange(async (value) => {
          this.plugin.settings.todoRenderMode = value as TodoRenderMode;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('☕ Buy me a coffee')
      .setHeading();

    const donateSection = containerEl.createDiv({ cls: 'plugin-donate-section' });
    donateSection.createEl('p', { text: 'If this plugin helped you, consider buying me a coffee ☕', cls: 'plugin-donate-desc' });
    const imgWrap = donateSection.createDiv({ cls: 'plugin-donate-qr' });
    imgWrap.createEl('img', { attr: { src: 'https://raw.githubusercontent.com/fengshuzi/images/main/wechat-donate.jpg', alt: '微信打赏', width: '160' } });
    imgWrap.createEl('p', { text: '微信扫码', cls: 'plugin-donate-label' });
  }
}
