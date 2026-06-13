import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { sendPowerAction } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  suspended: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { serverId } = await params;

  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: { node: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { suspended } = parsed.data;

  // If suspending and server is running, kill it first
  if (suspended && server.status !== "OFFLINE") {
    const creds: NodeCredentials = {
      nodeId: server.node.id,
      fqdn: server.node.fqdn,
      port: server.node.port,
      tlsEnabled: server.node.tlsEnabled,
      tokenId: server.node.tokenId,
      tokenSecret: server.node.tokenSecret,
    };
    try {
      await sendPowerAction(creds, server.externalId, "kill", {
        jarType: server.jarType,
        mcVersion: server.mcVersion,
        memoryMb: server.memoryMb,
        env: (server.environment as Record<string, string>) ?? {},
      });
    } catch {
      // Best-effort kill; continue with suspend regardless
    }
  }

  await prisma.server.update({
    where: { id: serverId },
    data: {
      suspended,
      ...(suspended ? { status: "OFFLINE" } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      serverId,
      action: suspended ? "admin.server.suspend" : "admin.server.unsuspend",
      metadata: { serverName: server.name },
    },
  });

  return NextResponse.json({ suspended });
}
