import { config } from './config.js';
import { executeClaudePrompt } from './claude.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'tmp', 'images');

// --- Rate limiting ---

const rateLimitMap = new Map();

function isRateLimited(jid) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(jid) || [];
  const recent = timestamps.filter((t) => now - t < 60000);
  rateLimitMap.set(jid, recent);
  return recent.length >= config.rateLimitPerMinute;
}

function recordMessage(jid) {
  const timestamps = rateLimitMap.get(jid) || [];
  timestamps.push(Date.now());
  rateLimitMap.set(jid, timestamps);
}

// --- Access control ---

function isAllowed(jid) {
  if (config.allowAllNumbers) return true;
  const number = jid.replace(/@.*/, '');
  return config.allowedNumbers.some((n) => number.includes(n.replace(/\D/g, '')));
}

// --- Prompt extraction ---

function extractPrompt(text) {
  if (!text) return null;
  if (config.prefix && text.startsWith(config.prefix)) {
    return text.slice(config.prefix.length).trim();
  }
  if (!config.prefix) return text.trim();
  return null;
}

// --- Image download ---

async function downloadWhatsAppImage(message) {
  const imageMsg =
    message.message?.imageMessage ||
    message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
  if (!imageMsg) return null;

  try {
    mkdirSync(IMAGES_DIR, { recursive: true });
    const stream = await downloadContentFromMessage(imageMsg, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const ext = (imageMsg.mimetype || 'image/jpeg').includes('png') ? 'png' : 'jpg';
    const filename = `wa_${randomBytes(4).toString('hex')}.${ext}`;
    const filepath = join(IMAGES_DIR, filename);
    writeFileSync(filepath, buffer);
    return filepath;
  } catch (err) {
    console.log('[handler:image_download_error]', err.message);
    return null;
  }
}

// --- Main message handler ---

/**
 * Processes an incoming WhatsApp message.
 * Returns { response, sender, jid } or null if the message should be ignored.
 */
export async function handleMessage(message) {
  const jid = message.key.remoteJid;
  if (!jid || jid === 'status@broadcast') return null;

  // Extract text from various message types
  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    null;

  const hasImage = !!(message.message?.imageMessage);

  // Need either text or an image
  if (!text && !hasImage) return null;

  // Extract prompt (strip prefix if configured)
  const prompt = extractPrompt(text || (hasImage ? 'What is this image?' : null));
  if (!prompt) return null;

  const sender = message.pushName || jid.replace(/@.*/, '');

  // Access control
  if (!isAllowed(jid)) {
    console.log(`[handler:blocked] ${sender} (${jid}) not in allowed list`);
    return null;
  }

  // Rate limiting
  if (isRateLimited(jid)) {
    return { response: 'Rate limited. Please wait a moment.', sender, jid };
  }
  recordMessage(jid);

  // Build final prompt — prepend image path if present
  let finalPrompt = prompt;
  if (hasImage) {
    const imagePath = await downloadWhatsAppImage(message);
    if (imagePath) {
      finalPrompt = `[The user sent an image at: ${imagePath}]\n\n${finalPrompt}`;
    }
  }

  // Execute via Claude CLI
  try {
    console.log(`[handler] ${sender}: ${finalPrompt.slice(0, 100)}...`);
    const response = await executeClaudePrompt(finalPrompt);
    console.log(`[handler] Response: ${response.length} chars`);
    return { response, sender, jid };
  } catch (err) {
    console.error('[handler:claude_error]', err.message);
    return { response: `Error: ${err.message}`, sender, jid };
  }
}
