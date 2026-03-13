process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

import { startWhatsApp } from './whatsapp.js';

console.log('\n  WhatsClaude');
console.log('  WhatsApp <-> Claude CLI Bridge');
console.log('  ────────────────────────────────\n');

try {
  console.log('  Starting WhatsApp connection...\n');
  startWhatsApp();
} catch (err) {
  console.error('[startup] Failed:', err);
  process.exit(1);
}
