import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// 定义基础路径
const BASE_PATH = join(
  homedir(),
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/漂泊者及其影子'
);

const NOTE_DEMO_PATH = join(
  homedir(),
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/note-demo'
);

// 定义目标 vault 配置目录
const VAULTS = [
  {
    name: 'Mobile',
    path: join(BASE_PATH, '.obsidian-mobile/plugins/logseq-to-obsidian')
  },
  {
    name: 'Pro',
    path: join(BASE_PATH, '.obsidian-pro/plugins/logseq-to-obsidian')
  },
  {
    name: 'iPad',
    path: join(BASE_PATH, '.obsidian-ipad/plugins/logseq-to-obsidian')
  },
  {
    name: '2017',
    path: join(BASE_PATH, '.obsidian-2017/plugins/logseq-to-obsidian')
  },
  {
    name: 'Zhang',
    path: join(BASE_PATH, '.obsidian-zhang/plugins/logseq-to-obsidian')
  },
  {
    name: 'Note-Demo',
    path: join(NOTE_DEMO_PATH, '.obsidian/plugins/logseq-to-obsidian')
  }
];

// 需要复制的文件（源文件 -> 目标文件名）
const FILES_TO_COPY = [
  { source: 'dist/main.js', target: 'main.js' },
  { source: 'manifest.json', target: 'manifest.json' }
];

console.log('📦 开始部署 Logseq to Obsidian 插件到所有 vaults...\n');

// 复制文件到每个 vault
VAULTS.forEach(vault => {
  console.log(`📁 部署到 ${vault.name} vault...`);
  
  // 创建目录（如果不存在）
  if (!existsSync(vault.path)) {
    mkdirSync(vault.path, { recursive: true });
    console.log(`  ✓ 创建目录: ${vault.path}`);
  }
  
  // 复制文件
  FILES_TO_COPY.forEach(file => {
    try {
      if (existsSync(file.source)) {
        copyFileSync(file.source, join(vault.path, file.target));
        console.log(`  ✓ 已复制 ${file.source} → ${file.target}`);
      } else {
        console.log(`  ⚠️  警告: ${file.source} 不存在`);
      }
    } catch (error) {
      console.error(`  ❌ 复制 ${file.source} 失败:`, error.message);
    }
  });
  
  console.log('');
});

console.log('🎉 部署完成！已部署到 6 个 vaults');
console.log('\n💡 提示: 在 Obsidian 中重新加载插件以查看更改');
console.log('   - 打开命令面板 (Cmd/Ctrl + P)');
console.log('   - 搜索 "Reload app without saving"');
console.log('   - 或者禁用再启用插件\n');
