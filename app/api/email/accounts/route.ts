export const runtime = "nodejs";

import { getAccounts, createAccount, hasPassword } from "@/lib/email-worker/accounts-store";
import { getDailyUsage } from "@/lib/email-worker/usage-store";
import type { SmtpAccount } from "@/scripts/email-dispatch/types";

export async function GET() {
  const accounts = getAccounts();
  return Response.json({
    accounts: accounts.map(acc => ({
      ...acc,
      password: undefined,
      hasPassword: hasPassword(acc.id),
    })),
    usage: getDailyUsage(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Omit<SmtpAccount, "id"> & { password?: string };
    const account = createAccount(body);
    return Response.json({ ...account, password: undefined, hasPassword: !!body.password }, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
