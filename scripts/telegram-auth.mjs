/**
 * One-time script to generate a Telegram session string.
 * Run: node scripts/telegram-auth.mjs
 * Then copy the printed session string into .env.local as TELEGRAM_SESSION=
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import readline from 'readline';

const API_ID = 29624501;
const API_HASH = '30e0923c87eb3d01468452d3c8deb3aa';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((resolve) => rl.question(q, resolve));

const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: () => question('Your Telegram phone number (e.g. +380971234567): '),
  password: () => question('2FA password (press Enter if none): '),
  phoneCode: () => question('SMS code: '),
  onError: (err) => console.error('Auth error:', err.message),
});

const sessionString = client.session.save();
console.log('\n✅ Session generated. Add this to .env.local:\n');
console.log(`TELEGRAM_SESSION=${sessionString}`);
console.log();

rl.close();
await client.disconnect();
