import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../_shared";
import { getFileContents, writeFileContents } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";
import { FREE_MAX_PLAYERS, ServerPropertiesSchema } from "@/lib/server-properties";
import type { ServerProperties } from "@/lib/server-properties";

export const dynamic = "force-dynamic";

function nodeCreds(node: { id: string; fqdn: string; port: number; tlsEnabled: boolean; tokenId: string; tokenSecret: string }): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

// Parse a server.properties file into a key→value map, preserving comment lines
function parseProperties(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

// Serialize back — update only the keys we changed, keep everything else
function serializeProperties(original: string, updates: Record<string, string>): string {
  const lines = original.split("\n");
  const written = new Set<string>();
  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq);
    if (key in updates) {
      written.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  // Append any keys that weren't already in the file
  for (const [k, v] of Object.entries(updates)) {
    if (!written.has(k)) result.push(`${k}=${v}`);
  }
  return result.join("\n");
}

const PatchSchema = ServerPropertiesSchema;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const isFree = access.ownerPlan === "FREE";

  try {
    const raw = await getFileContents(nodeCreds(access.server.node), access.server.externalId, "/server.properties");
    const map = parseProperties(raw);

    const props: ServerProperties = {
      "max-players":         parseInt(map.get("max-players") ?? "20"),
      "difficulty":          (map.get("difficulty") ?? "easy") as ServerProperties["difficulty"],
      "gamemode":            (map.get("gamemode") ?? "survival") as ServerProperties["gamemode"],
      "pvp":                 (map.get("pvp") ?? "true") === "true",
      "white-list":          (map.get("white-list") ?? "false") === "true",
      "view-distance":       parseInt(map.get("view-distance") ?? "10"),
      "simulation-distance": parseInt(map.get("simulation-distance") ?? "10"),
      "level-seed":          map.get("level-seed") ?? "",
      "motd":                map.get("motd") ?? "A Minecraft Server",
      "allow-nether":        (map.get("allow-nether") ?? "true") === "true",
      "spawn-animals":       (map.get("spawn-animals") ?? "true") === "true",
      "spawn-monsters":      (map.get("spawn-monsters") ?? "true") === "true",
      "spawn-npcs":          (map.get("spawn-npcs") ?? "true") === "true",
      "spawn-protection":    parseInt(map.get("spawn-protection") ?? "16"),
      "hardcore":            (map.get("hardcore") ?? "false") === "true",
      "force-gamemode":      (map.get("force-gamemode") ?? "false") === "true",
      "enforce-whitelist":   (map.get("enforce-whitelist") ?? "false") === "true",
    };

    return NextResponse.json({ props, isFree, raw });
  } catch {
    // File doesn't exist yet — return defaults
    return NextResponse.json({
      props: {
        "max-players": isFree ? FREE_MAX_PLAYERS : 20,
        "difficulty": "easy", "gamemode": "survival", "pvp": true,
        "white-list": false, "view-distance": 10, "simulation-distance": 10,
        "level-seed": "", "motd": "A Minecraft Server", "allow-nether": true,
        "spawn-animals": true, "spawn-monsters": true, "spawn-npcs": true,
        "spawn-protection": 16, "hardcore": false, "force-gamemode": false,
        "enforce-whitelist": false,
      } as ServerProperties,
      isFree,
      raw: "",
    });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const isFree = access.ownerPlan === "FREE";
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid properties" }, { status: 400 });

  const updates = parsed.data;

  // Enforce free plan player cap
  if (isFree && updates["max-players"] !== undefined && updates["max-players"] > FREE_MAX_PLAYERS) {
    updates["max-players"] = FREE_MAX_PLAYERS;
  }

  // Convert to string key→value for serialisation
  const stringUpdates: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) stringUpdates[k] = String(v);
  }

  try {
    const nc = nodeCreds(access.server.node);
    let original = "";
    try { original = await getFileContents(nc, access.server.externalId, "/server.properties"); } catch { /* new server */ }
    const newContents = serializeProperties(original, stringUpdates);
    await writeFileContents(nc, access.server.externalId, "/server.properties", newContents);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
