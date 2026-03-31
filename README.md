# Logseq to Obsidian Converter

自动将 Logseq 语法转换为 Obsidian 语法的插件。

## 功能特点

- 🔄 **自动转换**：打开 MD 文件时自动转换 Logseq 语法
- 📝 **块引用转换**：将 Logseq 的块引用转换为 Obsidian 格式
- 🔗 **链接转换**：转换页面链接格式
- ⚡ **无缝集成**：后台自动运行，无需手动操作

## 安装方法

### 方式一：从 GitHub Release 安装（推荐）

1. 前往 [Releases](../../releases) 页面下载最新版本
2. 下载以下文件：
   - `main.js`
   - `manifest.json`
3. 在你的 Obsidian 库中创建插件目录：`.obsidian/plugins/logseq-to-obsidian/`
4. 将下载的文件复制到该目录
5. 重启 Obsidian 或刷新插件列表
6. 在设置中启用"Logseq to Obsidian"插件

### 方式二：手动安装

```bash
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/你的用户名/logseq-to-obsidian.git
cd logseq-to-obsidian
npm install
npm run build
```

## 使用方法

启用插件后，打开任何包含 Logseq 语法的 MD 文件，插件会自动进行转换。

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
