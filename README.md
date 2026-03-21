# OpenCode Remote Control

Control OpenCode from anywhere via Telegram.

## Installation

### Option 1: Install via npm (Recommended)

```bash
# Install Bun if not installed
curl -fsSL https://bun.sh/install | bash

# Install globally
bun install -g opencode-remote-control

# Run (will prompt for token on first run)
opencode-remote
```

### Option 2: Install from source

```bash
git clone https://github.com/ceociocto/opencode-remote-control.git
cd opencode-remote-control
bun install
bun run dev
```

## Setup

On first run, you'll be prompted for a Telegram bot token:

1. Open Telegram, search **@BotFather**
2. Send `/newbot` and follow instructions
3. Paste the token when prompted

Token is saved to `~/.opencode-remote/.env`

## Commands

**CLI:**
```
opencode-remote         # Start the bot
opencode-remote config  # Reconfigure token
opencode-remote help    # Show help
```

**Telegram:**
| Command | Description |
|--------|-------------|
| `/start` | Start the bot |
| `/help` | Show all commands |
| `/status` | Check connection status |
| `/approve` | Approve pending changes |
| `/reject` | Reject pending changes |
| `/diff` | View pending diff |
| `/files` | List changed files |
| `/reset` | Reset session |

## How It Works

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

Bot 使用 **Polling 模式** 主动从 Telegram 服务器拉取消息，无需配置 tunnel 或公网地址。

## Requirements

- [Bun](https://bun.sh) runtime
- [OpenCode](https://github.com/opencode-ai/opencode) installed
- Telegram account

## License

MIT
