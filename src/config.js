import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config.json');

const defaults = {
  // Project directory — where Claude CLI runs (the repo you want Claude to work in)
  projectDir: '',

  // Claude CLI settings
  claudeCommand: 'claude',
  claudeArgs: ['--print'],

  // WhatsApp settings
  allowedNumbers: [],
  allowAllNumbers: true,
  prefix: '',
  rateLimitPerMinute: 10,
  maxResponseLength: 4000,
  messageTimeout: 120000,

  // Group
  groupJid: '',

  // Auth
  authDir: join(__dirname, '..', 'auth_state'),
};

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      const file = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      return { ...defaults, ...file };
    } catch {
      return { ...defaults };
    }
  }
  return { ...defaults };
}

function saveConfig(cfg) {
  const toSave = { ...cfg };
  delete toSave.authDir;
  const tmpPath = CONFIG_PATH + `.tmp.${randomBytes(4).toString('hex')}`;
  writeFileSync(tmpPath, JSON.stringify(toSave, null, 2));
  renameSync(tmpPath, CONFIG_PATH);
}

const config = loadConfig();

/**
 * Parse --project CLI argument. Supports:
 *   npm start -- --project /path/to/dir
 *   node src/index.js --project /path/to/dir
 */
function parseProjectDirArg() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--project');
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return null;
}

/**
 * Resolve the project directory. Priority:
 * 1. --project CLI arg
 * 2. config.json projectDir
 * 3. null (not set)
 */
function resolveProjectDir() {
  const cliDir = parseProjectDirArg();
  if (cliDir) return resolve(cliDir);
  if (config.projectDir) return resolve(config.projectDir);
  return null;
}

/**
 * Interactively prompt the user for a project directory, validate it, and save to config.json.
 * Returns the resolved absolute path.
 */
async function promptForProjectDir() {
  const { createInterface } = await import('readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const ask = (q) => new Promise((res) => rl.question(q, res));

  console.log('\n  ┌─────────────────────────────────────────┐');
  console.log('  │          WhatsClaude Setup               │');
  console.log('  └─────────────────────────────────────────┘\n');
  console.log('  No project directory configured yet.');
  console.log('  Enter the folder where Claude should work\n');

  let dir = '';
  while (!dir) {
    const input = (await ask('  Project path: ')).trim();
    if (!input) {
      console.log('  ⚠  Path cannot be empty.\n');
      continue;
    }
    const resolved = resolve(input);
    if (!existsSync(resolved)) {
      console.log(`  ⚠  Directory not found: ${resolved}\n`);
      continue;
    }
    dir = resolved;
  }

  rl.close();

  // Save to config.json so they never need to enter it again
  const updated = { ...loadConfig(), projectDir: dir };
  saveConfig(updated);
  console.log(`\n  ✓ Saved to config.json: ${dir}\n`);
  return dir;
}

export { config, saveConfig, loadConfig, resolveProjectDir, promptForProjectDir };
