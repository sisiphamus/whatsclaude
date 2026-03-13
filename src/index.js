process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { startWhatsApp } from './whatsapp.js';
import { resolveProjectDir, promptForProjectDir } from './config.js';

// --- Startup validation ---

// 1. Check project directory — prompt interactively if not set
let projectDir = resolveProjectDir();
if (!projectDir) {
  projectDir = await promptForProjectDir();
}

if (!existsSync(projectDir)) {
  console.error(`\n  ERROR: Project directory does not exist: ${projectDir}\n`);
  process.exit(1);
}

// 2. Check Claude CLI is available
let claudeVersion = 'unknown';
try {
  claudeVersion = execFileSync('claude', ['--version'], {
    shell: true,
    timeout: 10000,
    encoding: 'utf-8',
  }).trim();
} catch (err) {
  console.error('\n  ERROR: Claude CLI not found.\n');
  console.error('  Install it with:');
  console.error('    npm install -g @anthropic-ai/claude-code\n');
  console.error('  Then authenticate by running:');
  console.error('    claude\n');
  process.exit(1);
}

// --- Startup banner ---

console.log('');
console.log('  \x1b[32m██╗    ██╗██╗  ██╗ █████╗ ████████╗███████╗\x1b[0m');
console.log('  \x1b[32m██║    ██║██║  ██║██╔══██╗╚══██╔══╝██╔════╝\x1b[0m');
console.log('  \x1b[32m██║ █╗ ██║███████║███████║   ██║   ███████╗\x1b[0m');
console.log('  \x1b[32m██║███╗██║██╔══██║██╔══██║   ██║   ╚════██║\x1b[0m');
console.log('  \x1b[32m╚███╔███╔╝██║  ██║██║  ██║   ██║   ███████║\x1b[0m');
console.log('  \x1b[32m ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝\x1b[0m');
console.log('  \x1b[38;5;208m   ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗\x1b[0m');
console.log('  \x1b[38;5;208m  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝\x1b[0m');
console.log('  \x1b[38;5;208m  ██║     ██║     ███████║██║   ██║██║  ██║█████╗  \x1b[0m');
console.log('  \x1b[38;5;208m  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  \x1b[0m');
console.log('  \x1b[38;5;208m  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗\x1b[0m');
console.log('  \x1b[38;5;208m   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝\x1b[0m');
console.log('');
console.log('  \x1b[38;5;208m💬 WhatsApp ↔ Claude, right from your phone\x1b[0m');
console.log('');
console.log(`  \x1b[2m📂 Project:\x1b[0m  ${projectDir}`);
console.log(`  \x1b[2m🤖 Claude:\x1b[0m   ${claudeVersion}`);
console.log('');

try {
  console.log('  \x1b[32m⚡ Connecting to WhatsApp...\x1b[0m\n');
  startWhatsApp();
} catch (err) {
  console.error('[startup] Failed:', err);
  process.exit(1);
}
