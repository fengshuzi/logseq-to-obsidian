#!/bin/bash

# Logseq to Obsidian 插件部署脚本
# 将插件文件复制到多个 Obsidian vault

echo "🔨 开始部署 Logseq to Obsidian 插件..."

# 定义插件名称
PLUGIN_NAME="logseq-to-obsidian"

# 定义基础路径
BASE_PATH="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/漂泊者及其影子"

# 定义目标 vault 配置目录
VAULTS=(
  ".obsidian-mobile"
  ".obsidian-pro"
  ".obsidian-ipad"
  ".obsidian-2017"
)

# 需要复制的文件
FILES=(
  "main.js"
  "manifest.json"
)

# 复制文件到各个 vault
for vault in "${VAULTS[@]}"; do
  TARGET_DIR="$BASE_PATH/$vault/plugins/$PLUGIN_NAME"
  
  echo "📦 复制到 $vault..."
  
  # 创建目标目录（如果不存在）
  mkdir -p "$TARGET_DIR"
  
  # 复制文件
  for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
      cp "$file" "$TARGET_DIR/"
      echo "  ✓ 已复制 $file 到 $vault"
    else
      echo "  ✗ 文件不存在: $file"
    fi
  done
done

echo ""
echo "🎉 完成！插件已部署到所有 vault："
for vault in "${VAULTS[@]}"; do
  echo "  📁 $vault: $BASE_PATH/$vault/plugins/$PLUGIN_NAME"
done

echo ""
echo "💡 提示: 在 Obsidian 中重新加载插件以查看更改"
