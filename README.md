# WhatsClaude

Connect your WhatsApp to Claude CLI. Send a WhatsApp message, get a response from Claude — as if you typed it in your terminal.

## Prerequisites

- **Node.js** 18+
- **Claude CLI** installed and authenticated (`npm install -g @anthropic-ai/claude-code`, then run `claude` once to authenticate)
- **WhatsApp** on your phone

## Quick Start

```bash
git clone https://github.com/towneadamm/whatsclaude.git
cd whatsclaude
npm install
npm start
```

1. A QR code will appear in your terminal
2. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
3. Scan the QR code
4. Send a message to any chat — Claude will respond

## How It Works

```
WhatsApp message → Baileys (WhatsApp Web protocol) → Claude CLI → Response → WhatsApp reply
```

- Uses [Baileys](https://github.com/WhiskeySockets/Baileys) to connect to WhatsApp Web
- Incoming messages are piped to your local `claude --print` command
- Claude's response is sent back as a WhatsApp reply
- Images are downloaded and passed to Claude for analysis
- Messages are queued to survive crashes

## Configuration

Create a `config.json` in the project root to customize:

```json
{
  "claudeCommand": "claude",
  "claudeArgs": ["--print"],
  "allowAllNumbers": true,
  "allowedNumbers": [],
  "prefix": "",
  "rateLimitPerMinute": 10,
  "maxResponseLength": 4000,
  "messageTimeout": 120000
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `claudeCommand` | `"claude"` | Path to Claude CLI binary |
| `claudeArgs` | `["--print"]` | Arguments passed to Claude CLI |
| `allowAllNumbers` | `true` | Accept messages from anyone |
| `allowedNumbers` | `[]` | Whitelist of phone numbers (if `allowAllNumbers` is false) |
| `prefix` | `""` | Required prefix for messages (e.g., `"!claude "`) |
| `rateLimitPerMinute` | `10` | Max messages per minute per sender |
| `maxResponseLength` | `4000` | Max chars per WhatsApp message chunk |
| `messageTimeout` | `120000` | Claude CLI timeout in ms |

## Re-authenticating

If you get logged out, delete the `auth_state/` folder and restart:

```bash
rm -rf auth_state/
npm start
```

## License

MIT
