import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { getPanelSettings, setPanelMaintenance } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const settings = await getPanelSettings();
  return NextResponse.json({ settings });
}

const PatchSchema = z.object({
  maintenanceMode: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await setPanelMaintenance(parsed.data.maintenanceMode);

  return NextResponse.json({ settings: { maintenanceMode: parsed.data.maintenanceMode } });
}
