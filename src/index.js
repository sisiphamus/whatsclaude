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

console.log('\n  WhatsClaude');
console.log('  WhatsApp <-> Claude CLI Bridge');
console.log('  ────────────────────────────────');
console.log(`  Project:  ${projectDir}`);
console.log(`  Claude:   ${claudeVersion}`);
console.log('  ────────────────────────────────\n');

try {
  console.log('  Starting WhatsApp connection...\n');
  startWhatsApp();
} catch (err) {
  console.error('[startup] Failed:', err);
  process.exit(1);
}
