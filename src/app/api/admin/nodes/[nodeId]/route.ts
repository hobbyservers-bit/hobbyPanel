import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PatchNodeSchema = z.object({
  name:            z.string().min(1).max(64).optional(),
  fqdn:            z.string().min(1).max(255).optional(),
  port:            z.number().int().min(1).max(65535).optional(),
  tlsEnabled:      z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  locationId:      z.string().cuid().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { nodeId } = await params;

  const existing = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!existing) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: parsed.data.locationId } });
    if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const node = await prisma.node.update({
    where: { id: nodeId },
    data: parsed.data,
    include: {
      location: { select: { id: true, name: true, displayName: true } },
      _count: { select: { servers: true } },
    },
  });

  const { tokenSecret: _ts, ...safe } = node;
  return NextResponse.json({ node: safe });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { nodeId } = await params;

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    include: { _count: { select: { servers: true } } },
  });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  if (node._count.servers > 0) {
    return NextResponse.json(
      { error: `Cannot delete node — it still has ${node._count.servers} server(s). Delete the servers first.` },
      { status: 409 }
    );
  }

  await prisma.node.delete({ where: { id: nodeId } });

  return NextResponse.json({ ok: true });
}
