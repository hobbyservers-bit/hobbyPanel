/**
 * Deletes a server cleanly:
 *   1. Archives server data directory → tar.gz
 *   2. Emails the archive to the owner (attached if ≤25 MB, text notice if larger)
 *   3. Stops and removes the Docker container
 *   4. Wipes the data directory
 *   5. Deletes the DB record (cascade handles all relations)
 *
 * Steps 1–4 are best-effort: failures are logged but never block deletion.
 */

import { execSync }  from "child_process";
import { existsSync, statSync, unlinkSync, rmSync } from "fs";
import * as path from "path";
import * as os   from "os";
import { prisma } from "@/lib/db";
import { sendServerDeletionNotice } from "@/lib/email";
import { invalidateWebhookCache }   from "@/lib/discord-alerts";

const DATA_DIR = process.env.MC_DATA_DIR
  ? path.resolve(process.env.MC_DATA_DIR)
  : path.join(process.cwd(), "mc-data");

const MAX_ATTACH_MB = 25;

// ── Archive ───────────────────────────────────────────────────────────────────

function createArchive(uuid: string): { archivePath: string; sizeMb: number } | null {
  const serverDir = path.join(DATA_DIR, uuid);
  if (!existsSync(serverDir)) return null;

  const archivePath = path.join(
    os.tmpdir(),
    `hobbypanel-backup-${uuid}-${Date.now()}.tar.gz`
  );

  try {
    execSync(`tar -czf "${archivePath}" -C "${DATA_DIR}" "${uuid}"`, {
      timeout: 5 * 60_000, // up to 5 min for large worlds
    });
    const sizeMb = Math.ceil(statSync(archivePath).size / 1_048_576);
    return { archivePath, sizeMb };
  } catch (e) {
    console.error("[server-deletion] Archive failed:", e);
    try { unlinkSync(archivePath); } catch {}
    return null;
  }
}

// ── Container teardown ────────────────────────────────────────────────────────

async function teardownContainer(externalId: string): Promise<void> {
  if (process.env.MOCK_WINGS !== "true") return;
  try {
    const { dockerRunner } = await import("@/lib/wings/docker-runner");
    await dockerRunner.destroy(externalId);
  } catch (e) {
    console.error("[server-deletion] Container teardown failed:", e);
  }
}

// ── Data directory wipe ───────────────────────────────────────────────────────

function wipeDataDir(uuid: string): void {
  const dir = path.join(DATA_DIR, uuid);
  if (existsSync(dir)) {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) {
      console.error("[server-deletion] Data dir wipe failed:", e);
    }
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function deleteServerWithBackup(serverId: string): Promise<void> {
  // Fetch server + owner info before touching anything
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: { user: { select: { email: true } } },
  });
  if (!server) return; // already gone

  const { name: serverName, externalId } = server;
  const ownerEmail = server.user.email;

  // Bust webhook alert cache so no stale alerts fire after deletion
  invalidateWebhookCache(externalId);

  // ── 1. Archive ───────────────────────────────────────────────────────────
  let archive: ReturnType<typeof createArchive> = null;
  if (process.env.MOCK_WINGS === "true") {
    archive = createArchive(externalId);
  }

  // ── 2. Email owner ───────────────────────────────────────────────────────
  try {
    const attachPath = archive && archive.sizeMb <= MAX_ATTACH_MB ? archive.archivePath : null;
    await sendServerDeletionNotice(ownerEmail, serverName, attachPath, archive?.sizeMb);
  } catch (e) {
    console.error("[server-deletion] Email failed (continuing deletion):", e);
  }

  // ── 3. Clean up temp archive ─────────────────────────────────────────────
  if (archive) {
    try { unlinkSync(archive.archivePath); } catch {}
  }

  // ── 4. Stop + remove container ───────────────────────────────────────────
  await teardownContainer(externalId);

  // ── 5. Wipe data directory ───────────────────────────────────────────────
  wipeDataDir(externalId);

  // ── 6. Delete DB record (cascade handles all relations) ──────────────────
  await prisma.server.delete({ where: { id: serverId } }).catch((e) => {
    console.error("[server-deletion] DB delete failed:", e);
  });
}
