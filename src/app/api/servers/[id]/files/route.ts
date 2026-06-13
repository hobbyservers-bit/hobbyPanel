import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess, isRestrictedForFreePlan } from "../_shared";
import { listDirectory } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

function nodeCreds(node: { id: string; fqdn: string; port: number; tlsEnabled: boolean; tokenId: string; tokenSecret: string }): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canFiles");
  if (access.error) return access.error;

  const directory = req.nextUrl.searchParams.get("directory") ?? "/";
  const isFree = access.ownerPlan === "FREE";

  try {
    const result = await listDirectory(nodeCreds(access.server.node), access.server.externalId, directory);
    const files = isFree
      ? result.data.filter((f) => !isRestrictedForFreePlan(f.name, directory))
      : result.data;
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
