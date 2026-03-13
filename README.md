# WhatsClaude

Connect your WhatsApp to Claude CLI. Send a WhatsApp message, get a response from Claude — as if you typed it in your terminal.

## Prerequisites

- **Node.js** 18+
- **Claude CLI** installed and authenticated (`npm install -g @anthropic-ai/claude-code`, then run `claude` once to authenticate)
- **WhatsApp** on your phone

## Quick Start

```bash
git clone https://github.com/sisiphamus/whatsclaude.git
cd whatsclaude
npm install

# Tell WhatsClaude which project directory Claude should work in:
npm start -- --project /path/to/your/project
```

1. A QR code will appear in your terminal
2. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
3. Scan the QR code
4. A WhatsApp group named after your project folder is automatically created
5. Open that group and send a message — Claude will respond, working in your project directory

## Setting the Project Directory

WhatsClaude needs to know which folder Claude should operate in. This is the repo or directory where Claude will read/write files.

**Option A — CLI argument** (recommended for quick use):
```bash
npm start -- --project ~/Code/my-app
```

**Option B — config.json** (persistent):
```json
{
  "projectDir": "/home/user/Code/my-app"
}
```

Save as `config.json` in the whatsclaude root, then just run `npm start`.

The CLI argument takes priority over config.json if both are set.

## How It Works

```
WhatsApp message → Baileys (WhatsApp Web protocol) → Claude CLI (in your project dir) → Response → WhatsApp reply
```

- Uses [Baileys](https://github.com/WhiskeySockets/Baileys) to connect to WhatsApp Web
- On first connect, creates a WhatsApp group named after your project folder (e.g., `my-app`)
- Only messages in that group trigger Claude — your other chats are untouched
- Incoming messages are piped to your local `claude --print` command
- Claude runs in your specified project directory, so it has full context of your codebase
- Claude's response is sent back as a WhatsApp reply
- Images are downloaded and passed to Claude for analysis
- Messages are queued to survive crashes
- If you change `--project`, the group is automatically renamed to match

## Configuration

Create a `config.json` in the project root to customize:

```json
{
  "projectDir": "/path/to/your/project",
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
| `projectDir` | `""` | **Required.** Directory where Claude CLI runs (your project repo) |
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
npm start -- --project /path/to/your/project
```

## License

MIT
