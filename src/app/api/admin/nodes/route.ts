import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const CreateNodeSchema = z.object({
  name:        z.string().min(1).max(64),
  fqdn:        z.string().min(1).max(255),
  port:        z.number().int().min(1).max(65535).default(8080),
  tlsEnabled:  z.boolean().default(false),
  locationId:  z.string().cuid().optional().nullable(),
});

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const nodes = await prisma.node.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      location: { select: { id: true, name: true, displayName: true } },
      _count: { select: { servers: true } },
    },
  });

  // Omit tokenSecret from list response
  const safe = nodes.map(({ tokenSecret: _ts, ...n }) => n);
  return NextResponse.json({ nodes: safe });
}

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: parsed.data.locationId } });
    if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const tokenId     = randomBytes(12).toString("hex"); // 24-char hex
  const tokenSecret = randomBytes(32).toString("hex"); // 64-char hex

  const node = await prisma.node.create({
    data: {
      ...parsed.data,
      tokenId,
      tokenSecret,
    },
    include: {
      location: { select: { id: true, name: true, displayName: true } },
      _count: { select: { servers: true } },
    },
  });

  const { tokenSecret: _ts, ...safe } = node;
  return NextResponse.json({ node: safe }, { status: 201 });
}
