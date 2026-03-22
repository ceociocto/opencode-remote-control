# 飞书机器人配置指南

## 概述

本文档介绍如何配置飞书机器人，实现通过飞书远程控制 OpenCode。

## 第一步：创建飞书应用

### 1.1 访问开放平台

访问 [飞书开放平台](https://open.feishu.cn/) 并登录。

### 1.2 创建应用

1. 点击「开发者后台」
2. 点击「创建企业自建应用」
3. 填写信息：
   - **应用名称**：OpenCode Remote Control
   - **应用描述**：远程控制 OpenCode 进行编程
   - **应用图标**：上传自定义图标

### 1.3 获取凭证

创建完成后，在「凭证与基础信息」页面获取：
- **App ID**：`cli_xxxxxxxxxxxxxxxx`
- **App Secret**：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## 第二步：配置权限

### 2.1 添加权限

在「权限管理」→「API权限」中，搜索并开通以下权限：

| 权限名称 | 权限标识 | 用途 |
|---------|---------|------|
| 获取与发送单聊、群组消息 | `im:message` | 收发消息 |
| 以应用身份发消息 | `im:message:send_as_bot` | 机器人回复 |
| 接收群聊中@机器人消息 | `im:message:receive_as_bot` | 群聊触发 |

### 2.2 权限 JSON 配置

如果需要批量配置，可使用以下 JSON（在权限管理页面导入）：

```json
{
  "permissions": [
    "im:message",
    "im:message:send_as_bot",
    "im:message:receive_as_bot"
  ]
}
```

## 第三步：配置机器人

### 3.1 启用机器人能力

1. 进入「应用能力」→「机器人」
2. 开启「启用机器人」开关
3. 配置机器人信息：
   - **机器人名称**：OpenCode Bot
   - **机器人描述**：远程控制 OpenCode 进行编程
   - **命令列表**：
     ```
     /start - 开始使用
     /help - 查看帮助
     /status - 检查连接状态
     /reset - 重置会话
     ```

### 3.2 消息能力配置

- ✅ 启用「机器人可主动发送消息给用户」
- ✅ 启用「用户可与机器人进行单聊」

## 第四步：配置事件订阅

### 4.1 启动本地服务

```bash
# 方式1：使用启动脚本
./scripts/start-feishu.sh

# 方式2：手动启动
bun run build && node dist/cli.js feishu
```

### 4.2 暴露 Webhook

使用 ngrok 或 cloudflared 暴露本地服务：

```bash
# 使用 ngrok
ngrok http 3001

# 使用 cloudflared
cloudflared tunnel --url http://localhost:3001
```

记录生成的公网 URL，例如：`https://abc123.ngrok-free.app`

### 4.3 配置事件订阅

1. 进入「事件订阅」页面
2. 配置「请求网址」：
   ```
   https://abc123.ngrok-free.app/feishu/webhook
   ```
3. 点击「添加事件」，选择：
   - `im.message.receive_v1` - 接收消息
4. 保存配置

> **注意**：保存时会验证 URL 可达性，确保本地服务正在运行。

## 第五步：配置环境变量

### 5.1 创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
# 飞书配置（必填）
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook 端口（可选，默认 3001）
FEISHU_WEBHOOK_PORT=3001

# OpenCode 配置
OPENCODE_SERVER_URL=http://localhost:3000

# 可选：加密配置（提高安全性）
# FEISHU_ENCRYPT_KEY=your_encrypt_key
# FEISHU_VERIFICATION_TOKEN=your_verification_token
```

### 5.2 或使用 CLI 配置

```bash
opencode-remote config-feishu
```

按提示输入 App ID 和 App Secret。

## 第六步：发布应用

### 6.1 创建版本

1. 进入「版本管理与发布」
2. 点击「创建版本」
3. 填写版本信息：
   - **版本号**：1.0.0
   - **更新说明**：首次发布，支持远程控制 OpenCode

### 6.2 申请发布

1. 点击「申请发布」
2. 等待审核（企业自建应用通常秒过）
3. 审核通过后点击「发布」

### 6.3 添加到企业

1. 发布后，在企业后台启用应用
2. 或直接在飞书中搜索机器人名称

## 第七步：测试验证

### 7.1 在飞书中测试

打开飞书，搜索你的机器人，发送以下消息：

```
/start
```

预期回复：
```
🚀 OpenCode Remote Control ready

💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection

Commands:
...
```

### 7.2 测试 OpenCode 连接

```
/status
```

预期回复：
```
✅ Connected

💬 Session: none
⏰ Idle: 0s
📝 Pending approvals: 0
```

### 7.3 发送编程任务

```
创建一个 hello.ts 文件，输出 Hello World
```

预期行为：
1. 机器人回复 `⏳ Thinking...`
2. OpenCode 处理请求
3. 返回处理结果

## 架构图

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  飞书客户端  │───▶│  飞书服务器  │───▶│   Webhook   │
└─────────────┘    └─────────────┘    │  (ngrok)    │
                                      └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │ Feishu Bot  │
                                      │  (端口 3001) │
                                      └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  OpenCode   │
                                      │   SDK       │
                                      └─────────────┘
```

## 常见问题

### Q: URL 验证失败

**原因**：飞书无法访问 webhook URL

**解决方案**：
1. 确保 ngrok/cloudflared 正在运行
2. 检查本地服务是否启动（端口 3001）
3. 确认 webhook 路径是 `/feishu/webhook`

### Q: 收不到消息

**原因**：权限或事件订阅未正确配置

**解决方案**：
1. 检查是否添加了 `im:message:receive_as_bot` 权限
2. 确认订阅了 `im.message.receive_v1` 事件
3. 检查应用是否已发布

### Q: OpenCode 离线

**原因**：OpenCode 未运行或 SDK 未正确初始化

**解决方案**：
1. 确保 OpenCode 正在运行
2. 检查 `OPENCODE_SERVER_URL` 配置
3. 查看日志是否有错误信息

### Q: 消息发送失败

**原因**：App ID 或 App Secret 配置错误

**解决方案**：
1. 重新检查飞书开放平台的凭证
2. 确认 `.env` 文件中的配置正确
3. 重启机器人服务

## 安全建议

1. **使用加密**：配置 `FEISHU_ENCRYPT_KEY` 和 `FEISHU_VERIFICATION_TOKEN`
2. **限制 IP**：在飞书后台配置 IP 白名单
3. **定期轮换**：定期更换 App Secret
4. **监控日志**：关注异常访问日志

## 下一步

- 配置 [Telegram 机器人](./TELEGRAM_SETUP.md)（可选）
- 查看 [API 文档](./API.md)
- 加入社区讨论

---

[English Version](./FEISHU_SETUP_EN.md) | [返回 README](../README_CN.md)
