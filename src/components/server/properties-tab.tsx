"use client";

import { useState, useEffect } from "react";
import { Save, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ServerProperties } from "@/lib/server-properties";
import { FREE_MAX_PLAYERS } from "@/lib/server-properties";
import { MOTDEditor } from "./motd-editor";

export interface PropertiesTabData {
  id: string;
  name: string;
  canSettings: boolean;
}

// ── Field primitives ──────────────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
        value ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

function Select({ value, onChange, options, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function NumberInput({ value, onChange, min, max, disabled }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = parseInt(e.target.value);
        if (!isNaN(n)) onChange(n);
      }}
      disabled={disabled}
      className="w-20 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-foreground text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function TextInput({ value, onChange, disabled, maxLength, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      maxLength={maxLength}
      placeholder={placeholder}
      className="w-48 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border px-4 py-2.5 bg-surface-2/40">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropertiesTab({ server }: { server: PropertiesTabData }) {
  const [props, setProps] = useState<ServerProperties | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = server.canSettings;

  useEffect(() => {
    fetch(`/api/servers/${server.id}/properties`)
      .then((r) => r.json())
      .then((data) => {
        setProps(data.props as ServerProperties);
        setIsFree(data.isFree as boolean);
      })
      .catch(() => setError("Failed to load server.properties"))
      .finally(() => setLoading(false));
  }, [server.id]);

  function set<K extends keyof ServerProperties>(key: K, value: ServerProperties[K]) {
    setProps((p) => p ? { ...p, [key]: value } : p);
  }

  async function handleSave() {
    if (!props) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${server.id}/properties`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  if (!props) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">{error ?? "Failed to load properties"}</div>;
  }

  const maxPlayersLocked = isFree;
  const maxPlayersMax = isFree ? FREE_MAX_PLAYERS : 999;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {isFree && (
          <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-xs text-muted">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
            Free plan: max players is capped at {FREE_MAX_PLAYERS}. Upgrade to Pro to allow more.
          </div>
        )}

        {/* Gameplay */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <SectionHeader title="Gameplay" />
          <div className="px-4">
            <FieldRow label="Difficulty">
              <Select
                value={props.difficulty ?? "easy"}
                onChange={(v) => set("difficulty", v as ServerProperties["difficulty"])}
                disabled={!canEdit}
                options={[
                  { value: "peaceful", label: "Peaceful" },
                  { value: "easy", label: "Easy" },
                  { value: "normal", label: "Normal" },
                  { value: "hard", label: "Hard" },
                ]}
              />
            </FieldRow>
            <FieldRow label="Default Game Mode">
              <Select
                value={props.gamemode ?? "survival"}
                onChange={(v) => set("gamemode", v as ServerProperties["gamemode"])}
                disabled={!canEdit}
                options={[
                  { value: "survival", label: "Survival" },
                  { value: "creative", label: "Creative" },
                  { value: "adventure", label: "Adventure" },
                  { value: "spectator", label: "Spectator" },
                ]}
              />
            </FieldRow>
            <FieldRow label="Force Gamemode" hint="Apply default gamemode to all players on join">
              <Toggle value={props["force-gamemode"] ?? false} onChange={(v) => set("force-gamemode", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="PvP">
              <Toggle value={props.pvp ?? true} onChange={(v) => set("pvp", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Hardcore" hint="Players are banned on death">
              <Toggle value={props.hardcore ?? false} onChange={(v) => set("hardcore", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow
              label="Max Players"
              hint={isFree ? `Capped at ${FREE_MAX_PLAYERS} on Free plan` : undefined}
            >
              <div className="flex items-center gap-2">
                {isFree && <Lock className="h-3.5 w-3.5 text-muted" />}
                <NumberInput
                  value={Math.min(props["max-players"] ?? 20, maxPlayersMax)}
                  onChange={(v) => set("max-players", Math.min(v, maxPlayersMax))}
                  min={1}
                  max={maxPlayersMax}
                  disabled={!canEdit || maxPlayersLocked}
                />
              </div>
            </FieldRow>
          </div>
        </div>

        {/* World */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <SectionHeader title="World" />
          <div className="px-4">
            <FieldRow label="Level Seed" hint="Leave blank for a random seed">
              <TextInput
                value={props["level-seed"] ?? ""}
                onChange={(v) => set("level-seed", v)}
                disabled={!canEdit}
                placeholder="Random"
              />
            </FieldRow>
            <FieldRow label="Allow Nether">
              <Toggle value={props["allow-nether"] ?? true} onChange={(v) => set("allow-nether", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="View Distance" hint="Chunks loaded around each player (2–32)">
              <NumberInput value={props["view-distance"] ?? 10} onChange={(v) => set("view-distance", v)} min={2} max={32} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Simulation Distance" hint="Chunks with active game logic (2–32)">
              <NumberInput value={props["simulation-distance"] ?? 10} onChange={(v) => set("simulation-distance", v)} min={2} max={32} disabled={!canEdit} />
            </FieldRow>
          </div>
        </div>

        {/* Spawning */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <SectionHeader title="Spawning" />
          <div className="px-4">
            <FieldRow label="Spawn Monsters">
              <Toggle value={props["spawn-monsters"] ?? true} onChange={(v) => set("spawn-monsters", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Spawn Animals">
              <Toggle value={props["spawn-animals"] ?? true} onChange={(v) => set("spawn-animals", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Spawn NPCs" hint="Villagers">
              <Toggle value={props["spawn-npcs"] ?? true} onChange={(v) => set("spawn-npcs", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Spawn Protection" hint="Radius around spawn that non-ops cannot edit">
              <NumberInput value={props["spawn-protection"] ?? 16} onChange={(v) => set("spawn-protection", v)} min={0} max={100} disabled={!canEdit} />
            </FieldRow>
          </div>
        </div>

        {/* Access */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <SectionHeader title="Access" />
          <div className="px-4">
            <FieldRow label="Whitelist">
              <Toggle value={props["white-list"] ?? false} onChange={(v) => set("white-list", v)} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Enforce Whitelist" hint="Kick non-whitelisted players on reload">
              <Toggle value={props["enforce-whitelist"] ?? false} onChange={(v) => set("enforce-whitelist", v)} disabled={!canEdit} />
            </FieldRow>
          </div>
        </div>

        {/* MOTD */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <SectionHeader title="MOTD" />
          <div className="px-4 py-4">
            <MOTDEditor
              value={props.motd ?? "A Minecraft Server"}
              onChange={(v) => set("motd", v)}
              disabled={!canEdit}
              serverName={server.name}
            />
          </div>
        </div>

        {error && <p className="text-xs text-status-offline">{error}</p>}

        {canEdit && (
          <div className="flex justify-end pb-4">
            <Button onClick={handleSave} disabled={saving} loading={saving} size="sm">
              <Save className="h-3.5 w-3.5" />
              {saved ? "Saved!" : "Save changes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
