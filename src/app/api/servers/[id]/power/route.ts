import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendPowerAction } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

const BodySchema = z.object({
  action: z.enum(["start", "stop", "restart", "kill"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const server = await prisma.server.findFirst({
    where: {
      id,
      OR: [
        { userId: user.id },
        { subUsers: { some: { userId: user.id, canPower: true } } },
      ],
    },
    select: {
      id: true, externalId: true, jarType: true, mcVersion: true,
      memoryMb: true, cpuLimit: true,
      name: true, environment: true, suspended: true,
      node: true,
      user: { select: { plan: true } },
      allocations: { where: { serverId: { not: null } }, orderBy: { port: "asc" }, take: 1 },
    },
  });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (server.suspended) {
    return NextResponse.json({ error: "This server is suspended. Contact an administrator." }, { status: 403 });
  }
  if (server.node.maintenanceMode) {
    return NextResponse.json({ error: "This server's node is under maintenance. Power actions are temporarily disabled." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { action } = parsed.data;

  const creds: NodeCredentials = {
    nodeId: server.node.id,
    fqdn: server.node.fqdn,
    port: server.node.port,
    tlsEnabled: server.node.tlsEnabled,
    tokenId: server.node.tokenId,
    tokenSecret: server.node.tokenSecret,
  };

  await sendPowerAction(creds, server.externalId, action, {
    jarType: server.jarType,
    mcVersion: server.mcVersion,
    memoryMb: server.memoryMb,
    cpuLimit: server.cpuLimit,
    isFree: server.user.plan === "FREE",
    env: (server.environment as Record<string, string>) ?? {},
    mcPort: server.allocations[0]?.port,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      serverId: server.id,
      action: `server.power.${action}`,
      metadata: { serverName: server.name },
    },
  });

  return NextResponse.json({ success: true });
}
