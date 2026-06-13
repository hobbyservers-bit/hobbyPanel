import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getServerResources } from "@/lib/wings/client";
import { getLatestPaperVersion } from "@/lib/paper-api";
import { buildEnvironment, resolveStartup } from "@/lib/egg-env";
import type { NodeCredentials } from "@/lib/wings/types";
import type { ServerStatus } from "@prisma/client";
import plansConfig from "../../../../config/plans.json";

export const dynamic = "force-dynamic";

// ── Shared types (used by client components via imports) ──────────────────────

export interface ServerResource {
  cpuPercent: number;
  memoryMb: number;
  diskMb: number;
  uptimeSeconds: number;
  currentState: "running" | "offline" | "starting" | "stopping";
}

export interface ServerListItem {
  id: string;
  name: string;
  externalId: string;
  status: ServerStatus;
  mcVersion: string;
  jarType: string;
  memoryMb: number;
  diskMb: number;
  cpuLimit: number;
  nodeFqdn: string;
  serverAddress: string | null; // "fqdn:port" or null if no allocation assigned
  resources: ServerResource | null;
}

export interface ServersListResponse {
  servers: ServerListItem[];
  canCreateServer: boolean; // false once free tier is used (non-admin)
}

// ── Free-tier constants ───────────────────────────────────────────────────────

const FREE_MEMORY_MB = 2048;
const FREE_DISK_MB = 10240;
const FREE_CPU_LIMIT = 100; // 1 vCPU

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeCreds(node: {
  id: string;
  fqdn: string;
  port: number;
  tlsEnabled: boolean;
  tokenId: string;
  tokenSecret: string;
}): NodeCredentials {
  return {
    nodeId: node.id,
    fqdn: node.fqdn,
    port: node.port,
    tlsEnabled: node.tlsEnabled,
    tokenId: node.tokenId,
    tokenSecret: node.tokenSecret,
  };
}

async function fetchResourcesCached(
  creds: NodeCredentials,
  externalId: string
): Promise<ServerResource | null> {
  const key = `resources:${externalId}`;
  const cached = await cacheGet<ServerResource>(key);
  if (cached) return cached;

  try {
    const res = await getServerResources(creds, externalId);
    const r = res.attributes.resources;
    const data: ServerResource = {
      cpuPercent: parseFloat(r.cpu_absolute.toFixed(1)),
      memoryMb: Math.round(r.memory_bytes / 1_048_576),
      diskMb: Math.round(r.disk_bytes / 1_048_576),
      uptimeSeconds: Math.floor(r.uptime / 1000),
      currentState: res.attributes.current_state,
    };
    await cacheSet(key, data, 2); // 2-second TTL
    return data;
  } catch {
    return null;
  }
}

// ── GET /api/servers ──────────────────────────────────────────────────────────

export async function GET() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cache the DB query (server metadata rarely changes)
  const listKey = `servers:list:${user.id}`;
  const cached = await cacheGet<ServerListItem[]>(listKey);

  let dbServers: Awaited<ReturnType<typeof queryDbServers>>;
  if (cached) {
    // Still need node creds to refresh resources — fetch minimal node data
    dbServers = await queryDbServers(user.id);
  } else {
    dbServers = await queryDbServers(user.id);
    const meta = dbServers.map(
      ({ id, name, externalId, status, mcVersion, jarType, memoryMb, diskMb, cpuLimit }) => ({
        id, name, externalId, status, mcVersion, jarType, memoryMb, diskMb, cpuLimit,
        resources: null,
      })
    );
    await cacheSet(listKey, meta, 5); // 5-second TTL for the list
  }

  // Fetch resources for each server in parallel (each result is independently cached)
  const withResources: ServerListItem[] = await Promise.all(
    dbServers.map(async (s) => {
      const alloc = s.allocations[0];
      const serverAddress = alloc
        ? `${alloc.alias ?? s.node.fqdn}:${alloc.port}`
        : null;
      return {
        id: s.id,
        name: s.name,
        externalId: s.externalId,
        status: s.status,
        mcVersion: s.mcVersion,
        jarType: s.jarType,
        memoryMb: s.memoryMb,
        diskMb: s.diskMb,
        cpuLimit: s.cpuLimit,
        nodeFqdn: s.node.fqdn,
        serverAddress,
        resources: await fetchResourcesCached(nodeCreds(s.node), s.externalId),
      };
    })
  );

  const ownedCount = dbServers.filter((s) => s.userId === user.id).length;
  const userWithPlan = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } });
  const plan = userWithPlan?.plan ?? "FREE";
  const canCreateServer = user.role === "ADMIN" || plan === "PRO" || ownedCount === 0;

  const response: ServersListResponse = {
    servers: withResources,
    canCreateServer,
  };

  return NextResponse.json(response);
}

async function queryDbServers(userId: string) {
  return prisma.server.findMany({
    where: {
      OR: [{ userId }, { subUsers: { some: { userId } } }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      externalId: true,
      status: true,
      mcVersion: true,
      jarType: true,
      memoryMb: true,
      diskMb: true,
      cpuLimit: true,
      userId: true,
      node: {
        select: {
          id: true,
          fqdn: true,
          port: true,
          tlsEnabled: true,
          tokenId: true,
          tokenSecret: true,
        },
      },
      allocations: {
        orderBy: { port: "asc" },
        take: 1,
        select: { port: true, ip: true, alias: true },
      },
    },
  });
}

// ── POST /api/servers ─────────────────────────────────────────────────────────

const CreateServerSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(32, "Name must be 32 characters or fewer")
    .regex(/^[a-zA-Z0-9 _-]+$/, "Name may only contain letters, numbers, spaces, hyphens, and underscores"),
  eggId:        z.string().cuid().optional(),
  dockerImage:  z.string().optional(),
  environment:  z.record(z.string()).default({}),
  locationId:   z.string().cuid().optional(),
  // Plan resources — sent from the plan picker step
  planId:       z.string().max(32).optional(),
  nodeTier:     z.string().max(32).optional(),
  addons:       z.array(z.string().max(64)).max(20).optional(),
  memoryMb:     z.number().int().min(512).max(65536).optional(),
  diskMb:       z.number().int().min(1024).max(409600).optional(),
  cpuLimit:     z.number().int().min(10).max(1600).optional(),
  maxBackups:   z.number().int().min(0).max(100).optional(),
  maxDatabases: z.number().int().min(0).max(20).optional(),
});

export async function POST(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateServerSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const {
    name, eggId: requestedEggId, environment: envOverrides, locationId,
    planId = "free",
    nodeTier = "budget",
    addons: reqAddons,
    memoryMb: reqMemoryMb, diskMb: reqDiskMb, cpuLimit: reqCpuLimit,
    maxBackups: reqMaxBackups, maxDatabases: reqMaxDatabases,
  } = parsed.data;

  const addons = reqAddons ?? [];

  const memoryMb     = reqMemoryMb     ?? FREE_MEMORY_MB;
  const diskMb       = reqDiskMb       ?? FREE_DISK_MB;
  const cpuLimit     = reqCpuLimit     ?? FREE_CPU_LIMIT;
  const maxBackups   = reqMaxBackups   ?? 2;
  const maxDatabases = reqMaxDatabases ?? 0;

  // ── Calculate monthly cost in credits ($1 = 100 credits) ─────────────────
  let planDollars = 0;
  if (planId === "custom") {
    const p = plansConfig.custom.pricing;
    const tierRamRate = (plansConfig as typeof plansConfig & { nodeTiers?: { id: string; ramPerGbMonthly: number }[] })
      .nodeTiers?.find((t) => t.id === nodeTier)?.ramPerGbMonthly ?? 1.00;
    planDollars =
      (memoryMb / 1024) * tierRamRate +
      (cpuLimit / 100)  * p.cpuPerCoreMonthly +
      (diskMb   / 1024) * p.diskPerGbMonthly +
      maxBackups         * p.backupPerSlotMonthly +
      maxDatabases       * p.databasePerInstanceMonthly;
  } else {
    planDollars = plansConfig.plans.find((p) => p.id === planId)?.priceMonthly ?? 0;
  }

  const addonDollars = addons.reduce((sum, addonId) => {
    const addon = plansConfig.addons.find((a) => a.id === addonId);
    return sum + (addon?.priceMonthly ?? 0);
  }, 0);

  const totalCredits = Math.round((planDollars + addonDollars) * 100);

  // ── Enforce plan limits ───────────────────────────────────────────────────
  if (user.role !== "ADMIN") {
    const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } });
    if (userRow?.plan === "FREE") {
      const existing = await prisma.server.count({ where: { userId: user.id } });
      if (existing >= 1) {
        return NextResponse.json(
          {
            error: "Free accounts are limited to one server. Upgrade to Pro for unlimited servers.",
            code: "FREE_TIER_LIMIT",
          },
          { status: 403 }
        );
      }
    }
  }

  // ── Resolve egg ───────────────────────────────────────────────────────────
  let egg = requestedEggId
    ? await prisma.egg.findUnique({ where: { id: requestedEggId }, include: { variables: { orderBy: { sortOrder: "asc" } } } })
    : await prisma.egg.findFirst({ where: { name: { contains: "Paper" } }, include: { variables: { orderBy: { sortOrder: "asc" } } } });

  if (!egg) egg = await prisma.egg.findFirst({ include: { variables: { orderBy: { sortOrder: "asc" } } } });
  if (!egg) return NextResponse.json({ error: "No eggs are configured. An admin must set up eggs first." }, { status: 503 });

  // ── Pick a node with a free allocation ───────────────────────────────────
  const nodeWhere = locationId ? { locationId, maintenanceMode: false } : { maintenanceMode: false };
  const nodesWithFreeAlloc = await prisma.node.findMany({
    where: { ...nodeWhere, allocations: { some: { serverId: null } } },
    orderBy: { createdAt: "asc" },
  });
  // Fall back to nodes with no allocations configured (MOCK_WINGS port-auto-assign path)
  const nodeWithNoAllocs = await prisma.node.findFirst({ where: nodeWhere, orderBy: { createdAt: "asc" } });
  const node = nodesWithFreeAlloc[0] ?? nodeWithNoAllocs;
  if (!node) {
    const msg = locationId
      ? "No nodes are available in that location (all nodes may be under maintenance)."
      : "No nodes are available. An admin must add a Wings node or take one out of maintenance.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // ── Build environment from egg defaults + user overrides ─────────────────
  const environment = buildEnvironment(egg.variables, envOverrides);

  // For itzg backward-compat, derive mcVersion and jarType from env
  let mcVersion = environment["MC_VERSION"] ?? "latest";
  if (mcVersion === "latest") {
    try { mcVersion = await getLatestPaperVersion(); } catch { mcVersion = "1.21.4"; }
    environment["MC_VERSION"] = mcVersion;
  }
  const jarType = egg.itzgType.toLowerCase();

  const dockerImage = parsed.data.dockerImage ?? egg.dockerImage;
  const startupCommand = resolveStartup(egg.startup, environment);
  const externalId = uuidv4();

  if (process.env.MOCK_WINGS !== "true") {
    console.warn("[api/servers] Real Wings server creation not yet implemented.");
  }

  // ── Check user has enough credits (skip for admins) ──────────────────────
  if (totalCredits > 0 && user.role !== "ADMIN") {
    const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { credits: true } });
    if ((userRow?.credits ?? 0) < totalCredits) {
      return NextResponse.json(
        {
          error: `Not enough credits. This plan costs ${totalCredits} credits/month and you have ${userRow?.credits ?? 0}.`,
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 }
      );
    }
  }

  // ── Claim a free allocation on the chosen node (if any exist) ────────────
  const freeAllocation = await prisma.allocation.findFirst({
    where: { nodeId: node.id, serverId: null },
    orderBy: { port: "asc" },
  });

  // ── Create server + deduct credits atomically ─────────────────────────────
  const [server] = await prisma.$transaction(async (tx) => {
    const newServer = await tx.server.create({
      data: {
        name,
        userId: user.id,
        nodeId: node.id,
        eggId: egg.id,
        externalId,
        status: "OFFLINE",
        planId,
        nodeTier,
        addons,
        memoryMb,
        diskMb,
        cpuLimit,
        maxBackups,
        maxDatabases,
        mcVersion,
        jarType,
        startupCommand,
        dockerImage,
        environment,
      },
      select: { id: true, name: true, externalId: true },
    });

    if (freeAllocation) {
      await tx.allocation.update({
        where: { id: freeAllocation.id },
        data: { serverId: newServer.id },
      });
    }

    if (totalCredits > 0 && user.role !== "ADMIN") {
      await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: totalCredits } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -totalCredits,
          type: "USAGE",
          description: `Server "${name}" — ${planId} plan${addons.length > 0 ? ` + ${addons.join(", ")}` : ""} (first month)`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        serverId: newServer.id,
        action: "server.create",
        metadata: { name, mcVersion, eggId: egg.id, eggName: egg.name, planId, memoryMb, diskMb, cpuLimit, totalCredits },
      },
    });

    return [newServer];
  });

  // Invalidate the server list cache for this user
  const { cacheDel } = await import("@/lib/redis");
  await cacheDel(`servers:list:${user.id}`);

  return NextResponse.json({ id: server.id, name: server.name }, { status: 201 });
}
