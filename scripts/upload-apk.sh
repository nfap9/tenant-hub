#!/bin/bash
# 上传 APK 到服务器
# 用法: bash scripts/upload-apk.sh <版本号> <服务器地址>
# 示例: bash scripts/upload-apk.sh 1.0.1 root@120.79.41.29

set -e

VERSION="${1:-}"
SERVER="${2:-}"
LOCAL_APK="apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
REMOTE_DIR="/var/www/tenant-hub"

if [ -z "$VERSION" ]; then
    echo "❌ 缺少版本号"
    echo "用法: bash scripts/upload-apk.sh <版本号> <服务器地址>"
    echo "示例: bash scripts/upload-apk.sh 1.0.1 root@120.79.41.29"
    exit 1
fi

if [ -z "$SERVER" ]; then
    echo "❌ 缺少服务器地址"
    echo "用法: bash scripts/upload-apk.sh <版本号> <服务器地址>"
    echo "示例: bash scripts/upload-apk.sh 1.0.1 root@120.79.41.29"
    exit 1
fi

REMOTE_NAME="tenant-hub-${VERSION}.apk"

if [ ! -f "$LOCAL_APK" ]; then
    echo "❌ APK 不存在: $LOCAL_APK"
    echo "请先执行: pnpm mobile:build:apk"
    exit 1
fi

echo "📦 上传 $REMOTE_NAME 到 $SERVER..."
scp "$LOCAL_APK" "$SERVER:$REMOTE_DIR/$REMOTE_NAME"

echo "✅ 上传完成"
