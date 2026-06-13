import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../../_shared";
import { cacheGet, cacheSet } from "@/lib/redis";

export const dynamic = "force-dynamic";

export interface ModrinthProject {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  follows: number;
  project_type: string;
  categories: string[];
  game_versions: string[];
  loaders: string[] | null;
  latest_version: string;
  date_modified: string;
}

export interface ModrinthSearchResponse {
  hits: ModrinthProject[];
  total_hits: number;
  offset: number;
  limit: number;
  unsupported?: boolean;
}

const MODRINTH_UA = "HobbyPanel/1.0 (hobbypanel)";

// Build Modrinth facets for the given jar type.
// Modrinth search uses "categories" for platform tags (paper, fabric, etc.),
// not "loaders" (loaders is a version-level field, not searchable as a facet).
// OR-semantics within inner arrays, AND between outer arrays.
function buildFacets(jarType: string): string {
  if (jarType === "fabric") {
    return JSON.stringify([["project_type:mod"], ["categories:fabric"]]);
  }
  if (jarType === "purpur") {
    return JSON.stringify([
      ["project_type:plugin"],
      ["categories:purpur", "categories:paper", "categories:spigot", "categories:bukkit"],
    ]);
  }
  // paper (and anything else bukkit-compatible)
  return JSON.stringify([
    ["project_type:plugin"],
    ["categories:paper", "categories:spigot", "categories:bukkit"],
  ]);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;

  const { jarType } = access.server;

  if (jarType === "vanilla") {
    return NextResponse.json<ModrinthSearchResponse>({
      hits: [], total_hits: 0, offset: 0, limit: 20, unsupported: true,
    });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10));

  const cacheKey = `modrinth:search:${jarType}:${q}:${offset}`;
  const cached = await cacheGet<ModrinthSearchResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const url = new URL("https://api.modrinth.com/v2/search");
  url.searchParams.set("query", q);
  url.searchParams.set("facets", buildFacets(jarType));
  url.searchParams.set("limit", "20");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("index", q ? "relevance" : "downloads");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": MODRINTH_UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Modrinth returned ${res.status}`);
    const data = await res.json() as ModrinthSearchResponse;
    await cacheSet(cacheKey, data, 120); // 2-minute cache
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
