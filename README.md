# Logseq Formater

An Obsidian plugin that automatically converts Logseq syntax to Markdown.

## Features

- 🔄 **Auto-convert**: Automatically converts Logseq syntax when opening MD files.
- 📝 **Block reference rendering**: Renders Logseq `((block-id))` as inline block content previews.
- 🆔 **Block ID conversion**: Converts Logseq `id:: block-id` to Obsidian `^block-id`.
- ⏱️ **LOGBOOK summary**: Summarizes `CLOCK` durations under `:LOGBOOK:` and appends them to `DONE` tasks.
- ✅ **TODO rendering**: Supports three modes: preserve, render as task, or convert to Markdown checkbox.
- ⚡ **Seamless integration**: Runs automatically in the background without manual action.

## Installation

### Method 1: Obsidian Community Marketplace (Recommended)

Open Obsidian Settings → Community Plugins → Browse, then search for **Logseq Formater** or **fengshuzi**.

### Method 2: Install from GitHub Release

1. Go to the [Releases](../../releases) page and download the latest version.
2. Download the following files:
   - `main.js`
   - `manifest.json`
3. Create the plugin directory in your vault: `.obsidian/plugins/logseq-formater/`
4. Copy the downloaded files into that directory.
5. Restart Obsidian or reload the plugin list.
6. Enable the **Logseq Formater** plugin in Settings.

### Method 3: Manual Installation

```bash
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/fengshuzi/logseq-formater.git
cd logseq-formater
npm install
npm run build
```

## Usage

After enabling the plugin, open any MD file containing Logseq syntax and the plugin will convert it automatically.

### TODO Rendering Mode

In the plugin settings you can choose how Logseq `TODO` / `DOING` / `DONE` should be displayed:

- **Preserve**: Keep the original `TODO` / `DOING` / `DONE` text.
- **Render as task (Recommended)**: Display as a task checkbox with a status label in reading view without modifying your note source.
- **Convert to Markdown checkbox**: Convert `TODO` / `DOING` to `- [ ]` and `DONE` to `- [x]` when opening the file. This modifies your note source.

## Development

```bash
# Deploy to local vault
npm run deploy

# Publish to GitHub
npm run release
```

## License

MIT

---

## ☕ Buy me a coffee

If this plugin helped you, feel free to buy me a coffee.

<div align="center">
  <img src="https://raw.githubusercontent.com/fengshuzi/images/main/wechat-donate.jpg" alt="WeChat Donate" width="200" />
  <p><sub>Scan with WeChat</sub></p>
</div>
