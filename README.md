# OpenCode Remote Control

Control OpenCode from anywhere via Telegram or Feishu.

## Features

- **Chat with OpenCode** — Send prompts from Telegram, get responses streamed back
- **Thread-based sessions** — Each thread maintains its own context
- **Approval workflow** — Review diffs and approve/reject file edits from chat
- **Push notifications** — Get notified when tasks complete or fail

## Quick Start

### 1. Create a Telegram Bot

1. Open Telegram and search for @BotFather
2. Send `/newbot` and follow the instructions
3. Copy the bot token

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your TELEGRAM_BOT_TOKEN
```

### 4. Start the Bot

```bash
bun run dev
```

### 5. Set Up Cloudflare Tunnel (for webhooks)

```bash
cloudflared tunnel --url http://localhost:3000
# Copy the tunnel URL to TUNNEL_URL in .env
```

## Commands

| Command | Description |
|--------|-------------|
| `/start` | Start the bot, show welcome message |
| `/help` | Show all available commands |
| `/status` | Check connection and session status |
| `/approve` | Approve pending file changes |
| `/reject` | Reject pending file changes |
| `/diff` | View the diff of pending changes |
| `/files` | List all changed files |
| `/reset` | Reset the current session |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Telegram/Feishu│     │   Cloudflare     │
│     (Cloud)     │────▶│     Tunnel       │
└─────────────────┘     └────────┬─────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────┐
│           Bot Service (Local)               │
│  ┌─────────────┐    ┌──────────────────┐   │
│  │ Telegram    │    │ Feishu           │   │
│  │ Handler     │    │ Handler          │   │
│  └──────┬──────┘    └────────┬─────────┘   │
│         │                    │             │
│         ▼                    ▼             │
│  ┌─────────────────────────────────────┐   │
│  │         Session Manager             │   │
│  └──────────────────┬──────────────────┘   │
│                     │                       │
│                     ▼                       │
│  ┌─────────────────────────────────────┐   │
│  │         OpenCode SDK                │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Project Structure

```
opencode-remote-control/
├── src/
│   ├── index.ts              # Entry point
│   ├── telegram/
│   │   └── bot.ts            # Telegram bot implementation
│   ├── core/
│   │   ├── types.ts          # Types and config
│   │   ├── session.ts        # Session management
│   │   ├── approval.ts       # Approval workflow
│   │   ├── notifications.ts  # Message formatting
│   │   └── handler-common.ts # Shared handler logic
│   └── opencode/
│       └── client.ts         # OpenCode SDK integration (TODO)
├── tests/
│   ├── mocks/
│   │   └── opencode-sdk.ts  # Mock SDK for testing
│   ├── session.test.ts
│   └── approval.test.ts
├── .env.example
├── package.json
└── README.md
```

## Status

- [x] Telegram bot MVP working
- [x] Session management
- [x] Approval workflow
- [ ] OpenCode SDK integration (TODO - needs research)
- [ ] Feishu support (Phase 2)

## License

MIT
