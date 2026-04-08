export const runtime = "nodejs";

import { getTemplates } from "@/lib/email-worker/templates-store";

export async function GET() {
  return Response.json({ templates: getTemplates() });
}
