// Import Plugin class from Obsidian API
const { Plugin } = require('obsidian');

// Export plugin class
module.exports = class LogseqToObsidian extends Plugin {
  // onload method is called when plugin is loaded
  async onload() {
    // Register file open event listener
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        // Check if the opened file is a Markdown file
        if (file && file.extension === 'md') {
          // Call conversion function
          this.convertSyntax(file);
        }
      })
    );
  }

  // Function to convert Logseq syntax to Obsidian syntax
  async convertSyntax(file) {
    // Read file content
    const content = await this.app.vault.read(file);
    let newContent = content;

    // Helper function: convert time string 'hh:mm:ss' to seconds
    function timeStrToSeconds(t) {
      const [h, m, s] = t.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    }

    // Helper function: format total seconds into readable duration string
    function formatDuration(seconds) {
      if (seconds < 60) return `${seconds}秒`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
      return `${Math.floor(seconds / 3600)}小时`;
    }

    // Process LOGBOOK section of DONE tasks: calculate total time and append to task
    newContent = newContent.replace(
      /([ \t]*)- DONE (.+?)\s*\n([ \t]*:LOGBOOK:\s*\n((?:[ \t]*CLOCK: \[.*?\]--\[.*?\] =>\s*\d{2}:\d{2}:\d{2}\s*\n)+)[ \t]*:END:)/gms,
      (match, indent, taskText, logbook, clockBlock) => {
        // Extract all duration strings from CLOCK lines
        const times = clockBlock.match(/=> *(\d{2}:\d{2}:\d{2})/g) || [];
        // Calculate total seconds by summing all durations
        const totalSeconds = times.reduce((sum, t) => sum + timeStrToSeconds(t.replace(/=> */g, '')), 0);
        // Format total duration
        const durationStr = formatDuration(totalSeconds);
        // Return modified task line with duration and remove LOGBOOK
        return `${indent}- DONE ${taskText.trim()} ${durationStr}`;
      }
    );

    // Replace Logseq task markers with Obsidian checkboxes
    // TODO and DOING become unchecked checkboxes
    newContent = newContent.replace(/([ \t]*)- TODO\b/gm, '$1- [ ]');
    newContent = newContent.replace(/([ \t]*)- DOING\b/gm, '$1- [ ]');
    // DONE becomes checked checkbox, preserving any additional text (like duration)
    newContent = newContent.replace(/([ \t]*)- DONE\b(.*)/gm, '$1- [x]$2');

    // If content has changed, save new content back to file
    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
      // Log conversion for debugging
      console.log(`Converted: ${file.path}`);
    }
  }
};