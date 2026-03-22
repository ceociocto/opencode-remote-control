# Feishu Bot Setup Guide

## Overview

This guide explains how to configure the Feishu bot to control OpenCode remotely.

**✨ Features: Uses WebSocket long connection mode - no public IP, no tunnel (ngrok/cloudflared) required!**

## Step 1: Create Feishu App

### 1.1 Access Open Platform

Visit [Feishu Open Platform](https://open.feishu.cn/) and login.

### 1.2 Create App

1. Click "Developer Console" (开发者后台)
2. Click "Create Enterprise App" (创建企业自建应用)
3. Fill in:
   - **App Name**: OpenCode Remote Control
   - **App Description**: Remote control for OpenCode coding
   - **App Icon**: Upload custom icon

### 1.3 Get Credentials

After creation, go to "Credentials & Basic Info" (凭证与基础信息) to get:
- **App ID**: `cli_xxxxxxxxxxxxxxxx`
- **App Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Configure Permissions

### 2.1 Batch Add Permissions (Recommended)

Go to "Permission Management" → "API Permissions"
Click "**Batch Add**" (批量添加)
Paste this JSON:

```json
[
  "im:message",
  "im:message:send_as_bot",
  "im:message:receive_as_bot"
]
```

> 💡 **Copy the JSON above → Feishu Admin → Permissions → API Permissions → Batch Add → Paste → Confirm**

### 2.2 Or Add Manually

| Permission Name | Permission ID | Purpose |
|-----------------|---------------|---------|
| Get and send messages | `im:message` | Send/receive messages |
| Send messages as bot | `im:message:send_as_bot` | Bot replies |
| Receive bot messages | `im:message:receive_as_bot` | Group chat triggers |

## Step 3: Configure Bot

### 3.1 Enable Bot Capability

1. Go to "App Capabilities" (应用能力) → "Robot" (机器人)
2. Enable "Enable Robot" (启用机器人)
3. Configure:
   - **Robot Name**: OpenCode Bot
   - **Robot Description**: Remote control for OpenCode coding
   - **Commands**:
     ```
     /start - Get started
     /help - View help
     /status - Check connection
     /reset - Reset session
     ```

### 3.2 Message Capability Settings

- ✅ Enable "Bot can proactively send messages to users"
- ✅ Enable "Users can have private chats with bot"

## Step 4: Configure Environment Variables

### 4.1 Create .env File

Create a `.env` file in project root:

```bash
# Feishu Configuration (required)
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OpenCode Configuration
OPENCODE_SERVER_URL=http://localhost:3000
```

### 4.2 Or Use CLI Configuration

```bash
opencode-remote config
```

Select "Feishu" and enter App ID and App Secret.

## Step 5: Start Local Bot FIRST! (CRITICAL)

> ⚠️ **IMPORTANT**: You MUST start the bot BEFORE configuring event subscription in Feishu admin console!

```bash
opencode-remote feishu
```

Wait until you see:

```
🔧 Initializing OpenCode...
✅ OpenCode ready
🔗 Starting Feishu WebSocket long connection...

✨ Long connection mode - NO tunnel/ngrok required!
   Just make sure your computer can access the internet.

✅ ws client ready  ← This means connection established!
```

## Step 6: Configure Event Subscription (Long Connection Mode)

> ⚠️ **Make sure the bot is running before this step!**

### 6.1 Enable Long Connection Mode

1. Go to "Event Subscription" (事件订阅) page
2. **Subscription Method**: Select "**Use long connection to receive events**" (使用长连接接收事件)
3. Click "Add Event" and select:
   - `im.message.receive_v1` - Receive messages
4. Save configuration

> **If you see "未检测到应用连接信息" (No connection detected)**:
> The bot is not running. Start it first with `opencode-remote feishu`

### 6.2 Advantages of Long Connection Mode

- ✅ **No public IP required** - Receive callbacks locally
- ✅ **No tunnel required** - Feishu connects to your device
- ✅ **No domain required** - Skip domain configuration
- ✅ **Real-time** - Millisecond latency
- ✅ **Secure** - Built-in encryption and authentication

## Step 7: Publish App

### 7.1 Create Version

1. Go to "Version Management & Publishing" (版本管理与发布)
2. Click "Create Version" (创建版本)
3. Fill in:
   - **Version**: 1.0.0
   - **Update Notes**: Initial release, supports remote control for OpenCode

### 7.2 Request Publishing

1. Click "Request Publishing" (申请发布)
2. Wait for review (usually instant for enterprise apps)
3. After approval, click "Publish" (发布)

### 7.3 Add to Enterprise

1. After publishing, enable the app in enterprise admin
2. Or search for the bot name directly in Feishu

## Step 8: Test & Verify

### 8.1 Test in Feishu

Open Feishu, search for your bot, send:

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

### 8.2 Test OpenCode Connection

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

---

## 📋 Troubleshooting Checklist

If the bot doesn't respond, check in order:

| # | Check Item | Location | How to Check |
|---|------------|----------|--------------|
| 1 | App ID/Secret configured | `.env` file or `opencode-remote config` | Check file or reconfigure |
| 2 | Permissions added | Permissions → API Permissions | Search for `im:message` |
| 3 | Robot enabled | Capabilities → Robot | "Enable Robot" switch is ON |
| 4 | **Long connection mode** | Event Subscription → Method | Select "Use long connection" |
| 5 | **Event:** `im.message.receive_v1` | Event Subscription → Events | Event is in the list |
| 6 | **App published** | Version Management | Status is "Published" |
| 7 | **Bot running** | Terminal | Shows `ws client ready` |
| 8 | **Message logs** | Terminal | Shows `📩 Received message event` |

### Common Issues

#### Q: "未检测到应用连接信息" when saving

**Cause**: Local bot is not running

**Solution**:
1. Run `opencode-remote feishu`
2. Wait for `ws client ready`
3. Then save configuration in Feishu admin

#### Q: No logs when sending message

**Cause**: Event not properly subscribed

**Solution**:
1. Check if subscription method is "Use long connection"
2. Check if `im.message.receive_v1` is in event list

#### Q: Permission denied

**Cause**: Required permissions not added

**Solution**: Use batch add to import permissions JSON:
```json
[
  "im:message",
  "im:message:send_as_bot",
  "im:message:receive_as_bot"
]
```

---

## Architecture Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Feishu     │───▶│  Feishu     │───▶│  WebSocket  │
│  Client     │    │  Server     │    │ (Long Conn) │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │ Feishu Bot  │
                                      │  (Local)    │
                                      └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  OpenCode   │
                                      │    SDK      │
                                      └─────────────┘
```

---

[中文版](./FEISHU_SETUP.md) | [Back to README](../README.md)
