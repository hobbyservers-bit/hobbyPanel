import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../_shared";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/servers/[id]/reinstall
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Only the server owner can reinstall" }, { status: 403 });

  // In mock mode: wipe the virtual FS by resetting simulator state
  if (process.env.MOCK_WINGS === "true") {
    const { simulator } = await import("@/lib/wings/simulator");
    simulator.reinstall(access.server.externalId);
  }

  await prisma.server.update({ where: { id }, data: { status: "OFFLINE" } });

  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      serverId: id,
      action: "server.reinstall",
      metadata: {},
    },
  });

  return NextResponse.json({ ok: true });
}
