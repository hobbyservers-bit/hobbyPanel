import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { nodes: true } } },
  });

  const visible = locations
    .filter((l) => l._count.nodes > 0)
    .map(({ id, name, displayName, _count }) => ({
      id,
      name,
      displayName,
      nodeCount: _count.nodes,
    }));

  return NextResponse.json({ locations: visible });
}
