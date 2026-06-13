import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getServerResources } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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
        { subUsers: { some: { userId: user.id } } },
      ],
    },
    include: { node: true },
  });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const creds: NodeCredentials = {
    nodeId: server.node.id,
    fqdn: server.node.fqdn,
    port: server.node.port,
    tlsEnabled: server.node.tlsEnabled,
    tokenId: server.node.tokenId,
    tokenSecret: server.node.tokenSecret,
  };

  const resources = await getServerResources(creds, server.externalId);
  return NextResponse.json(resources);
}
