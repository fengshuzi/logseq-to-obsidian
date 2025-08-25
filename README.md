# Logseq to Obsidian Converter

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/fengshuzi/logseq-to-obsidian)](https://github.com/fengshuzi/logseq-to-obsidian/releases)
[![GitHub license](https://img.shields.io/github/license/fengshuzi/logseq-to-obsidian)](https://github.com/fengshuzi/logseq-to-obsidian/blob/main/LICENSE)

An Obsidian plugin that automatically converts Logseq syntax to Obsidian syntax, helping users seamlessly migrate from Logseq to Obsidian.

## ✨ Features

- **Automatic Syntax Conversion**: Automatically detects and converts Logseq syntax when opening Markdown files
- **Task Mark Conversion**: Converts Logseq's `TODO`, `DOING`, `DONE` to Obsidian checkbox format
- **Time Tracking Integration**: Automatically calculates and integrates time records from LOGBOOK, appending total time to completed tasks
- **Smart Duration Formatting**: Automatically formats time into readable format (seconds, minutes, hours)
- **Seamless Experience**: Fully automated conversion process, no manual operation required

## 🔧 Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to "Community plugins" tab
3. Turn off "Safe mode"
4. Click "Browse" button
5. Search for "Logseq to Obsidian Converter"
6. Click "Install" button
7. Enable the plugin after installation

### Manual Installation

1. Download the latest version of `main.js` and `manifest.json`
2. Place the files in your Obsidian vault's `.obsidian/plugins/logseq-to-obsidian/` folder
3. Restart Obsidian
4. Enable the plugin in settings

## 📖 Usage

### Basic Usage

After installing and enabling the plugin, no configuration is required:

1. Open any Markdown file containing Logseq syntax
2. The plugin will automatically detect and convert the syntax
3. The converted content will be automatically saved

### Syntax Conversion Examples

#### Task Mark Conversion

**Before (Logseq syntax):**
```markdown
- TODO Complete project documentation
- DOING Write code
- DONE Project planning
```

**After (Obsidian syntax):**
```markdown
- [ ] Complete project documentation
- [ ] Write code
- [x] Project planning
```

#### Time Tracking Conversion

**Before (Logseq syntax):**
```markdown
- DONE Complete meeting
:LOGBOOK:
CLOCK: [2024-01-01 Mon 09:00:00]--[2024-01-01 Mon 10:30:00] => 01:30:00
CLOCK: [2024-01-01 Mon 14:00:00]--[2024-01-01 Mon 15:00:00] => 01:00:00
:END:
```

**After (Obsidian syntax):**
```markdown
- [x] Complete meeting 2 hours 30 minutes
```

## 🛠️ Development Info

- **Author**: lizhifeng
- **Version**: 0.1.0
- **License**: MIT License
- **Repository**: [GitHub](https://github.com/fengshuzi/logseq-to-obsidian)

## 🤝 Contributing

Issues and Pull Requests are welcome!

### Development Setup

1. Clone the repository
2. Install dependencies
3. Run tests
4. Submit changes

## 📝 Changelog

### v0.1.0
- Initial release
- Basic task mark conversion support
- Time tracking integration support
- Automatic syntax detection and conversion

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Thanks to the Obsidian team for providing excellent plugin APIs, and to the Logseq community for their contributions to knowledge management.

---

**Note**: This plugin will modify your Markdown file content. It's recommended to backup important files before use.
