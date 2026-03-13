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

export { config, saveConfig, loadConfig, resolveProjectDir };
