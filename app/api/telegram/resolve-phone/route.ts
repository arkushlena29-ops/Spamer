export const runtime = 'nodejs';

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';

let client: TelegramClient | null = null;

async function getClient(): Promise<TelegramClient> {
  if (client && client.connected) return client;

  const session = process.env.TELEGRAM_SESSION ?? '';
  const apiId = parseInt(process.env.TELEGRAM_APP_ID ?? '0');
  const apiHash = process.env.TELEGRAM_APP_HASH ?? '';

  if (!session) throw new Error('TELEGRAM_SESSION is not set. Run: node scripts/telegram-auth.mjs');

  client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  return client;
}

export async function POST(request: Request) {
  let phone: string;
  let message: string;
  try {
    ({ phone, message } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!phone) return Response.json({ error: 'phone is required' }, { status: 400 });
  if (!message) return Response.json({ error: 'message is required' }, { status: 400 });

  try {
    const tg = await getClient();

    const result = await tg.invoke(
      new Api.contacts.ImportContacts({
        contacts: [
          new Api.InputPhoneContact({
            clientId: BigInt(Date.now()),
            phone,
            firstName: 'Temp',
            lastName: '',
          }),
        ],
      }),
    );

    if (result.users.length === 0) {
      return Response.json({ error: 'Telegram аккаунт для этого номера не найден' }, { status: 404 });
    }

    const user = result.users[0] as Api.User;

    await tg.sendMessage(user.id, { message });

    // Clean up the temporary contact
    try {
      await tg.invoke(
        new Api.contacts.DeleteContacts({
          id: [new Api.InputUser({ userId: user.id, accessHash: user.accessHash! })],
        }),
      );
    } catch {
      // Non-critical
    }

    return Response.json({ ok: true, firstName: user.firstName ?? null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
