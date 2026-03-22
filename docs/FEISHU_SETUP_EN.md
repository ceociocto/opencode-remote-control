# Feishu Bot Setup Guide

## Overview

This guide explains how to configure the Feishu bot to control OpenCode remotely.

## Step 1: Create a Feishu App

### 1.1 Access the Open Platform

Visit the [Feishu Open Platform](https://open.feishu.cn/) and log in.

### 1.2 Create an App

1. Click "Developer Console" (开发者后台)
2. Click "Create Enterprise App" (创建企业自建应用)
3. Fill in the information:
   - **App Name**: OpenCode Remote Control
   - **App Description**: Remote control for OpenCode coding
   - **App Icon**: Upload a custom icon

### 1.3 Get Credentials

After creation, go to "Credentials & Basic Info" (凭证与基础信息) page to get:
- **App ID**: `cli_xxxxxxxxxxxxxxxx`
- **App Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Configure Permissions

### 2.1 Add Permissions

Go to "Permission Management" (权限管理) → "API Permissions" and enable:

| Permission Name | Permission ID | Purpose |
|-----------------|---------------|---------|
| Get and send messages | `im:message` | Send/receive messages |
| Send messages as bot | `im:message:send_as_bot` | Bot replies |
| Receive bot messages | `im:message:receive_as_bot` | Group chat triggers |

### 2.2 Permission JSON Configuration

For batch configuration, use this JSON (import in permission management):

```json
[
  "im:message",
  "im:message:send_as_bot",
  "im:message:receive_as_bot"
]
```

## Step 3: Configure Bot

### 3.1 Enable Bot Capability

1. Go to "App Capabilities" (应用能力) → "Bot" (机器人)
2. Enable "Enable Bot" (启用机器人)
3. Configure bot information:
   - **Bot Name**: OpenCode Bot
   - **Bot Description**: Remote control for OpenCode coding
   - **Command List**:
     ```
     /start - Get started
     /help - View help
     /status - Check connection status
     /reset - Reset session
     ```

### 3.2 Message Capability Settings

- ✅ Enable "Bot can proactively send messages to users"
- ✅ Enable "Users can have private chats with bot"

## Step 4: Configure Event Subscription

### 4.1 Start Local Service

```bash
# Option 1: Use start script
./scripts/start-feishu.sh

# Option 2: Manual start
bun run build && node dist/cli.js feishu
```

### 4.2 Expose Webhook

Use ngrok or cloudflared to expose the local service:

```bash
# Using ngrok
ngrok http 3001

# Using cloudflared
cloudflared tunnel --url http://localhost:3001
```

Note the generated public URL, e.g.: `https://abc123.ngrok-free.app`

### 4.3 Configure Event Subscription

1. Go to "Event Subscription" (事件订阅) page
2. Configure "Request URL":
   ```
   https://abc123.ngrok-free.app/feishu/webhook
   ```
3. Click "Add Event" and select:
   - `im.message.receive_v1` - Receive messages
4. Save configuration

> **Note**: The URL will be verified when saving, ensure the local service is running.

## Step 5: Configure Environment Variables

### 5.1 Create .env File

Create a `.env` file in the project root:

```bash
# Feishu Configuration (required)
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook Port (optional, default: 3001)
FEISHU_WEBHOOK_PORT=3001

# OpenCode Configuration
OPENCODE_SERVER_URL=http://localhost:3000

# Optional: Encryption settings (for improved security)
# FEISHU_ENCRYPT_KEY=your_encrypt_key
# FEISHU_VERIFICATION_TOKEN=your_verification_token
```

### 5.2 Or Use CLI Configuration

```bash
opencode-remote config-feishu
```

Follow the prompts to enter App ID and App Secret.

## Step 6: Publish App

### 6.1 Create Version

1. Go to "Version Management & Publishing" (版本管理与发布)
2. Click "Create Version" (创建版本)
3. Fill in version information:
   - **Version Number**: 1.0.0
   - **Update Notes**: Initial release, supports remote control for OpenCode

### 6.2 Request Publishing

1. Click "Request Publishing" (申请发布)
2. Wait for review (enterprise apps are usually approved instantly)
3. After approval, click "Publish" (发布)

### 6.3 Add to Enterprise

1. After publishing, enable the app in enterprise admin
2. Or search for the bot name directly in Feishu

## Step 7: Test & Verify

### 7.1 Test in Feishu

Open Feishu, search for your bot, and send:

```
/start
```

Expected response:
```
🚀 OpenCode Remote Control ready

💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection

Commands:
...
```

### 7.2 Test OpenCode Connection

```
/status
```

Expected response:
```
✅ Connected

💬 Session: none
⏰ Idle: 0s
📝 Pending approvals: 0
```

### 7.3 Send a Coding Task

```
Create a hello.ts file that outputs Hello World
```

Expected behavior:
1. Bot replies `⏳ Thinking...`
2. OpenCode processes the request
3. Returns the result

## Architecture Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Feishu     │    │  Feishu     │    │   Webhook   │
│  Client     │───▶│  Server     │───▶│  (ngrok)    │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │ Feishu Bot  │
                                      │  (port 3001)│
                                      └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  OpenCode   │
                                      │    SDK      │
                                      └─────────────┘
```

## Troubleshooting

### Q: URL Verification Failed

**Cause**: Feishu cannot access the webhook URL

**Solution**:
1. Ensure ngrok/cloudflared is running
2. Check if local service is started (port 3001)
3. Confirm webhook path is `/feishu/webhook`

### Q: Not Receiving Messages

**Cause**: Permissions or event subscription not configured correctly

**Solution**:
1. Check if `im:message:receive_as_bot` permission is added
2. Confirm `im.message.receive_v1` event is subscribed
3. Check if app is published

### Q: OpenCode Offline

**Cause**: OpenCode not running or SDK not initialized properly

**Solution**:
1. Ensure OpenCode is running
2. Check `OPENCODE_SERVER_URL` configuration
3. Check logs for error messages

### Q: Message Send Failed

**Cause**: App ID or App Secret configured incorrectly

**Solution**:
1. Re-check credentials from Feishu Open Platform
2. Confirm `.env` file configuration is correct
3. Restart the bot service

## Security Recommendations

1. **Use Encryption**: Configure `FEISHU_ENCRYPT_KEY` and `FEISHU_VERIFICATION_TOKEN`
2. **IP Restriction**: Configure IP whitelist in Feishu admin
3. **Regular Rotation**: Periodically change App Secret
4. **Monitor Logs**: Watch for unusual access logs

## Next Steps

- Configure [Telegram Bot](./TELEGRAM_SETUP.md) (optional)
- View [API Documentation](./API.md)
- Join community discussions

---

[中文版](./FEISHU_SETUP.md) | [Back to README](../README.md)
