// 从 Obsidian 的 API 导入 Plugin 类
const { Plugin } = require('obsidian');

// 导出插件类
module.exports = class LogseqToObsidian extends Plugin {
  // onload 方法在插件加载时被调用
  async onload() {
    // 注册文件打开事件监听器
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        // 检查打开的文件是否是 Markdown 文件
        if (file && file.extension === 'md') {
          // 调用转换函数
          this.convertSyntax(file);
        }
      })
    );
  }

  // 将 Logseq 语法转换为 Obsidian 语法的函数
  async convertSyntax(file) {
    // 读取文件内容
    const content = await this.app.vault.read(file);
    let newContent = content;

    // 辅助函数：将时间字符串 'hh:mm:ss' 转换为秒
    function timeStrToSeconds(t) {
      const [h, m, s] = t.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    }

    // 辅助函数：将总秒数格式化为可读的持续时间字符串
    function formatDuration(seconds) {
      if (seconds < 60) return `${seconds}秒`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
      return `${Math.floor(seconds / 3600)}小时`;
    }

    // 处理 DONE 任务的 LOGBOOK 部分：计算总时间并附加到任务
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

    // 用 Obsidian 复选框替换 Logseq 任务标记
    // TODO 和 DOING 变为未选中复选框
    newContent = newContent.replace(/([ \t]*)- TODO\b/gm, '$1- [ ]');
    newContent = newContent.replace(/([ \t]*)- DOING\b/gm, '$1- [ ]');
    // DONE 变为选中复选框，保留任何附加文本（如持续时间）
    newContent = newContent.replace(/([ \t]*)- DONE\b(.*)/gm, '$1- [x]$2');

    // 如果内容已更改，将新内容保存回文件
    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
      // 记录转换以进行调试
      console.log(`Converted: ${file.path}`);
    }
  }
};