# OpenCode Remote Control

<p align="center">
  <a href="https://github.com/ceociocto/opencode-remote-control/actions/workflows/publish.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/ceociocto/opencode-remote-control/publish.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/opencode-remote-control"><img src="https://img.shields.io/npm/v/opencode-remote-control?style=for-the-badge" alt="npm version"></a>
  <a href="https://github.com/ceociocto/opencode-remote-control/releases"><img src="https://img.shields.io/github/v/release/ceociocto/opencode-remote-control?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <a href="./README_CN.md">中文文档</a>
</p>

<p align="center">
  Control OpenCode from anywhere via Telegram or Feishu.
</p>

## Requirements

- Node.js >= 18.0.0
- [OpenCode](https://github.com/opencode-ai/opencode) installed and accessible in PATH
- Telegram account (for Telegram bot)
- Feishu account (for Feishu bot)
- ngrok or cloudflared (for Feishu webhook)

### Verify OpenCode Installation

Before starting, make sure OpenCode is installed and accessible:

```bash
opencode --version
```

If you see `command not found`, install OpenCode first:

```bash
npm install -g @opencode-ai/opencode
```

## Installation

```bash
# Install globally with npm, pnpm, or bun
npm install -g opencode-remote-control@latest
# or
pnpm install -g opencode-remote-control@latest
# or
bun install -g opencode-remote-control@latest
```

## Configuration

Run the config command to set up your preferred channel:

```bash
opencode-remote config
```

Select **Telegram** or **Feishu** and follow the interactive guide.

### Telegram Setup

1. Open Telegram, search **@BotFather**
2. Send `/newbot` and follow instructions
3. Paste the token when prompted

Token is saved to `~/.opencode-remote/.env`

### Feishu Setup

For detailed Feishu setup instructions, see [Feishu Setup Guide](./docs/FEISHU_SETUP_EN.md) or [飞书配置指南](./docs/FEISHU_SETUP.md).

## Start Service

Once configured, start the bot service:

```bash
opencode-remote
```

That's it! You can now send messages to your Telegram bot or Feishu bot to control OpenCode remotely.

## Usage

```bash
opencode-remote              # Start all configured bots
opencode-remote start        # Start all configured bots
opencode-remote telegram     # Start Telegram bot only
opencode-remote feishu       # Start Feishu bot only
opencode-remote config       # Configure a channel (interactive)
opencode-remote help         # Show help
```

## Install from Source

```bash
git clone https://github.com/ceociocto/opencode-remote-control.git
cd opencode-remote-control
bun install
bun run build
node dist/cli.js
```

## Bot Commands

Both Telegram and Feishu support the same commands:

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
| `/retry` | Retry connection |

## How It Works

### Telegram (Polling Mode)

```
┌─────────────────┐                    ┌──────────────────┐
│  Telegram App   │                    │  Telegram Server │
│   (Mobile)      │◀──── Messages ────▶│     (Cloud)      │
└─────────────────┘                    └────────┬─────────┘
                                                │
                     ┌──────── Polling ─────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Bot Service (Local Machine)                │
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

The Telegram bot uses **Polling Mode** to fetch messages from Telegram servers, requiring no tunnel or public IP configuration.

### Feishu (Webhook Mode)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Feishu     │───▶│  Feishu     │───▶│   Webhook   │
│  Client     │    │  Server     │    │  (ngrok)    │
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

The Feishu bot uses **Webhook Mode** and requires a tunnel (ngrok/cloudflared) to receive messages.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
