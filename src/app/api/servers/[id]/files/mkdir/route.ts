import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../../_shared";
import { createDirectory } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

function nodeCreds(node: { id: string; fqdn: string; port: number; tlsEnabled: boolean; tokenId: string; tokenSecret: string }): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canFiles");
  if (access.error) return access.error;

  const { name, directory } = (await req.json()) as { name: string; directory: string };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  try {
    await createDirectory(nodeCreds(access.server.node), access.server.externalId, name.trim(), directory ?? "/");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
