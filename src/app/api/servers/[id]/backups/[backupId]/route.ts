import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../../_shared";
import { prisma } from "@/lib/db";
import { deleteBackup } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

function nodeCreds(node: { id: string; fqdn: string; port: number; tlsEnabled: boolean; tokenId: string; tokenSecret: string }): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

// GET /api/servers/[id]/backups/[backupId]/download  — served by redirect to
// this endpoint with ?download=1 from the UI. For simplicity, streams content.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; backupId: string }> }) {
  const { id, backupId } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;

  const backup = await prisma.backup.findFirst({ where: { id: backupId, serverId: id } });
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // In mock mode there's no real backup file — return a placeholder
  return new NextResponse(`Mock backup: ${backup.name} (${backup.externalId})`, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${backup.name.replace(/[^a-z0-9.-]/gi, "_")}.tar.gz"`,
    },
  });
}

// DELETE /api/servers/[id]/backups/[backupId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; backupId: string }> }) {
  const { id, backupId } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const backup = await prisma.backup.findFirst({ where: { id: backupId, serverId: id } });
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteBackup(nodeCreds(access.server.node), access.server.externalId, backup.externalId);
  } catch { /* ignore Wings errors for deletes */ }

  await prisma.backup.delete({ where: { id: backupId } });
  return NextResponse.json({ ok: true });
}
