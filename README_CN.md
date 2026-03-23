# OpenCode Remote Control

> **基于 OpenCode 的极速 AI 编程助手 — 无需订阅 Claude Code！**

[English](./README.md)

---

## 🎉 v0.7.0 重要更新

**微信（WeChat）渠道支持！**

现在你可以通过微信控制 OpenCode。扫码登录，无需内网穿透！

> ⚠️ **重要提示**：请确保微信已更新到 **最新版本**，否则无法使用机器人功能。

---

通过 **Telegram**、**飞书** 或 **微信** 远程控制 OpenCode。

> **免责声明**：本项目并非由 OpenCode 团队开发，与 OpenCode 无任何关联。这是一个基于 OpenCode 构建的独立社区项目。

## 系统要求

- Node.js >= 18.0.0
- 已安装 [OpenCode](https://github.com/opencode-ai/opencode) 且在 PATH 中可用
- Telegram 账号（用于 Telegram 机器人）
- 飞书账号（用于飞书机器人）
- 微信账号（用于微信机器人）
- **无需** ngrok 或 cloudflared（飞书使用 WebSocket，微信使用长轮询）

### 验证 OpenCode 安装

启动前，请确保 OpenCode 已正确安装：

```bash
opencode --version
```

如果提示 `command not found`，请先安装 OpenCode：

```bash
npm install -g @opencode-ai/opencode
```

## 安装

```bash
# 使用 npm、pnpm 或 bun 全局安装
npm install -g opencode-remote-control@latest
# 或
pnpm install -g opencode-remote-control@latest
# 或
bun install -g opencode-remote-control@latest
```

## 配置

运行配置命令选择要配置的频道：

```bash
opencode-remote config
```

选择 **Telegram**、**飞书** 或 **微信**，按交互式指南操作。

### Telegram 配置

1. 打开 Telegram，搜索 **@BotFather**
2. 发送 `/newbot` 并按提示操作
3. 将获取的 token 粘贴到提示中

Token 会保存到 `~/.opencode-remote/.env`

### 飞书配置

飞书使用 **WebSocket 长连接模式**，无需公网 IP 或内网穿透！

#### 步骤 1：创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/) 并登录
2. 点击「开发者后台」→「创建企业自建应用」
3. 填写应用名称（如：OpenCode Remote Control）
4. 在「凭证与基础信息」获取 **App ID** 和 **App Secret**

#### 步骤 2：配置权限

在「权限管理」→「API权限」中开通：

| 权限名称 | 权限标识 |
|---------|---------|
| 获取与发送消息 | `im:message` |
| 以应用身份发消息 | `im:message:send_as_bot` |
| 接收机器人消息 | `im:message:receive_as_bot` |

#### 步骤 3：启用机器人

1. 进入「应用能力」→「机器人」
2. 开启「启用机器人」
3. 启用「机器人可主动发送消息给用户」
4. 启用「用户可与机器人进行单聊」

#### 步骤 4：配置事件订阅（关键！）

1. 进入「事件订阅」页面
2. **订阅方式**：选择「**使用长连接接收事件**」
   > ⚠️ 注意：选择「使用长连接接收事件」，不是「将事件发送至开发者服务器」
3. 点击「添加事件」，选择：
   - `im.message.receive_v1` - 接收消息
4. 保存配置

#### 步骤 5：运行配置命令

```bash
opencode-remote config
```

选择「飞书」，按提示输入 App ID 和 App Secret。

#### 步骤 6：发布应用

1. 进入「版本管理与发布」→「创建版本」
2. 填写版本号（如：1.0.0）
3. 点击「申请发布」→ 等待审核 →「发布」

---

详细配置说明请参考 [飞书配置指南](./docs/FEISHU_SETUP.md)。

### 微信配置（新功能！🎉）

微信使用官方渠道，通过扫码登录，无需内网穿透！

> ⚠️ **重要提示**：请确保微信已更新到 **最新版本**，否则无法使用机器人功能。

#### 快速开始

```bash
opencode-remote weixin
```

1. 终端会显示一个二维码 URL
2. 用微信扫描二维码
3. 在手机上确认登录
4. 凭据会自动保存，下次启动无需再次登录

#### 工作原理

微信机器人使用 **长轮询模式** 接收消息：

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  微信 App   │───▶│  Gateway     │───▶│  长轮询     │
│             │    │             │    │  (HTTPS)    │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │ 微信机器人  │
                                      │  (本地运行)  │
                                      └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  OpenCode   │
                                      │   SDK       │
                                      └─────────────┘
```

## 启动服务

配置完成后，启动机器人服务：

```bash
opencode-remote              # 启动所有已配置的机器人
opencode-remote start        # 启动所有已配置的机器人
opencode-remote telegram     # 仅启动 Telegram 机器人
opencode-remote feishu       # 仅启动飞书机器人
opencode-remote weixin       # 仅启动微信机器人
```

搞定！现在你可以通过 Telegram、飞书或微信机器人远程控制 OpenCode 了。

## 代理配置

如果你需要通过代理访问 API（例如在受限网络环境中），可以配置代理：

### 通过 CLI 参数

```bash
opencode-remote --proxy http://192.168.1.100:7890
```

### 通过环境变量

设置以下环境变量之一：

```bash
# 用于 HTTPS 请求（推荐）
export HTTPS_PROXY=http://192.168.1.100:7890

# 用于 HTTP 请求
export HTTP_PROXY=http://192.168.1.100:7890

# 所有请求的回退选项
export ALL_PROXY=http://192.168.1.100:7890
```

你也可以添加到 `.env` 文件中：

```bash
HTTPS_PROXY=http://192.168.1.100:7890
```

### 代理认证

对于需要认证的代理：

```bash
opencode-remote --proxy http://用户名:密码@192.168.1.100:7890
```

## 高级配置

### 请求超时设置

对于长时间运行的任务（如大型重构或复杂代码生成），可能需要增加请求超时时间：

```bash
opencode-remote config timeout
```

这将显示交互式提示来设置超时时间（以分钟为单位）：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⏱️  请求超时配置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  此设置控制等待 OpenCode 响应的最长时间。
  如果长时间任务出现 "fetch failed" 错误，请增加此值。

  当前超时: 30 分钟

  推荐值:
    • 30 分钟  (默认，适合大多数任务)
    • 60 分钟  (适合复杂重构)
    • 120 分钟 (适合大型项目)
```

超时设置会保存到 `~/.opencode-remote/.env`，对所有频道生效。

## 命令

```bash
opencode-remote              # 启动所有已配置的机器人
opencode-remote start        # 启动所有已配置的机器人
opencode-remote telegram     # 仅启动 Telegram 机器人
opencode-remote feishu       # 仅启动飞书机器人
opencode-remote weixin       # 仅启动微信机器人
opencode-remote config       # 配置频道（交互式选择）
opencode-remote help         # 显示帮助
```

## 从源码安装

```bash
git clone https://github.com/ceociocto/opencode-remote-control.git
cd opencode-remote-control
bun install
bun run build
node dist/cli.js
```

## 机器人命令

（Telegram、飞书和微信通用）

| 命令 | 说明 |
|--------|-------------|
| `/start` | 启动机器人 |
| `/help` | 显示所有命令 |
| `/status` | 检查连接状态 |
| `/approve` | 批准待处理的更改 |
| `/reject` | 拒绝待处理的更改 |
| `/diff` | 查看待处理的 diff |
| `/files` | 列出已更改的文件 |
| `/reset` | 重置会话 |
| `/retry` | 重试连接 |

## 工作原理

### Telegram（轮询模式）

```
┌─────────────────┐                    ┌──────────────────┐
│  Telegram App   │                    │  Telegram Server │
│   (手机)        │◀──── 消息 ────────▶│     (云端)       │
└─────────────────┘                    └────────┬─────────┘
                                                │
                     ┌──────── Polling ─────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Bot Service (本地电脑)                      │
│  ┌─────────────┐      ┌──────────────┐                  │
│  │ Telegram    │      │   Session    │                  │
│  │ Bot         │─────▶│   Manager    │                  │
│  └─────────────┘      └──────┬───────┘                  │
│                              │                          │
│                              ▼                          │
│                    ┌──────────────────┐                 │
│                    │   OpenCode SDK   │                 │
│                    └──────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

Telegram 机器人使用 **轮询模式** 主动从服务器拉取消息，无需配置隧道或公网地址。

### 飞书（长连接模式）

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

飞书机器人使用 **WebSocket 长连接模式**，无需公网 IP 或内网穿透（ngrok/cloudflared）。

## 参与贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 许可证

MIT
