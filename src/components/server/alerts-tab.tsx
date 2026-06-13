"use client";

import { useState, useEffect } from "react";
import {
  Bell, Trash2, Send, MemoryStick, Gauge,
  Play, Square, Zap, User, ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AlertsTabData {
  id: string;
  isOwner: boolean;
}

// ── Types (mirrors EmbedCustomization in discord-alerts.ts) ───────────────────

type AlertEvent = "server_start" | "server_stop" | "server_crash" | "high_ram" | "low_tps" | "player_join";

interface EmbedCustomization {
  title?: string;
  description?: string;
  color?: string;       // "#RRGGBB"
  footerText?: string;
}

type EmbedConfigs = Partial<Record<AlertEvent, EmbedCustomization>>;

interface WebhookConfig {
  webhookUrl:    string;
  onStart:       boolean;
  onStop:        boolean;
  onCrash:       boolean;
  onHighRam:     boolean;
  ramThreshold:  number;
  onLowTps:      boolean;
  tpsThreshold:  number;
  onPlayerJoin:  boolean;
  watchedPlayer: string | null;
  embedConfigs:  EmbedConfigs;
}

const DEFAULT: WebhookConfig = {
  webhookUrl: "", onStart: true, onStop: true, onCrash: true,
  onHighRam: false, ramThreshold: 90, onLowTps: false, tpsThreshold: 15,
  onPlayerJoin: false, watchedPlayer: null, embedConfigs: {},
};

// Default titles / colors for each event (mirrors discord-alerts.ts)
const EVENT_META: Record<AlertEvent, { icon: React.ElementType; iconBg: string; label: string; desc: string; defaultTitle: string; defaultColor: string }> = {
  server_start: { icon: Play,        iconBg: "bg-green-500/10 text-green-400",  label: "Server Start",  desc: "When the server finishes starting up",               defaultTitle: "🟢 Server Started",    defaultColor: "#57F287" },
  server_stop:  { icon: Square,      iconBg: "bg-red-500/10 text-red-400",      label: "Server Stop",   desc: "When the server is stopped or restarted",            defaultTitle: "🔴 Server Stopped",    defaultColor: "#ED4245" },
  server_crash: { icon: Zap,         iconBg: "bg-orange-500/10 text-orange-400",label: "Server Crash",  desc: "When the server stops unexpectedly",                 defaultTitle: "💥 Server Crashed",    defaultColor: "#FF0000" },
  high_ram:     { icon: MemoryStick, iconBg: "bg-blue-500/10 text-blue-400",    label: "High RAM",      desc: "When RAM exceeds the threshold",                     defaultTitle: "⚠️ High RAM Usage",    defaultColor: "#FEE75C" },
  low_tps:      { icon: Gauge,       iconBg: "bg-yellow-500/10 text-yellow-400",label: "Low TPS",       desc: "When TPS drops below threshold (Paper/Spigot only)", defaultTitle: "⚠️ Low TPS Detected",  defaultColor: "#FFA500" },
  player_join:  { icon: User,        iconBg: "bg-purple-500/10 text-purple-400",label: "Player Join",   desc: "When a player joins the server",                     defaultTitle: "👤 Player Joined",     defaultColor: "#5865F2" },
};

const EVENT_ORDER: AlertEvent[] = ["server_start","server_stop","server_crash","high_ram","low_tps","player_join"];
const ENABLED_KEY: Record<AlertEvent, keyof WebhookConfig> = {
  server_start: "onStart",  server_stop: "onStop",  server_crash: "onCrash",
  high_ram: "onHighRam",    low_tps: "onLowTps",    player_join: "onPlayerJoin",
};

// ── Primitives ────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        value ? "bg-accent" : "bg-surface-2",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span className={cn("pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform", value ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}

// ── Embed customization editor ────────────────────────────────────────────────

function EmbedEditor({
  event, custom, onChange, disabled,
}: {
  event: AlertEvent;
  custom: EmbedCustomization;
  onChange: (c: EmbedCustomization) => void;
  disabled?: boolean;
}) {
  const meta = EVENT_META[event];

  function set<K extends keyof EmbedCustomization>(key: K, val: EmbedCustomization[K]) {
    onChange({ ...custom, [key]: val || undefined });
  }

  const previewColor = custom.color || meta.defaultColor;
  const hasCustom = !!(custom.title || custom.description || custom.color || custom.footerText);

  return (
    <div className="space-y-3">
      {/* Color bar preview */}
      <div
        className="h-1.5 w-full rounded-full transition-colors duration-200"
        style={{ backgroundColor: previewColor }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-muted">
            Title
            <span className="ml-1 font-normal text-muted/60">— variables: {"{server}"}</span>
          </label>
          <input
            type="text"
            value={custom.title ?? ""}
            onChange={e => set("title", e.target.value)}
            disabled={disabled}
            placeholder={meta.defaultTitle}
            maxLength={256}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-muted">
            Description
            <span className="ml-1 font-normal text-muted/60">
              — variables:{" "}
              {event === "player_join" && "{player}, "}
              {event === "high_ram"    && "{ram}, "}
              {event === "low_tps"     && "{tps}, "}
              {"{server}"}
            </span>
          </label>
          <textarea
            value={custom.description ?? ""}
            onChange={e => set("description", e.target.value)}
            disabled={disabled}
            placeholder="Leave blank to use no description."
            maxLength={4096}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Color */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Embed Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={previewColor}
              onChange={e => set("color", e.target.value)}
              disabled={disabled}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-surface p-0.5 disabled:opacity-50"
            />
            <input
              type="text"
              value={custom.color ?? ""}
              onChange={e => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set("color", v.length === 7 ? v : undefined);
              }}
              disabled={disabled}
              placeholder={meta.defaultColor}
              maxLength={7}
              className="w-24 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm text-foreground placeholder:text-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Footer Text</label>
          <input
            type="text"
            value={custom.footerText ?? ""}
            onChange={e => set("footerText", e.target.value)}
            disabled={disabled}
            placeholder="HobbyPanel"
            maxLength={2048}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
        </div>
      </div>

      {/* Reset to defaults */}
      {hasCustom && (
        <button
          onClick={() => onChange({})}
          disabled={disabled}
          className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to defaults
        </button>
      )}
    </div>
  );
}

// ── Event row ────────────────────────────────────────────────────────────────

function EventRow({
  event, enabled, config, onToggle, onConfigChange, disabled,
}: {
  event: AlertEvent;
  enabled: boolean;
  config: WebhookConfig;
  onToggle: (enabled: boolean) => void;
  onConfigChange: (key: keyof WebhookConfig, value: unknown) => void;
  disabled?: boolean;
}) {
  const [showEmbed, setShowEmbed] = useState(false);
  const meta = EVENT_META[event];
  const Icon = meta.icon;
  const custom = config.embedConfigs[event] ?? {};
  const hasCustomEmbed = !!(custom.title || custom.description || custom.color || custom.footerText);

  return (
    <div className={cn("rounded-lg border transition-colors overflow-hidden", enabled ? "border-accent/30 bg-accent/5" : "border-border bg-surface")}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.iconBg)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{meta.label}</p>
            <p className="text-xs text-muted">{meta.desc}</p>
          </div>
        </div>
        <Toggle value={enabled} onChange={onToggle} disabled={disabled} />
      </div>

      {/* Threshold / filter settings */}
      {enabled && (event === "high_ram" || event === "low_tps" || event === "player_join") && (
        <div className="border-t border-border/50 px-4 py-3 bg-surface-2/30">
          {event === "high_ram" && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Alert when RAM exceeds</span>
              <div className="flex items-center gap-1.5">
                <input type="number" value={config.ramThreshold} min={50} max={99} disabled={disabled}
                  onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) onConfigChange("ramThreshold", Math.max(50, Math.min(99, n))); }}
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50" />
                <span className="text-xs text-muted">%</span>
              </div>
            </div>
          )}
          {event === "low_tps" && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Alert when TPS drops below</span>
              <div className="flex items-center gap-1.5">
                <input type="number" value={config.tpsThreshold} min={1} max={19} step={0.5} disabled={disabled}
                  onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) onConfigChange("tpsThreshold", Math.max(1, Math.min(19, n))); }}
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50" />
                <span className="text-xs text-muted">TPS</span>
              </div>
            </div>
          )}
          {event === "player_join" && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted shrink-0">Only notify for (blank = any player)</span>
              <input
                type="text" value={config.watchedPlayer ?? ""} maxLength={16} disabled={disabled}
                onChange={e => onConfigChange("watchedPlayer", e.target.value || null)}
                placeholder="Any player"
                className="w-36 rounded-md border border-border bg-surface px-2.5 py-1 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              />
            </div>
          )}
        </div>
      )}

      {/* Embed customization toggle */}
      {enabled && (
        <>
          <div className="border-t border-border/50">
            <button
              onClick={() => setShowEmbed(v => !v)}
              className="flex w-full items-center justify-between px-4 py-2 text-[11px] font-medium text-muted hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                Customize embed
                {hasCustomEmbed && <span className="rounded-full bg-accent/20 px-1.5 py-px text-[9px] font-semibold text-accent uppercase tracking-wider">Custom</span>}
              </span>
              {showEmbed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          {showEmbed && (
            <div className="border-t border-border/50 px-4 py-4 bg-surface-2/20">
              <EmbedEditor
                event={event}
                custom={custom}
                onChange={c => {
                  const next: EmbedConfigs = { ...config.embedConfigs, [event]: Object.keys(c).length > 0 ? c : undefined };
                  onConfigChange("embedConfigs", next);
                }}
                disabled={disabled}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AlertsTab({ server }: { server: AlertsTabData }) {
  const [config, setConfig]         = useState<WebhookConfig>(DEFAULT);
  const [hasWebhook, setHasWebhook] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [testMsg, setTestMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const canEdit = server.isOwner;

  useEffect(() => {
    fetch(`/api/servers/${server.id}/discord-webhook`)
      .then(r => r.json())
      .then((d: { webhook: (WebhookConfig & { embedConfigs?: EmbedConfigs }) | null }) => {
        if (d.webhook) {
          setConfig({ ...DEFAULT, ...d.webhook, embedConfigs: (d.webhook.embedConfigs ?? {}) as EmbedConfigs });
          setHasWebhook(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [server.id]);

  function setField<K extends keyof WebhookConfig>(key: K, value: WebhookConfig[K]) {
    setConfig(p => ({ ...p, [key]: value }));
  }

  function handleEventToggle(event: AlertEvent, enabled: boolean) {
    setField(ENABLED_KEY[event] as keyof WebhookConfig, enabled as never);
  }

  async function handleSave() {
    if (!config.webhookUrl) { setError("Webhook URL is required"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/servers/${server.id}/discord-webhook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      setHasWebhook(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    if (!config.webhookUrl) { setError("Enter a webhook URL first"); return; }
    setTesting(true); setTestMsg(null);
    try {
      const res = await fetch(`/api/servers/${server.id}/discord-webhook/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: config.webhookUrl }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      setTestMsg(res.ok ? { ok: true, text: "Test message sent to Discord!" } : { ok: false, text: data.error ?? "Failed" });
    } catch { setTestMsg({ ok: false, text: "Network error" }); }
    finally { setTesting(false); }
  }

  async function handleDelete() {
    await fetch(`/api/servers/${server.id}/discord-webhook`, { method: "DELETE" });
    setConfig(DEFAULT);
    setHasWebhook(false);
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Bell className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Discord Alerts</h2>
            <p className="text-xs text-muted">Get notified in Discord when things happen on your server</p>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Webhook URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={config.webhookUrl}
              onChange={e => setField("webhookUrl", e.target.value)}
              disabled={!canEdit}
              placeholder="https://discord.com/api/webhooks/..."
              className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing || !config.webhookUrl} loading={testing}>
              <Send className="h-3.5 w-3.5" />
              Test
            </Button>
          </div>
          {testMsg && <p className={cn("text-xs", testMsg.ok ? "text-status-online" : "text-status-offline")}>{testMsg.text}</p>}
          <p className="text-[11px] text-muted">
            In Discord: Edit Channel → Integrations → Webhooks → New Webhook → Copy URL
          </p>
        </div>

        {/* Alert events */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted px-1">Alert Events</p>
          {EVENT_ORDER.map(event => (
            <EventRow
              key={event}
              event={event}
              enabled={!!config[ENABLED_KEY[event]]}
              config={config}
              onToggle={enabled => handleEventToggle(event, enabled)}
              onConfigChange={(key, value) => setField(key, value as never)}
              disabled={!canEdit}
            />
          ))}
        </div>

        {error && <p className="text-xs text-status-offline">{error}</p>}

        {canEdit && (
          <div className="flex items-center justify-between">
            {hasWebhook ? (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs text-status-offline/70 hover:text-status-offline transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove webhook
              </button>
            ) : <span />}
            <Button onClick={handleSave} disabled={saving} loading={saving} size="sm">
              {saved ? "Saved!" : "Save alerts"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
