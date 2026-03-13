# WhatsClaude

Send a WhatsApp message, get a response from Claude. It runs on your machine, uses your Claude CLI, and works in whatever project directory you point it at.

## What you need

- **Node.js** 18 or newer
- **Claude CLI** installed and logged in. If you haven't done this yet:
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude  # run once to authenticate
  ```
- **WhatsApp** on your phone

## Setup

```bash
git clone https://github.com/sisiphamus/whatsclaude.git
cd whatsclaude
npm install
npm start -- --project /path/to/your/project
```

That `--project` flag is how you tell Claude which folder to work in. If you're working on a React app at `~/Code/my-app`, use that path. Claude will have full context of that codebase when responding.

## What happens next

1. A QR code shows up in your terminal
2. On your phone: WhatsApp → Settings → Linked Devices → Link a Device → scan it
3. WhatsClaude creates a WhatsApp group named after your project folder (so if your project is `my-app`, the group is called "my-app")
4. Open that group on your phone and send a message
5. Claude responds right there in the chat

Only messages in that group go to Claude. Your other conversations are left alone.

## How it actually works

```
You send a WhatsApp message
    → Baileys (WhatsApp Web library) picks it up
    → Your message gets piped to `claude --print` running in your project directory
    → Claude's response comes back
    → Gets sent as a WhatsApp reply
```

Baileys is the library that connects to WhatsApp Web. It's the same protocol the WhatsApp desktop app uses. You're linking a device to your account, same as you would with WhatsApp Web on a browser.

Images work too. Send a photo and Claude will analyze it.

If the server crashes mid-message, the message is queued to disk and retried when you restart.

## Picking the project directory

You need to tell WhatsClaude where Claude should run. Two ways:

**Pass it as a flag** (good for switching between projects):
```bash
npm start -- --project ~/Code/my-app
```

**Put it in config.json** (good if you always use the same project):
```json
{
  "projectDir": "/home/user/Code/my-app"
}
```

Save that file in the whatsclaude root directory. Then you can just run `npm start`.

The flag wins if you set both.

If you change the project directory, the WhatsApp group renames itself to match.

## Configuration

Create a `config.json` in the project root if you want to change anything:

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

Most of these you can leave alone. The ones worth knowing about:

- **projectDir** -- where Claude runs. Required.
- **prefix** -- if you set this to something like `"!claude "`, only messages starting with that prefix will trigger Claude. Useful if other people are in the group and you don't want every message going to Claude.
- **allowedNumbers** -- phone number whitelist. Only matters if you set `allowAllNumbers` to `false`.
- **messageTimeout** -- how long to wait for Claude before giving up, in milliseconds. Default is 2 minutes.

## If you get logged out

Delete the `auth_state/` folder and start over:

```bash
rm -rf auth_state/
npm start -- --project /path/to/your/project
```

You'll get a new QR code to scan.

## Architecture

If you want to poke around the code:

```
src/
  index.js      -- entry point, validates setup, starts everything
  whatsapp.js   -- Baileys connection, QR auth, group creation, message routing
  handler.js    -- extracts text/images from messages, rate limiting, calls Claude
  claude.js     -- spawns `claude --print` as a subprocess, returns the output
  config.js     -- loads config.json, parses CLI args
```

`whatsapp.js` receives messages from Baileys, hands them to `handler.js`, which calls `claude.js`, and the response goes back through `whatsapp.js` to WhatsApp. Not much to it.

Messages are deduplicated by timestamp and ID (Baileys sometimes fires the same message twice). Bot-sent message IDs are tracked to prevent infinite loops. There's a message queue on disk so nothing gets lost if the process dies mid-response.

## License

MIT
