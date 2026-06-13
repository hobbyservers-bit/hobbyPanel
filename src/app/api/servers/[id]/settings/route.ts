import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerAccess } from "../_shared";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const SettingsSchema = z.object({
  name: z.string().min(1).max(32).regex(/^[a-zA-Z0-9 _-]+$/).optional(),
  startupCommand: z.string().max(512).optional(),
  dockerImage: z.string().max(256).optional(),
});

// PATCH /api/servers/[id]/settings
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const body = await req.json().catch(() => ({}));
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, startupCommand, dockerImage } = parsed.data;

  await prisma.server.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(startupCommand !== undefined && { startupCommand }),
      ...(dockerImage !== undefined && { dockerImage }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      serverId: id,
      action: "server.settings.update",
      metadata: { name, startupCommand: startupCommand ? "[set]" : undefined },
    },
  });

  return NextResponse.json({ ok: true });
}
