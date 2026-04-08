export const runtime = "nodejs";

import { updateTemplate } from "@/lib/email-worker/templates-store";
import type { StoredTemplate, TemplateId } from "@/scripts/email-dispatch/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId  = parseInt(id, 10) as TemplateId;
    if (numId < 1 || numId > 3) {
      return Response.json({ error: "Template id must be 1, 2 or 3" }, { status: 400 });
    }
    const body = (await request.json()) as Partial<Omit<StoredTemplate, "id">>;
    return Response.json(updateTemplate(numId, body));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}
