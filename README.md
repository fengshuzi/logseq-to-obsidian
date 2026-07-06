# Logseq Formater

自动将 Logseq 语法转换为 Markdown 的插件。

## 功能特点

- 🔄 **自动转换**：打开 MD 文件时自动转换 Logseq 语法
- 📝 **块引用渲染**：将 Logseq 的 `((block-id))` 渲染为内联块内容预览
- 🆔 **块 ID 转换**：将 Logseq 的 `id:: block-id` 转换为 Obsidian 的 `^block-id`
- ⏱️ **LOGBOOK 汇总**：把 `:LOGBOOK:` 下的 `CLOCK` 时长汇总追加到 `DONE` 任务后
- ✅ **TODO 渲染**：支持保留原样 / 渲染为任务 / 转换为 Markdown 复选框三种模式
- ⚡ **无缝集成**：后台自动运行，无需手动操作

## 安装方法

### 方式一：Obsidian 社区市场安装（推荐）

打开 Obsidian 设置 → 第三方插件 → 浏览，搜索 **Logseq Formater** 或 **fengshuzi** 即可安装。


### 方式二：从 GitHub Release 安装（推荐）

1. 前往 [Releases](../../releases) 页面下载最新版本
2. 下载以下文件：
   - `main.js`
   - `manifest.json`
3. 在你的 Obsidian 库中创建插件目录：`.obsidian/plugins/logseq-formater/`
4. 将下载的文件复制到该目录
5. 重启 Obsidian 或刷新插件列表
6. 在设置中启用"Logseq Formater"插件

### 方式三：手动安装

```bash
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/fengshuzi/logseq-formater.git
cd logseq-formater
npm install
npm run build
```

## 使用方法

启用插件后，打开任何包含 Logseq 语法的 MD 文件，插件会自动进行转换。

### TODO 渲染方式

在插件设置中可选择 Logseq 的 `TODO` / `DOING` / `DONE` 如何显示：

- **保留原样**：显示为原始的 `TODO` / `DOING` / `DONE` 文本。
- **渲染为任务（推荐）**：在阅读视图中显示为带状态标签的任务复选框，不会修改你的笔记原文。
- **转换为标准 Markdown 复选框**：打开文件时将 `TODO` / `DOING` 转为 `- [ ]`，`DONE` 转为 `- [x]`，会修改笔记原文。

## 开发

```bash
# 部署到本地vault
npm run deploy

# 发布到GitHub
npm run release
```

## License

MIT


---

## ☕ 请作者喝杯咖啡

如果这个插件帮助了你，欢迎扫码打赏，感谢支持！

<div align="center">
  <img src="./assets/wechat-donate.jpg" alt="微信打赏" width="200" />
  <p><sub>微信扫码打赏</sub></p>
</div>
