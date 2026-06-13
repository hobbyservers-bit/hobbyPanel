import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../_shared";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.MC_DATA_DIR
  ? path.resolve(process.env.MC_DATA_DIR)
  : path.join(process.cwd(), "mc-data");

function serverDataPath(externalId: string, file: string) {
  return path.join(DATA_DIR, externalId, file);
}

function readJsonFile<T>(p: string): T[] {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T[];
  } catch { return []; }
}

interface WhitelistEntry { uuid: string; name: string; }
interface BanEntry { uuid?: string; name: string; created: string; source: string; expires: string; reason: string; }

function parseOnlinePlayers(listOutput: string): string[] {
  // "There are X of a max of Y players online: player1, player2"
  const match = listOutput.match(/players online:\s*(.*)/i);
  if (!match || !match[1]?.trim()) return [];
  return match[1].split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canConsole");
  if (access.error) return access.error;

  const { externalId } = access.server;

  // Online players via RCON (best-effort — server may be offline)
  let online: string[] = [];
  try {
    if (process.env.MOCK_WINGS === "true") {
      const { dockerRunner } = await import("@/lib/wings/docker-runner");
      const out = await dockerRunner.rcon(externalId, "list");
      online = parseOnlinePlayers(out);
    }
  } catch { /* server offline */ }

  const whitelist = readJsonFile<WhitelistEntry>(serverDataPath(externalId, "whitelist.json"));
  const banned = readJsonFile<BanEntry>(serverDataPath(externalId, "banned-players.json"));
  const ops = readJsonFile<WhitelistEntry>(serverDataPath(externalId, "ops.json"));

  return NextResponse.json({ online, whitelist, banned, ops });
}
