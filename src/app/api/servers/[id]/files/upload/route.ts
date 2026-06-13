import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess, isRestrictedForFreePlan } from "../../_shared";
import { uploadFile } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

function nodeCreds(node: { id: string; fqdn: string; port: number; tlsEnabled: boolean; tokenId: string; tokenSecret: string }): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canFiles");
  if (access.error) return access.error;

  const formData = await req.formData();
  const directory = (formData.get("directory") as string | null) ?? "/";
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (access.ownerPlan === "FREE" && isRestrictedForFreePlan(file.name)) {
    return NextResponse.json({ error: "This file type is not allowed on the Free plan." }, { status: 403 });
  }

  try {
    const contents = await file.text();
    await uploadFile(nodeCreds(access.server.node), access.server.externalId, directory, file.name, contents);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
