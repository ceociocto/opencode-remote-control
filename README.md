# OpenCode Remote Control

[中文文档](./README_CN.md)

Control OpenCode from anywhere via Telegram.

## Installation

```bash
# Install globally with npm, pnpm, or bun
npm install -g opencode-remote-control
# or
pnpm install -g opencode-remote-control
# or
bun install -g opencode-remote-control
```

## Setup

On first run, you'll be prompted for a Telegram bot token:

1. Open Telegram, search **@BotFather**
2. Send `/newbot` and follow instructions
3. Paste the token when prompted

Token is saved to `~/.opencode-remote/.env`

## Usage

```bash
opencode-remote         # Start the bot
opencode-remote config  # Reconfigure token
opencode-remote help    # Show help
```

## Install from Source

```bash
git clone https://github.com/ceociocto/opencode-remote-control.git
cd opencode-remote-control
bun install
bun run build
node dist/cli.js
```

## Telegram Commands

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

The bot uses **Polling Mode** to fetch messages from Telegram servers, requiring no tunnel or public IP configuration.

## Requirements

- Node.js >= 18.0.0
- [OpenCode](https://github.com/opencode-ai/opencode) installed
- Telegram account

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
