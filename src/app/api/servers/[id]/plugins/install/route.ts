import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerAccess } from "../../_shared";
import { uploadFileBinary } from "@/lib/wings/client";
import type { NodeCredentials } from "@/lib/wings/types";

export const dynamic = "force-dynamic";

const MODRINTH_UA = "HobbyPanel/1.0 (hobbypanel)";
const LIMIT_MS = 120_000; // 2 min download timeout

const InstallSchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().optional(),
});

interface ModrinthVersionFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

interface ModrinthVersion {
  id: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: ModrinthVersionFile[];
  date_published: string;
}

function nodeCreds(node: {
  id: string; fqdn: string; port: number;
  tlsEnabled: boolean; tokenId: string; tokenSecret: string;
}): NodeCredentials {
  return { nodeId: node.id, fqdn: node.fqdn, port: node.port, tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret };
}

function compatibleLoaders(jarType: string): string[] {
  if (jarType === "fabric") return ["fabric"];
  if (jarType === "purpur") return ["purpur", "paper", "spigot", "bukkit"];
  return ["paper", "spigot", "bukkit"];
}

function installDir(jarType: string): string {
  return jarType === "fabric" ? "/mods" : "/plugins";
}

async function fetchVersions(
  projectId: string,
  mcVersion: string | null,
  loaders: string[]
): Promise<ModrinthVersion[]> {
  const url = new URL(`https://api.modrinth.com/v2/project/${projectId}/version`);
  url.searchParams.set("loaders", JSON.stringify(loaders));
  if (mcVersion && mcVersion !== "latest") {
    url.searchParams.set("game_versions", JSON.stringify([mcVersion]));
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": MODRINTH_UA },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  return res.json() as Promise<ModrinthVersion[]>;
}

async function resolveVersion(
  projectId: string,
  mcVersion: string,
  jarType: string
): Promise<ModrinthVersion | null> {
  const loaders = compatibleLoaders(jarType);

  // Try exact MC version match first
  if (mcVersion !== "latest") {
    const exact = await fetchVersions(projectId, mcVersion, loaders);
    if (exact.length > 0) return exact[0]!;
  }

  // Fallback: latest version with compatible loader (no version filter)
  const any = await fetchVersions(projectId, null, loaders);
  return any.length > 0 ? any[0]! : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canFiles");
  if (access.error) return access.error;

  const { jarType, mcVersion, externalId } = access.server;

  if (jarType === "vanilla") {
    return NextResponse.json({ error: "Vanilla servers do not support plugins or mods." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = InstallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const { projectId, versionId } = parsed.data;

  try {
    let version: ModrinthVersion | null = null;

    // If a specific version ID was provided, use it directly
    if (versionId) {
      const res = await fetch(`https://api.modrinth.com/v2/version/${versionId}`, {
        headers: { "User-Agent": MODRINTH_UA },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) version = await res.json() as ModrinthVersion;
    }

    // Otherwise auto-resolve best compatible version
    if (!version) {
      version = await resolveVersion(projectId, mcVersion, jarType);
    }

    if (!version) {
      return NextResponse.json(
        { error: `No compatible version found for ${jarType} ${mcVersion}.` },
        { status: 404 }
      );
    }

    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file) {
      return NextResponse.json({ error: "No downloadable file in this version." }, { status: 404 });
    }

    // Download from Modrinth CDN
    const dlRes = await fetch(file.url, {
      headers: { "User-Agent": MODRINTH_UA },
      signal: AbortSignal.timeout(LIMIT_MS),
    });
    if (!dlRes.ok) {
      return NextResponse.json({ error: `Download failed: ${dlRes.status}` }, { status: 502 });
    }

    const buffer = Buffer.from(await dlRes.arrayBuffer());
    const directory = installDir(jarType);

    await uploadFileBinary(nodeCreds(access.server.node), externalId, directory, file.filename, buffer);

    return NextResponse.json({
      ok: true,
      filename: file.filename,
      version: version.version_number,
      directory,
      sizeMb: (buffer.byteLength / 1_048_576).toFixed(2),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
