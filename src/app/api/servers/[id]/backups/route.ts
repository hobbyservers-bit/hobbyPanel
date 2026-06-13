import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireServerAccess } from "../_shared";
import { prisma } from "@/lib/db";
import { createBackup } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

function nodeCreds(node: { id: string; fqdn: string; port: number; tlsEnabled: boolean; tokenId: string; tokenSecret: string }): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

// GET /api/servers/[id]/backups
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;

  const backups = await prisma.backup.findMany({
    where: { serverId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, sizeMb: true, status: true, createdAt: true },
  });

  return NextResponse.json({ backups });
}

// POST /api/servers/[id]/backups
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { server } = access;
  const body = await req.json().catch(() => ({})) as { name?: string };
  const backupUuid = uuidv4();
  const name = body.name?.trim() || `Backup ${new Date().toLocaleString()}`;

  // Create DB record (pending)
  const dbBackup = await prisma.backup.create({
    data: {
      serverId: id,
      externalId: backupUuid,
      name,
      status: "PENDING",
    },
    select: { id: true },
  });

  // Kick off backup asynchronously
  (async () => {
    try {
      const result = await createBackup(nodeCreds(server.node), server.externalId, backupUuid);
      await prisma.backup.update({
        where: { id: dbBackup.id },
        data: {
          status: "COMPLETE",
          sizeMb: result.file_size ? Math.ceil(result.file_size / 1_048_576) : null,
          checksum: result.checksum ?? null,
        },
      });
    } catch {
      await prisma.backup.update({
        where: { id: dbBackup.id },
        data: { status: "FAILED" },
      });
    }
  })();

  return NextResponse.json({ id: dbBackup.id }, { status: 202 });
}
