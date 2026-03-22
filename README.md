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
- **No** ngrok or cloudflared required (Feishu uses WebSocket long connection)

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

Feishu uses **WebSocket Long Connection Mode** - no public IP or tunnel required!

#### Step 1: Create Feishu App

1. Visit [Feishu Open Platform](https://open.feishu.cn/) and login
2. Go to "Developer Console" → "Create Enterprise App"
3. Get **App ID** and **App Secret** from "Credentials & Basic Info"

#### Step 2: Configure Permissions

Go to "Permission Management" → "API Permissions" and enable:

| Permission | ID |
|------------|---|
| Get and send messages | `im:message` |
| Send messages as bot | `im:message:send_as_bot` |
| Receive bot messages | `im:message:receive_as_bot` |

#### Step 3: Enable Bot

1. Go to "App Capabilities" → "Bot"
2. Enable "Enable Bot"
3. Enable "Bot can proactively send messages to users"
4. Enable "Users can have private chats with bot"

#### Step 4: Configure Event Subscription (Critical!)

1. Go to "Event Subscription" page
2. **Subscription Method**: Select "**Use long connection to receive events**"
   > ⚠️ Important: Choose "Use long connection to receive events", NOT "Send events to developer server"
3. Click "Add Event" and select:
   - `im.message.receive_v1` - Receive messages
4. Save configuration

#### Step 5: Run Config Command

```bash
opencode-remote config
```

Select "Feishu" and enter your App ID and App Secret.

#### Step 6: Publish App

1. Go to "Version Management & Publishing"
2. Create version → Request publishing → Publish

---

For detailed setup instructions, see [Feishu Setup Guide](./docs/FEISHU_SETUP_EN.md) or [飞书配置指南](./docs/FEISHU_SETUP.md).

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

### Feishu (Long Connection Mode)

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

The Feishu bot uses **WebSocket Long Connection Mode** - no public IP or tunnel (ngrok/cloudflared) required!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
