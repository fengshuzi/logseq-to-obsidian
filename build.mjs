#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'fs';

console.log('📦 构建 logseq-to-obsidian...');

// 确保 dist 目录存在
if (!existsSync('dist')) {
  mkdirSync('dist');
}

// 复制 main.js 到 dist
if (existsSync('main.js')) {
  copyFileSync('main.js', 'dist/main.js');
  console.log('✅ 已复制 main.js → dist/main.js');
} else {
  console.error('❌ main.js 不存在');
  process.exit(1);
}

// 复制 manifest.json 到 dist
if (existsSync('manifest.json')) {
  copyFileSync('manifest.json', 'dist/manifest.json');
  console.log('✅ 已复制 manifest.json → dist/manifest.json');
}

console.log('✅ 构建完成');
