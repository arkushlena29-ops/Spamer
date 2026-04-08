export const runtime = "nodejs";

import { getAccounts, getPassword, setPassword, createAccount } from "@/lib/email-worker/accounts-store";
import { getDailyUsage } from "@/lib/email-worker/usage-store";
import type { SmtpAccount } from "@/scripts/email-dispatch/types";

export async function GET() {
  return Response.json({
    accounts:    getAccounts(),
    hasPassword: getPassword().length > 0,
    usage:       getDailyUsage(),   // { [accountId]: sentToday }
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Omit<SmtpAccount, "id">;
    return Response.json(createAccount(body), { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

/** PUT /api/email/accounts — update the shared password */
export async function PUT(request: Request) {
  try {
    const { password } = (await request.json()) as { password: string };
    setPassword(password ?? "");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
