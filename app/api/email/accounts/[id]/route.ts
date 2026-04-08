export const runtime = "nodejs";

import { updateAccount, deleteAccount } from "@/lib/email-worker/accounts-store";
import type { SmtpAccount } from "@/scripts/email-dispatch/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<Omit<SmtpAccount, "id">>;
    return Response.json(updateAccount(id, body));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    deleteAccount(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}
