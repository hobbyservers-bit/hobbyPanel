/**
 * PaperMC API client.
 * Fetches the latest stable Paper version and build number.
 * Results are Redis-cached for 1 hour so the dashboard never blocks on this.
 */

import { cacheGet, cacheSet } from "@/lib/redis";

const BASE = "https://api.papermc.io/v2";

export interface PaperBuildInfo {
  version: string;
  build: number;
  channel: "default" | "experimental";
  jarName: string;
}

export async function getLatestPaperBuild(): Promise<PaperBuildInfo> {
  const cacheKey = "papermc:latest_build";
  const cached = await cacheGet<PaperBuildInfo>(cacheKey);
  if (cached) return cached;

  // Fetch project — returns { versions: string[] } sorted oldest→newest
  const projectRes = await fetch(`${BASE}/projects/paper`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!projectRes.ok) throw new Error("PaperMC API unavailable");

  const project = (await projectRes.json()) as { versions: string[] };
  // Skip -snapshot / -pre suffixes, take the last stable version
  const stableVersions = project.versions.filter(
    (v) => /^\d+\.\d+(\.\d+)?$/.test(v)
  );
  const latestVersion = stableVersions.at(-1);
  if (!latestVersion) throw new Error("No stable Paper versions found");

  // Fetch builds for that version
  const buildsRes = await fetch(
    `${BASE}/projects/paper/versions/${latestVersion}`,
    { signal: AbortSignal.timeout(8_000) }
  );
  if (!buildsRes.ok) throw new Error("Could not fetch Paper builds");

  const buildsData = (await buildsRes.json()) as { builds: number[] };
  const latestBuild = buildsData.builds.at(-1);
  if (!latestBuild) throw new Error("No builds available for Paper " + latestVersion);

  // Fetch the specific build to get the jar filename
  const buildRes = await fetch(
    `${BASE}/projects/paper/versions/${latestVersion}/builds/${latestBuild}`,
    { signal: AbortSignal.timeout(8_000) }
  );
  const buildData = (await buildRes.json()) as {
    channel: "default" | "experimental";
    downloads: { application: { name: string } };
  };

  const info: PaperBuildInfo = {
    version: latestVersion,
    build: latestBuild,
    channel: buildData.channel,
    jarName: buildData.downloads.application.name,
  };

  await cacheSet(cacheKey, info, 3600);
  return info;
}

/** Returns just the version string, cached separately for UI use. */
export async function getLatestPaperVersion(): Promise<string> {
  const cacheKey = "papermc:latest_version";
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  const build = await getLatestPaperBuild();
  await cacheSet(cacheKey, build.version, 3600);
  return build.version;
}
