import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { deleteServerWithBackup } from "@/lib/server-deletion";

export const dynamic = "force-dynamic";

const PatchServerSchema = z.object({
  name:      z.string().min(1).max(32).regex(/^[a-zA-Z0-9 _-]+$/).optional(),
  userId:    z.string().cuid().optional(),
  memoryMb:  z.number().int().min(512).max(65536).optional(),
  diskMb:    z.number().int().min(1024).max(524288).optional(),
  cpuLimit:  z.number().int().min(10).max(1600).optional(),
  mcVersion: z.string().min(1).max(20).optional(),
  jarType:   z.enum(["paper", "purpur", "fabric", "vanilla"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { serverId } = await params;

  const target = await prisma.server.findUnique({ where: { id: serverId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { userId, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };

  if (userId) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    updateData.userId = userId;
  }

  const server = await prisma.server.update({
    where: { id: serverId },
    data: updateData,
    select: {
      id: true, name: true, externalId: true, status: true,
      mcVersion: true, jarType: true, memoryMb: true, diskMb: true,
      cpuLimit: true, createdAt: true,
      user: { select: { id: true, email: true } },
      node: { select: { id: true, name: true, fqdn: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      serverId,
      action: "admin.server.edit",
      metadata: { changes: Object.keys(updateData) },
    },
  });

  return NextResponse.json({ server });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { serverId } = await params;

  const target = await prisma.server.findUnique({ where: { id: serverId }, select: { id: true, name: true } });
  if (!target) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  // Audit log before deletion (server record will be gone after)
  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      action: "admin.server.delete",
      metadata: { serverName: target.name },
    },
  });

  // Archive + email owner + wipe container/files + delete DB record
  await deleteServerWithBackup(serverId);

  return NextResponse.json({ ok: true });
}
