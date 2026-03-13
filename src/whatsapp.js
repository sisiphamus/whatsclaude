import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestWaWebVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import { writeFileSync, mkdirSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { handleMessage } from './handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUEUE_DIR = join(__dirname, '..', 'message-queue');
mkdirSync(QUEUE_DIR, { recursive: true });

// --- Message queue (crash resilience) ---

function enqueueMessage(msg) {
  const file = join(QUEUE_DIR, `${msg.key.id}.json`);
  writeFileSync(file, JSON.stringify({ msg, enqueuedAt: Date.now() }));
}

function dequeueMessage(msgId) {
  try { unlinkSync(join(QUEUE_DIR, `${msgId}.json`)); } catch {}
}

function getPendingMessages() {
  try {
    return readdirSync(QUEUE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(QUEUE_DIR, f), 'utf-8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  } catch { return []; }
}

// --- Connection state ---

const logger = pino({ level: 'silent' });

let sock = null;
let reconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const seenTimestampKeys = new Set();
const botSentIds = new Set();
const processingIds = new Set();

// Message store for getMessage callback (needed for sender key retries)
const messageStore = new Map();
const MAX_STORE_SIZE = 5000;

function storeMessage(id, message) {
  messageStore.set(id, message);
  if (messageStore.size > MAX_STORE_SIZE) {
    const firstKey = messageStore.keys().next().value;
    messageStore.delete(firstKey);
  }
}

// --- Send with retry ---

async function sendWithRetry(jid, content, opts, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const sent = await sock.sendMessage(jid, content, opts);
      return sent;
    } catch (err) {
      console.log(`[wa:send] attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// --- Main WhatsApp connection ---

export async function startWhatsApp() {
  mkdirSync(config.authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

  let version;
  try {
    const result = await fetchLatestWaWebVersion({});
    version = result.version;
    console.log(`[wa] Using WhatsApp Web version: ${version.join('.')}`);
  } catch {
    version = [2, 3000, 1033498124];
    console.log(`[wa] Using fallback WhatsApp Web version: ${version.join('.')}`);
  }

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    version,
    browser: Browsers.windows('Chrome'),
    logger,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 15_000,
    retryRequestDelayMs: 250,
    getMessage: async (key) => {
      return messageStore.get(key.id) || undefined;
    },
  });

  sock.ev.on('creds.update', async () => {
    try { await saveCreds(); }
    catch (err) { console.log('[wa] Failed to save creds:', err.message); }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      QRCode.toString(qr, { type: 'terminal', small: true }, (err, str) => {
        if (!err) {
          console.log('\n========================================');
          console.log('  Scan this QR code with WhatsApp:');
          console.log('========================================\n');
          console.log(str);
        }
      });
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[wa] Disconnected (status: ${statusCode}, reconnect: ${shouldReconnect})`);

      if (shouldReconnect && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempt++;
        const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempt - 1), 30000);
        console.log(`[wa] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(startWhatsApp, delay);
      } else if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        console.log('[wa] Max reconnection attempts reached. Restart the server to try again.');
      } else {
        console.log('[wa] Logged out. Delete auth_state/ folder and restart to re-authenticate.');
      }
    }

    if (connection === 'open') {
      reconnectAttempt = 0;
      seenTimestampKeys.clear();
      processingIds.clear();
      console.log('[wa] Connected!');
      console.log('[wa] Connected as:', JSON.stringify(sock.user));

      // Drain any messages left in queue from a previous crash
      const pending = getPendingMessages();
      if (pending.length > 0) {
        console.log(`[wa:queue] Draining ${pending.length} pending message(s)`);
        for (const { msg } of pending) {
          sock.ev.emit('messages.upsert', { messages: [msg], type: 'notify' });
        }
      }
    }
  });

  sock.ev.on('messages.upsert', (upsert) => {
    if (upsert.type !== 'notify') return;
    const messages = upsert.messages || [];

    for (const msg of messages) {
      const msgId = msg.key.id;

      // Skip messages we sent
      if (botSentIds.has(msgId)) {
        botSentIds.delete(msgId);
        continue;
      }

      // Timestamp-based dedup
      const ts = (msg.messageTimestamp?.low || msg.messageTimestamp || 0);
      const tsKey = `${msg.key.remoteJid}:${ts}`;
      if (seenTimestampKeys.has(tsKey)) continue;
      seenTimestampKeys.add(tsKey);

      // Processing dedup
      if (processingIds.has(msgId)) continue;
      processingIds.add(msgId);

      // Skip system messages
      if (msg.messageStubType) continue;

      // Skip messages with no content (decryption failure)
      if (!msg.message) {
        const failJid = msg.key.remoteJid;
        if (failJid && failJid !== 'status@broadcast') {
          sock.sendMessage(failJid, {
            text: '\u26a0\ufe0f Couldn\'t read that message (decryption issue). Please send it again.',
          }).catch(() => {});
        }
        continue;
      }

      // Store incoming messages for getMessage callback
      storeMessage(msgId, msg.message);

      // Skip self-sent messages in DMs (allow in groups for self-messaging)
      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid?.endsWith('@g.us');
      if (msg.key.fromMe && !isGroup) continue;

      // Persist to queue before processing
      enqueueMessage(msg);

      // Process message concurrently
      (async () => {
        const jid = msg.key.remoteJid;

        // Show typing indicator
        try {
          await sock.sendMessage(jid, { react: { key: msg.key, text: '\u23f3' } });
        } catch {}

        try {
          const result = await handleMessage(msg);

          // null = message was filtered (not allowed, no text, etc.) — skip silently
          if (result === null) {
            return;
          }

          if (!result.response) {
            try {
              const sent = await sendWithRetry(jid, {
                text: 'Something went wrong \u2014 I didn\'t get a response. Try again?',
              }, { quoted: msg });
              if (sent?.key?.id) { botSentIds.add(sent.key.id); storeMessage(sent.key.id, sent.message); }
            } catch {}
          } else {
            // Send response in chunks (WhatsApp has ~4000 char practical limit)
            const response = result.response;
            const quoteOpts = { quoted: msg };
            for (let i = 0; i < response.length; i += config.maxResponseLength) {
              const chunk = response.slice(i, i + config.maxResponseLength);
              const sent = await sendWithRetry(jid, { text: chunk }, quoteOpts);
              if (sent?.key?.id) {
                botSentIds.add(sent.key.id);
                storeMessage(sent.key.id, sent.message);
              }
            }
          }
        } catch (err) {
          console.error('[wa:handler_error]', err.message);
          try {
            const sent = await sendWithRetry(jid, {
              text: `Something went wrong: ${err.message}`,
            }, { quoted: msg });
            if (sent?.key?.id) { botSentIds.add(sent.key.id); storeMessage(sent.key.id, sent.message); }
          } catch {}
        } finally {
          dequeueMessage(msgId);
          processingIds.delete(msgId);
          // Remove reaction
          sock.sendMessage(jid, { react: { key: msg.key, text: '' } }).catch(() => {});
        }
      })().catch(err => console.error('[wa:unhandled]', err));
    }
  });

  return sock;
}
