/**
 * Discord webhook alert engine.
 *
 * All public functions are async and safe to call fire-and-forget (.catch(console.error)).
 *
 * Embed template variables (available in title / description):
 *   {server}  — server name
 *   {player}  — player username (player_join)
 *   {ram}     — RAM % (high_ram)
 *   {tps}     — TPS value (low_tps)
 */

import { prisma } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertEvent =
  | "server_start"
  | "server_stop"
  | "server_crash"
  | "high_ram"
  | "low_tps"
  | "player_join";

export interface AlertPayload {
  ramPercent?: number;
  tps?: number;
  player?: string;
}

export interface EmbedCustomization {
  title?: string;
  description?: string;
  color?: string;        // "#RRGGBB" hex string
  footerText?: string;
}

export type EmbedConfigs = Partial<Record<AlertEvent, EmbedCustomization>>;

// ── Default embed templates ───────────────────────────────────────────────────

const DEFAULT_COLORS: Record<AlertEvent, number> = {
  server_start: 0x57F287,
  server_stop:  0xED4245,
  server_crash: 0xFF0000,
  high_ram:     0xFEE75C,
  low_tps:      0xFFA500,
  player_join:  0x5865F2,
};

const DEFAULT_TITLES: Record<AlertEvent, string> = {
  server_start: "🟢 Server Started",
  server_stop:  "🔴 Server Stopped",
  server_crash: "💥 Server Crashed",
  high_ram:     "⚠️ High RAM Usage",
  low_tps:      "⚠️ Low TPS Detected",
  player_join:  "👤 Player Joined",
};

// ── Per-run server_start deduplication ───────────────────────────────────────
// Ensures server_start fires exactly once between a start and stop event,
// regardless of whether the log-based or status-transition trigger fires first.

const startFired = new Set<string>();  // externalId → has start alert been sent this run?

/**
 * Call this when a server stops (graceful or crash) to allow the next start to fire.
 * Called by both docker-runner (doStop) and ws-handler (status transition to offline).
 */
export function clearStartAlert(externalId: string) {
  startFired.delete(externalId);
}

// ── Webhook + server cache ────────────────────────────────────────────────────

type CacheEntry = {
  webhook: NonNullable<Awaited<ReturnType<typeof prisma.discordWebhook.findUnique>>> | null;
  serverName: string;
  ts: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30_000;

async function getCached(externalId: string): Promise<CacheEntry> {
  const hit = cache.get(externalId);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit;

  const server = await prisma.server.findFirst({
    where: { externalId },
    include: { discordWebhook: true },
  });
  const entry: CacheEntry = {
    webhook: server?.discordWebhook ?? null,
    serverName: server?.name ?? "Server",
    ts: Date.now(),
  };
  cache.set(externalId, entry);
  return entry;
}

/** Call after saving new webhook config so the next alert uses fresh data. */
export function invalidateWebhookCache(externalId: string) {
  cache.delete(externalId);
}

// ── Per-event cooldowns ───────────────────────────────────────────────────────

const cooldowns = new Map<string, number>();

const COOLDOWN_MS: Partial<Record<AlertEvent, number>> = {
  high_ram: 5 * 60_000,
  low_tps:  5 * 60_000,
};

function isCooling(key: string, ms: number): boolean {
  const last = cooldowns.get(key) ?? 0;
  return Date.now() - last < ms;
}

// ── Template interpolation ────────────────────────────────────────────────────

function interpolate(template: string, serverName: string, payload: AlertPayload): string {
  return template
    .replace(/\{server\}/g, serverName)
    .replace(/\{player\}/g,  payload.player      ?? "")
    .replace(/\{ram\}/g,     payload.ramPercent !== undefined ? `${payload.ramPercent.toFixed(1)}%` : "")
    .replace(/\{tps\}/g,     payload.tps         !== undefined ? payload.tps.toFixed(2) : "");
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace(/^#/, ""), 16);
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Fire a Discord webhook alert.
 * @param externalId  The server's Docker UUID (externalId in DB), not the panel DB id.
 */
export async function fireAlert(
  externalId: string,
  event: AlertEvent,
  payload: AlertPayload = {}
): Promise<void> {
  // server_start dedup: fire at most once per start/stop cycle
  if (event === "server_start") {
    if (startFired.has(externalId)) return;
    startFired.add(externalId);
  }

  const { webhook, serverName } = await getCached(externalId);
  if (!webhook) return;

  // Check if this event type is enabled
  const enabled =
    (event === "server_start" && webhook.onStart)     ||
    (event === "server_stop"  && webhook.onStop)      ||
    (event === "server_crash" && webhook.onCrash)     ||
    (event === "high_ram"     && webhook.onHighRam)   ||
    (event === "low_tps"      && webhook.onLowTps)    ||
    (event === "player_join"  && webhook.onPlayerJoin);

  if (!enabled) {
    // Undo the startFired entry since the event isn't enabled
    if (event === "server_start") startFired.delete(externalId);
    return;
  }

  // Threshold checks
  if (event === "high_ram" && payload.ramPercent !== undefined) {
    if (payload.ramPercent < webhook.ramThreshold) return;
  }
  if (event === "low_tps" && payload.tps !== undefined) {
    if (payload.tps >= webhook.tpsThreshold) return;
  }
  if (event === "player_join" && webhook.watchedPlayer && payload.player) {
    if (payload.player.toLowerCase() !== webhook.watchedPlayer.toLowerCase()) return;
  }

  // Per-event cooldown (high_ram, low_tps)
  const cdMs = COOLDOWN_MS[event];
  if (cdMs) {
    const cdKey = `${webhook.serverId}:${event}`;
    if (isCooling(cdKey, cdMs)) return;
    cooldowns.set(cdKey, Date.now());
  }

  // Resolve embed customization
  const configs = (webhook.embedConfigs ?? {}) as EmbedConfigs;
  const custom  = configs[event] ?? {};

  const title       = custom.title   ? interpolate(custom.title,       serverName, payload) : DEFAULT_TITLES[event];
  const description = custom.description ? interpolate(custom.description, serverName, payload) : undefined;
  const color       = custom.color   ? hexToInt(custom.color) : DEFAULT_COLORS[event];
  const footerText  = custom.footerText ?? "HobbyPanel";

  // Build auto fields from payload
  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Server", value: serverName, inline: true },
  ];
  if (payload.ramPercent !== undefined) fields.push({ name: "RAM",    value: `${payload.ramPercent.toFixed(1)}%`,  inline: true });
  if (payload.tps        !== undefined) fields.push({ name: "TPS",    value: `${payload.tps.toFixed(2)} / 20.00`, inline: true });
  if (payload.player)                   fields.push({ name: "Player", value: payload.player,                       inline: true });

  await fetch(webhook.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title,
        ...(description ? { description } : {}),
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: footerText },
      }],
    }),
  });
}
