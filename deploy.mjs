import { copyFileSync, mkdirSync, existsSync, rmSync } from 'fs';
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
    path: join(BASE_PATH, '.obsidian-mobile/plugins/logseq-formater')
  },
  {
    name: 'Pro',
    path: join(BASE_PATH, '.obsidian-pro/plugins/logseq-formater')
  },
  {
    name: 'iPad',
    path: join(BASE_PATH, '.obsidian-ipad/plugins/logseq-formater')
  },
  {
    name: '2017',
    path: join(BASE_PATH, '.obsidian-2017/plugins/logseq-formater')
  },
  {
    name: 'Zhang',
    path: join(BASE_PATH, '.obsidian-zhang/plugins/logseq-formater')
  },
  {
    name: 'Note-Demo',
    path: join(NOTE_DEMO_PATH, '.obsidian/plugins/logseq-formater')
  }
];

// 需要复制的文件（都从 dist 目录）
const FILES_TO_COPY = [
  { source: 'dist/main.js', target: 'main.js' },
  { source: 'dist/manifest.json', target: 'manifest.json' }
];

console.log('📦 开始部署 Logseq Formater 插件到所有 vaults...\n');

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

  // 复制插件运行时所需的静态资源
  const pluginAssets = ['wechat-donate.jpg'];
  const assetsTarget = join(vault.path, 'assets');
  if (!existsSync(assetsTarget)) mkdirSync(assetsTarget, { recursive: true });
  pluginAssets.forEach((fileName) => {
    const src = join('assets', fileName);
    if (existsSync(src)) {
      copyFileSync(src, join(assetsTarget, fileName));
      console.log(`  ✓ 已复制 assets/${fileName}`);
    } else {
      console.log(`  ⚠️  警告: assets/${fileName} 不存在`);
    }
  });

  // 清理旧插件目录（改名后遗留）
  const oldPluginPath = join(vault.path, '../logseq-to-obsidian');
  if (existsSync(oldPluginPath)) {
    try {
      rmSync(oldPluginPath, { recursive: true, force: true });
      console.log(`  🧹 已清理旧插件目录: ${oldPluginPath}`);
    } catch (error) {
      console.error(`  ❌ 清理旧插件目录失败: ${oldPluginPath}`, error.message);
    }
  }

  console.log('');
});

console.log('🎉 部署完成！已部署到 6 个 vaults');
console.log('\n💡 提示: 在 Obsidian 中重新加载插件以查看更改');
console.log('   - 打开命令面板 (Cmd/Ctrl + P)');
console.log('   - 搜索 "Reload app without saving"');
console.log('   - 或者禁用再启用插件\n');

// 清理 dist 文件夹
try {
  rmSync('dist', { recursive: true, force: true });
  console.log('🧹 已清理 dist 文件夹\n');
} catch (error) {
  console.log('⚠️  清理 dist 文件夹失败:', error.message, '\n');
}
