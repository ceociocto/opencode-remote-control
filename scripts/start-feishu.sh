#!/bin/bash
# 飞书机器人启动脚本

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OpenCode Remote Control - 飞书机器人"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件"
    echo ""
    echo "请创建 .env 文件并配置以下内容："
    echo ""
    echo "  FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx"
    echo "  FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo "  FEISHU_WEBHOOK_PORT=3001"
    echo ""
    echo "或运行: opencode-remote config-feishu"
    exit 1
fi

# 加载环境变量
source .env 2>/dev/null || export $(grep -v '^#' .env | xargs)

# 检查必要配置
if [ -z "$FEISHU_APP_ID" ] || [ -z "$FEISHU_APP_SECRET" ]; then
    echo "❌ 缺少飞书配置"
    echo ""
    echo "请在 .env 文件中配置："
    echo "  FEISHU_APP_ID"
    echo "  FEISHU_APP_SECRET"
    exit 1
fi

# 设置默认端口
PORT=${FEISHU_WEBHOOK_PORT:-3001}

echo "📋 配置信息："
echo "   App ID: ${FEISHU_APP_ID:0:10}..."
echo "   Webhook 端口: $PORT"
echo ""

# 构建
echo "🔧 构建项目..."
bun run build || npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo ""
echo "🚀 启动飞书机器人..."
echo ""

# 启动机器人
node dist/cli.js feishu
