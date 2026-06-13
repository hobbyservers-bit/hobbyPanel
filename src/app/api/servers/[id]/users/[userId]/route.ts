import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../../_shared";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/servers/[id]/users/[userId]  — update permissions
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Partial<{
    canConsole: boolean;
    canFiles: boolean;
    canPower: boolean;
    canSettings: boolean;
  }>;

  const updated = await prisma.serverUser.updateMany({
    where: { userId, serverId: id },
    data: {
      ...(body.canConsole !== undefined && { canConsole: body.canConsole }),
      ...(body.canFiles !== undefined && { canFiles: body.canFiles }),
      ...(body.canPower !== undefined && { canPower: body.canPower }),
      ...(body.canSettings !== undefined && { canSettings: body.canSettings }),
    },
  });

  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/servers/[id]/users/[userId]  — remove subuser
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.serverUser.deleteMany({ where: { userId, serverId: id } });
  return NextResponse.json({ ok: true });
}
