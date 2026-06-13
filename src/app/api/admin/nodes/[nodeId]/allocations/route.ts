import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { nodeId } = await params;

  const node = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const allocations = await prisma.allocation.findMany({
    where: { nodeId },
    orderBy: { port: "asc" },
    include: { server: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ allocations });
}

const AddSchema = z.object({
  ip:    z.string().default("0.0.0.0"),
  alias: z.string().max(64).optional(),
  notes: z.string().max(255).optional(),
  // Single port or a range
  port:      z.number().int().min(1024).max(65535).optional(),
  portStart: z.number().int().min(1024).max(65535).optional(),
  portEnd:   z.number().int().min(1024).max(65535).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { nodeId } = await params;

  const node = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { ip, alias, notes, port, portStart, portEnd } = parsed.data;

  const ports: number[] = [];
  if (port !== undefined) {
    ports.push(port);
  } else if (portStart !== undefined && portEnd !== undefined) {
    if (portEnd < portStart) {
      return NextResponse.json({ error: "portEnd must be >= portStart" }, { status: 400 });
    }
    if (portEnd - portStart > 500) {
      return NextResponse.json({ error: "Cannot add more than 500 ports at once" }, { status: 400 });
    }
    for (let p = portStart; p <= portEnd; p++) ports.push(p);
  } else {
    return NextResponse.json({ error: "Provide port or portStart+portEnd" }, { status: 400 });
  }

  // Upsert each port (skip already-existing ones)
  const created: number[] = [];
  const skipped: number[] = [];
  for (const p of ports) {
    const existing = await prisma.allocation.findUnique({ where: { nodeId_port: { nodeId, port: p } } });
    if (existing) { skipped.push(p); continue; }
    await prisma.allocation.create({ data: { nodeId, ip, alias, notes: notes ?? "", port: p } });
    created.push(p);
  }

  const allocations = await prisma.allocation.findMany({
    where: { nodeId },
    orderBy: { port: "asc" },
    include: { server: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ created: created.length, skipped: skipped.length, allocations }, { status: 201 });
}
