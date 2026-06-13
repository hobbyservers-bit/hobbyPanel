import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  serverId: z.string().cuid().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ allocationId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { allocationId } = await params;

  const alloc = await prisma.allocation.findUnique({ where: { id: allocationId } });
  if (!alloc) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { serverId } = parsed.data;

  // If assigning to a server, verify the server is on the same node
  if (serverId) {
    const server = await prisma.server.findUnique({ where: { id: serverId }, select: { nodeId: true } });
    if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
    if (server.nodeId !== alloc.nodeId) {
      return NextResponse.json(
        { error: "Allocation and server must be on the same node." },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.allocation.update({
    where: { id: allocationId },
    data: { serverId },
    include: { server: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ allocation: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ allocationId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { allocationId } = await params;

  const alloc = await prisma.allocation.findUnique({ where: { id: allocationId } });
  if (!alloc) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
  if (alloc.serverId) {
    return NextResponse.json(
      { error: "Cannot delete an allocation that is assigned to a server. Unassign it first." },
      { status: 409 }
    );
  }

  await prisma.allocation.delete({ where: { id: allocationId } });
  return NextResponse.json({ ok: true });
}
