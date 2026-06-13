import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { getLatestPaperVersion } from "@/lib/paper-api";
import { buildEnvironment, resolveStartup } from "@/lib/egg-env";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const servers = await prisma.server.findMany({
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
      createdAt: true,
      user: { select: { id: true, email: true } },
      node: { select: { id: true, name: true, fqdn: true } },
    },
  });

  return NextResponse.json({ servers });
}

const CreateServerSchema = z.object({
  name:        z.string().min(1).max(32).regex(/^[a-zA-Z0-9 _-]+$/),
  userId:      z.string().cuid(),
  nodeId:      z.string().cuid().optional(),
  eggId:       z.string().cuid().optional(),
  dockerImage: z.string().optional(),
  environment: z.record(z.string()).default({}),
  memoryMb:    z.number().int().min(512).max(65536).default(2048),
  diskMb:      z.number().int().min(1024).max(524288).default(10240),
  cpuLimit:    z.number().int().min(10).max(1600).default(100),
});

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, userId, nodeId: requestedNodeId, eggId: requestedEggId, environment: envOverrides, memoryMb, diskMb, cpuLimit } = parsed.data;

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!targetUser) return NextResponse.json({ error: "Target user not found" }, { status: 404 });

  let node;
  if (requestedNodeId) {
    node = await prisma.node.findUnique({ where: { id: requestedNodeId } });
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  } else {
    node = await prisma.node.findFirst({ orderBy: { createdAt: "asc" } });
    if (!node) return NextResponse.json({ error: "No nodes are configured." }, { status: 503 });
  }

  // ── Resolve egg ───────────────────────────────────────────────────────────
  let egg = requestedEggId
    ? await prisma.egg.findUnique({ where: { id: requestedEggId }, include: { variables: { orderBy: { sortOrder: "asc" } } } })
    : await prisma.egg.findFirst({ where: { name: { contains: "Paper" } }, include: { variables: { orderBy: { sortOrder: "asc" } } } });
  if (!egg) egg = await prisma.egg.findFirst({ include: { variables: { orderBy: { sortOrder: "asc" } } } });
  if (!egg) return NextResponse.json({ error: "No eggs configured." }, { status: 503 });

  const environment = buildEnvironment(egg.variables, envOverrides);
  let mcVersion = environment["MC_VERSION"] ?? "latest";
  if (mcVersion === "latest") {
    try { mcVersion = await getLatestPaperVersion(); } catch { mcVersion = "1.21.4"; }
    environment["MC_VERSION"] = mcVersion;
  }
  const jarType = egg.itzgType.toLowerCase();
  const dockerImage = parsed.data.dockerImage ?? egg.dockerImage;
  const startupCommand = resolveStartup(egg.startup, environment);
  const externalId = uuidv4();

  const freeAllocation = await prisma.allocation.findFirst({
    where: { nodeId: node.id, serverId: null },
    orderBy: { port: "asc" },
  });

  const server = await prisma.server.create({
    data: {
      name, userId, nodeId: node.id, eggId: egg.id, externalId,
      status: "OFFLINE", memoryMb, diskMb, cpuLimit,
      mcVersion, jarType, startupCommand, dockerImage, environment,
    },
    select: { id: true, name: true, externalId: true },
  });

  if (freeAllocation) {
    await prisma.allocation.update({
      where: { id: freeAllocation.id },
      data: { serverId: server.id },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      serverId: server.id,
      action: "admin.server.create",
      metadata: { name, targetUserId: userId, mcVersion, eggId: egg.id, eggName: egg.name, memoryMb },
    },
  });

  return NextResponse.json({ server }, { status: 201 });
}
