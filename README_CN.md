# OpenCode Remote Control

[English](./README.md)

通过 Telegram 远程控制 OpenCode。

## 安装

```bash
# 使用 npm、pnpm 或 bun 全局安装
npm install -g opencode-remote-control
# 或
pnpm install -g opencode-remote-control
# 或
bun install -g opencode-remote-control

# 运行（首次运行会提示输入 token）
opencode-remote
```

### 从源码安装

```bash
git clone https://github.com/ceociocto/opencode-remote-control.git
cd opencode-remote-control
bun install
bun run build
node dist/cli.js
```

## 配置

首次运行时，会提示输入 Telegram 机器人 token：

1. 打开 Telegram，搜索 **@BotFather**
2. 发送 `/newbot` 并按提示操作
3. 将获取的 token 粘贴到提示中

Token 会保存到 `~/.opencode-remote/.env`

## 命令

**命令行：**
```
opencode-remote         # 启动机器人
opencode-remote config  # 重新配置 token
opencode-remote help    # 显示帮助
```

**Telegram：**
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

## 工作原理

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

机器人使用 **Polling 模式** 主动从 Telegram 服务器拉取消息，无需配置 tunnel 或公网地址。

## 系统要求

- Node.js >= 18.0.0
- 已安装 [OpenCode](https://github.com/opencode-ai/opencode)
- Telegram 账号

## 参与贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 许可证

MIT
