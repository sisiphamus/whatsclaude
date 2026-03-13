import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config.json');

const defaults = {
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

export { config, saveConfig, loadConfig };
