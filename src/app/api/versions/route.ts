import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

export const dynamic = "force-dynamic";

export type JarType = "paper" | "purpur" | "fabric" | "vanilla";

async function fetchPaperVersions(): Promise<string[]> {
  const res = await fetch("https://api.papermc.io/v2/projects/paper", {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error("PaperMC API unavailable");
  const data = (await res.json()) as { versions: string[] };
  return data.versions
    .filter((v) => /^\d+\.\d+(\.\d+)?$/.test(v))
    .reverse();
}

async function fetchPurpurVersions(): Promise<string[]> {
  const res = await fetch("https://api.purpurmc.org/v2/purpur", {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error("Purpur API unavailable");
  const data = (await res.json()) as { versions: string[] };
  return [...data.versions].reverse();
}

async function fetchFabricVersions(): Promise<string[]> {
  const res = await fetch("https://meta.fabricmc.net/v2/versions/game", {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error("Fabric meta API unavailable");
  const data = (await res.json()) as Array<{ version: string; stable: boolean }>;
  return data
    .filter((v) => v.stable)
    .map((v) => v.version);
}

async function fetchVanillaVersions(): Promise<string[]> {
  const res = await fetch(
    "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json",
    { signal: AbortSignal.timeout(8_000) }
  );
  if (!res.ok) throw new Error("Mojang API unavailable");
  const data = (await res.json()) as {
    versions: Array<{ id: string; type: string }>;
  };
  return data.versions
    .filter((v) => v.type === "release")
    .map((v) => v.id);
}

export async function GET(req: NextRequest) {
  const jar = req.nextUrl.searchParams.get("jar") as JarType | null;
  if (!jar || !["paper", "purpur", "fabric", "vanilla"].includes(jar)) {
    return NextResponse.json({ error: "Invalid jar type" }, { status: 400 });
  }

  const bust = req.nextUrl.searchParams.get("bust") === "true";
  const cacheKey = `versions:${jar}`;

  if (bust) {
    await cacheDel(cacheKey);
  } else {
    const cached = await cacheGet<string[]>(cacheKey);
    if (cached) return NextResponse.json({ versions: cached });
  }

  try {
    let versions: string[];
    switch (jar) {
      case "paper":   versions = await fetchPaperVersions();   break;
      case "purpur":  versions = await fetchPurpurVersions();  break;
      case "fabric":  versions = await fetchFabricVersions();  break;
      case "vanilla": versions = await fetchVanillaVersions(); break;
    }
    await cacheSet(cacheKey, versions, 300); // 5 min TTL — picks up new releases quickly
    return NextResponse.json({ versions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
