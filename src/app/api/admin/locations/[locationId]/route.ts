import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name:        z.string().min(1).max(64).regex(/^[a-z0-9]+(\.[a-z0-9]+)*$/, "Name must be lowercase letters/numbers separated by dots").optional(),
  displayName: z.string().min(1).max(64).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { locationId } = await params;

  const existing = await prisma.location.findUnique({ where: { id: locationId } });
  if (!existing) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const conflict = await prisma.location.findUnique({ where: { name: parsed.data.name } });
    if (conflict) return NextResponse.json({ error: "A location with that name already exists" }, { status: 409 });
  }

  const location = await prisma.location.update({
    where: { id: locationId },
    data: parsed.data,
    include: { _count: { select: { nodes: true } } },
  });

  return NextResponse.json({ location });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { locationId } = await params;

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { _count: { select: { nodes: true } } },
  });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  if (location._count.nodes > 0) {
    return NextResponse.json(
      { error: `Cannot delete location — it still has ${location._count.nodes} node(s). Move or delete the nodes first.` },
      { status: 409 }
    );
  }

  await prisma.location.delete({ where: { id: locationId } });

  return NextResponse.json({ ok: true });
}
