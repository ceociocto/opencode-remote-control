# OpenCode Remote Control

[English](./README.md)

通过 Telegram 或飞书远程控制 OpenCode。

## 系统要求

- Node.js >= 18.0.0
- 已安装 [OpenCode](https://github.com/opencode-ai/opencode) 且在 PATH 中可用
- Telegram 账号（用于 Telegram 机器人）
- 飞书账号（用于飞书机器人）
- **无需** ngrok 或 cloudflared（飞书使用 WebSocket 长连接）

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

选择 **Telegram** 或 **飞书**，按交互式指南操作。

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
| 获取与发送单聊、群组消息 | `im:message` |
| 以应用身份发消息 | `im:message:send_as_bot` |
| 接收群聊中@机器人消息 | `im:message:receive_as_bot` |

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

## 启动服务

配置完成后，启动机器人服务：

```bash
opencode-remote
```

搞定！现在你可以通过 Telegram 或飞书机器人远程控制 OpenCode 了。

## 命令

```bash
opencode-remote              # 启动所有已配置的机器人
opencode-remote start        # 启动所有已配置的机器人
opencode-remote telegram     # 仅启动 Telegram 机器人
opencode-remote feishu       # 仅启动飞书机器人
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

（Telegram 和飞书通用）

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
│   (手机)        │◀────── 消息 ──────▶│     (云端)       │
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
