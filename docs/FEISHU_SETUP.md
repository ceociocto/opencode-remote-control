# 飞书机器人配置指南

## 概述

本文档介绍如何配置飞书机器人，实现通过飞书远程控制 OpenCode。

**✨ 特点：使用 WebSocket 长连接模式，无需公网 IP、无需内网穿透（ngrok/cloudflared）！**

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

### 2.1 批量添加权限（推荐）

在「权限管理」→「API权限」中
点击「**批量添加**」
粘贴以下 JSON：

```json
[
  "im:message",
  "im:message:send_as_bot",
  "im:message:receive_as_bot"
]
```

> 💡 **复制上面的 JSON → 飞书后台 → 权限管理 → API权限 → 批量添加 → 粘贴 → 确认**

### 2.2 或手动添加权限

| 权限名称 | 权限标识 | 用途 |
|---------|---------|------|
| 获取与发送单聊、群组消息 | `im:message` | 收发消息 |
| 以应用身份发消息 | `im:message:send_as_bot` | 机器人回复 |
| 接收群聊中@机器人消息 | `im:message:receive_as_bot` | 群聊触发 |

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

## 第四步：配置环境变量

### 4.1 创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
# 飞书配置（必填）
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OpenCode 配置
OPENCODE_SERVER_URL=http://localhost:3000
```

### 4.2 或使用 CLI 配置

```bash
opencode-remote config
```

选择「飞书」
按提示输入 App ID 和 App Secret。

## 第五步：启动本地机器人（重要！）

> ⚠️ **关键步骤**：必须**先启动本地机器人建立长连接**
才能在飞书后台成功保存事件订阅配置！

```bash
opencode-remote feishu
```

启动成功后会显示：

```
🔧 Initializing OpenCode...
✅ OpenCode ready
🔗 Starting Feishu WebSocket long connection...

✨ Long connection mode - NO tunnel/ngrok required!
   Just make sure your computer can access the internet.

✅ ws client ready  ← 看到这个表示连接成功
```

## 第六步：配置事件订阅（长连接模式）

> ⚠️ **确保本地机器人正在运行**
然后再进行以下配置！

### 6.1 启用长连接模式

1. 进入「事件订阅」页面
2. **订阅方式**：选择「**使用长连接接收事件**」
3. 点击「添加事件」
选择：
   - `im.message.receive_v1` - 接收消息
4. 保存配置

> **如果保存时提示「未检测到应用连接信息」**：
> 说明本地机器人未运行。请先运行 `opencode-remote feishu`

### 6.2 长连接模式优势

- ✅ **无需公网 IP** - 本地环境即可接收回调
- ✅ **无需内网穿透** - 飞书主动连接你的设备
- ✅ **无需域名** - 省去域名配置和备案
- ✅ **实时性强** - 消息延迟从分钟级降至毫秒级
- ✅ **安全传输** - SDK 内置加密和鉴权机制

## 第七步：发布应用

### 7.1 创建版本

1. 进入「版本管理与发布」
2. 点击「创建版本」
3. 填写版本信息：
   - **版本号**：1.0.0
   - **更新说明**：首次发布
支持远程控制 OpenCode

### 7.2 申请发布

1. 点击「申请发布」
2. 等待审核（企业自建应用通常秒过）
3. 审核通过后点击「发布」

### 7.3 添加到企业

1. 发布后
在企业后台启用应用
2. 或直接在飞书中搜索机器人名称

## 第八步：测试验证

### 8.1 在飞书中测试

打开飞书
搜索你的机器人，发送以下消息：

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

### 8.2 测试 OpenCode 连接

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

---

## 📋 排查清单

如果机器人没有响应
请按以下顺序检查：

| # | 检查项 | 位置 | 如何检查 |
|---|--------|------|----------|
| 1 | App ID/Secret 已配置 | `.env` 文件或 `opencode-remote config` | 检查文件内容或重新配置 |
| 2 | 权限已添加 | 权限管理 → API权限 | 搜索 `im:message` |
| 3 | 机器人已启用 | 应用能力 → 机器人 | 「启用机器人」开关打开 |
| 4 | **使用长连接模式** | 事件订阅 → 订阅方式 | 选择「使用长连接接收事件」 |
| 5 | **事件：** `im.message.receive_v1` | 事件订阅 → 事件列表 | 事件列表中有此项 |
| 6 | **应用已发布** | 版本管理与发布 | 状态为「已发布」 |
| 7 | **机器人运行中** | 终端 | 显示 `ws client ready` |
| 8 | **发消息有日志** | 终端 | 显示 `📩 Received message event` |

### 常见问题

#### Q: 保存时提示「未检测到应用连接信息」

**原因**：本地机器人未运行

**解决**：
1. 运行 `opencode-remote feishu`
2. 等待看到 `ws client ready`
3. 再去飞书后台保存配置

#### Q: 发送消息无任何日志

**原因**：事件未正确订阅

**解决**：
1. 检查事件订阅方式是否为「使用长连接接收事件」
2. 检查事件列表中是否有 `im.message.receive_v1`

#### Q: 权限不足

**原因**：未添加必要权限

**解决**：使用批量添加功能
导入权限 JSON：
```json
[
  "im:message",
  "im:message:send_as_bot",
  "im:message:receive_as_bot"
]
```

---

## 架构图

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  飞书客户端  │───▶│  飞书服务器  │───▶│  WebSocket  │
│             │    │             │    │  (长连接)   │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │ Feishu Bot  │
                                      │  (本地运行)  │
                                      └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  OpenCode   │
                                      │   SDK       │
                                      └─────────────┘
```

---

[English Version](./FEISHU_SETUP_EN.md) | [返回 README](../README_CN.md)
