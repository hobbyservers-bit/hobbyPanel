import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { nodeId } = await params;

  const node = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const proto = node.tlsEnabled ? "https" : "http";
  const url   = `${proto}://${node.fqdn}:${node.port}/api/system`;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    // Wings returns 401 when not authenticated — that still means it's reachable
    return NextResponse.json({ online: true, latencyMs, statusCode: res.status });
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ online: false, latencyMs, error: message });
  }
}
