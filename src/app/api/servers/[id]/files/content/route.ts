import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess, isRestrictedForFreePlan } from "../../_shared";
import { getFileContents, writeFileContents } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

function nodeCreds(node: { id: string; fqdn: string; port: number; tlsEnabled: boolean; tokenId: string; tokenSecret: string }): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

// GET  /api/servers/[id]/files/content?file=/path   — read file (or download)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canFiles");
  if (access.error) return access.error;

  const file = req.nextUrl.searchParams.get("file");
  if (!file) return NextResponse.json({ error: "file param required" }, { status: 400 });

  if (access.ownerPlan === "FREE" && isRestrictedForFreePlan(file)) {
    return NextResponse.json({ error: "This file is not accessible on the Free plan." }, { status: 403 });
  }

  try {
    const contents = await getFileContents(nodeCreds(access.server.node), access.server.externalId, file);
    const isDownload = req.nextUrl.searchParams.get("download") === "1";
    if (isDownload) {
      const filename = file.split("/").pop() ?? "file";
      return new NextResponse(contents, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
    return new NextResponse(contents, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// PUT  /api/servers/[id]/files/content   body: URLEncoded {file, contents}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canFiles");
  if (access.error) return access.error;

  const body = (await req.json()) as { file: string; contents: string };
  const file = body.file;
  const contents = body.contents;

  if (!file) return NextResponse.json({ error: "file param required" }, { status: 400 });

  if (access.ownerPlan === "FREE" && isRestrictedForFreePlan(file)) {
    return NextResponse.json({ error: "This file cannot be edited on the Free plan." }, { status: 403 });
  }

  try {
    await writeFileContents(nodeCreds(access.server.node), access.server.externalId, file, contents ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
