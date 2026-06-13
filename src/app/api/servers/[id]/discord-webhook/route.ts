import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerAccess } from "../_shared";
import { prisma } from "@/lib/db";
import { invalidateWebhookCache } from "@/lib/discord-alerts";

export const dynamic = "force-dynamic";

const EmbedCustomizationSchema = z.object({
  title:       z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  footerText:  z.string().max(2048).optional(),
});

const ALERT_EVENTS = ["server_start","server_stop","server_crash","high_ram","low_tps","player_join"] as const;

const WebhookSchema = z.object({
  webhookUrl:    z.string().url(),
  onStart:       z.boolean().default(true),
  onStop:        z.boolean().default(true),
  onCrash:       z.boolean().default(true),
  onHighRam:     z.boolean().default(false),
  ramThreshold:  z.number().int().min(50).max(99).default(90),
  onLowTps:      z.boolean().default(false),
  tpsThreshold:  z.number().min(1).max(20).default(15),
  onPlayerJoin:  z.boolean().default(false),
  watchedPlayer: z.string().max(16).nullable().optional(),
  embedConfigs:  z.record(z.enum(ALERT_EVENTS), EmbedCustomizationSchema).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const webhook = await prisma.discordWebhook.findUnique({ where: { serverId: id } });
  return NextResponse.json({ webhook });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = WebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const data = {
    ...parsed.data,
    watchedPlayer: parsed.data.watchedPlayer ?? null,
    embedConfigs: parsed.data.embedConfigs ?? {},
  };

  const webhook = await prisma.discordWebhook.upsert({
    where:  { serverId: id },
    update: data,
    create: { serverId: id, ...data },
  });

  // Bust the in-process webhook cache so alerts use the new config immediately
  invalidateWebhookCache(access.server.externalId);

  return NextResponse.json({ webhook });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  await prisma.discordWebhook.deleteMany({ where: { serverId: id } });
  invalidateWebhookCache(access.server.externalId);
  return NextResponse.json({ ok: true });
}
