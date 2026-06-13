"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Shield,
  Ban,
  Crown,
  RefreshCw,
  UserX,
  UserCheck,
  UserMinus,
  Plus,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PlayersTabData {
  id: string;
  status: string;
  canConsole: boolean;
}

interface WhitelistEntry { uuid: string; name: string; }
interface BanEntry { uuid?: string; name: string; created: string; source: string; expires: string; reason: string; }
interface PlayerData {
  online: string[];
  whitelist: WhitelistEntry[];
  banned: BanEntry[];
  ops: WhitelistEntry[];
}

type ActionState = "idle" | "loading" | "done" | "error";

function useAction(serverId: string) {
  const [pending, setPending] = useState<Record<string, ActionState>>({});

  async function run(key: string, action: string, player: string, reason?: string, onDone?: () => void) {
    setPending((s) => ({ ...s, [key]: "loading" }));
    try {
      const res = await fetch(`/api/servers/${serverId}/players/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, player, reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setPending((s) => ({ ...s, [key]: "done" }));
      onDone?.();
      setTimeout(() => setPending((s) => ({ ...s, [key]: "idle" })), 1_500);
    } catch {
      setPending((s) => ({ ...s, [key]: "error" }));
      setTimeout(() => setPending((s) => ({ ...s, [key]: "idle" })), 3_000);
    }
  }

  return { pending, run };
}

function ActionButton({
  label, icon: Icon, state, onClick, variant = "ghost", disabled,
}: {
  label: string;
  icon: React.ElementType;
  state: ActionState;
  onClick: () => void;
  variant?: "ghost" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || state === "loading"}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        variant === "danger"
          ? "text-status-offline hover:bg-status-offline/10"
          : "text-muted hover:bg-surface-2 hover:text-foreground",
        state === "done" && "text-status-online",
        state === "error" && "text-status-offline",
      )}
    >
      {state === "loading" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {label}
    </button>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: React.ElementType; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon className="h-4 w-4 text-muted" />
        <span className="text-sm font-medium text-foreground">{title}</span>
        {count !== undefined && (
          <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{count}</span>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-4 py-3 text-xs text-muted opacity-60">{label}</div>
  );
}

export function PlayersTab({ server }: { server: PlayersTabData }) {
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addWhitelistInput, setAddWhitelistInput] = useState("");
  const [addWhitelistLoading, setAddWhitelistLoading] = useState(false);
  const { pending, run } = useAction(server.id);

  const isOnline = server.status === "ONLINE";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${server.id}/players`);
      if (!res.ok) throw new Error("Failed to load player data");
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [server.id]);

  useEffect(() => { refresh(); }, [refresh]);

  async function addWhitelist() {
    const name = addWhitelistInput.trim();
    if (!name) return;
    setAddWhitelistLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/players/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "whitelist-add", player: name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setAddWhitelistInput("");
      await refresh();
    } catch { /* ignore */ } finally {
      setAddWhitelistLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-status-online" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted" />
            )}
            <span className="text-sm text-muted">
              {isOnline ? "Server is online" : "Server is offline — showing stored data"}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded border border-status-offline/30 bg-status-offline/10 px-3 py-2 text-xs text-status-offline">
            {error}
          </div>
        )}

        {/* Online Players */}
        <Section title="Online Players" icon={Users} count={data?.online.length ?? 0}>
          {!data?.online.length ? (
            <EmptyRow label="No players online" />
          ) : (
            data.online.map((name) => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://mc-heads.net/avatar/${name}/24`}
                    alt={name}
                    className="h-6 w-6 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-sm font-medium text-foreground">{name}</span>
                </div>
                {server.canConsole && (
                  <div className="flex items-center gap-0.5">
                    <ActionButton
                      label="Kick"
                      icon={UserX}
                      state={pending[`kick-${name}`] ?? "idle"}
                      onClick={() => run(`kick-${name}`, "kick", name, undefined, refresh)}
                    />
                    <ActionButton
                      label="Ban"
                      icon={Ban}
                      state={pending[`ban-${name}`] ?? "idle"}
                      onClick={() => run(`ban-${name}`, "ban", name, undefined, refresh)}
                      variant="danger"
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </Section>

        {/* Whitelist */}
        <Section title="Whitelist" icon={Shield} count={data?.whitelist.length ?? 0}>
          {server.canConsole && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <input
                type="text"
                value={addWhitelistInput}
                onChange={(e) => setAddWhitelistInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWhitelist()}
                placeholder="Add player to whitelist…"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={addWhitelist}
                disabled={!addWhitelistInput.trim() || addWhitelistLoading}
                className="h-6 px-2"
              >
                {addWhitelistLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </div>
          )}
          {!data?.whitelist.length ? (
            <EmptyRow label="Whitelist is empty or disabled" />
          ) : (
            data.whitelist.map((entry) => (
              <div key={entry.uuid} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://mc-heads.net/avatar/${entry.name}/24`}
                    alt={entry.name}
                    className="h-6 w-6 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-sm text-foreground">{entry.name}</span>
                </div>
                {server.canConsole && (
                  <ActionButton
                    label="Remove"
                    icon={UserMinus}
                    state={pending[`wl-remove-${entry.name}`] ?? "idle"}
                    onClick={() => run(`wl-remove-${entry.name}`, "whitelist-remove", entry.name, undefined, refresh)}
                    variant="danger"
                  />
                )}
              </div>
            ))
          )}
        </Section>

        {/* Ops */}
        <Section title="Operators" icon={Crown} count={data?.ops.length ?? 0}>
          {!data?.ops.length ? (
            <EmptyRow label="No operators" />
          ) : (
            data.ops.map((entry) => (
              <div key={entry.uuid} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://mc-heads.net/avatar/${entry.name}/24`}
                    alt={entry.name}
                    className="h-6 w-6 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-sm text-foreground">{entry.name}</span>
                </div>
                {server.canConsole && (
                  <ActionButton
                    label="De-op"
                    icon={UserCheck}
                    state={pending[`deop-${entry.name}`] ?? "idle"}
                    onClick={() => run(`deop-${entry.name}`, "deop", entry.name, undefined, refresh)}
                    variant="danger"
                  />
                )}
              </div>
            ))
          )}
        </Section>

        {/* Banned */}
        <Section title="Banned Players" icon={Ban} count={data?.banned.length ?? 0}>
          {!data?.banned.length ? (
            <EmptyRow label="No banned players" />
          ) : (
            data.banned.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://mc-heads.net/avatar/${entry.name}/24`}
                    alt={entry.name}
                    className="h-6 w-6 shrink-0 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{entry.name}</p>
                    {entry.reason && entry.reason !== "Banned by an operator." && (
                      <p className="truncate text-[11px] text-muted">{entry.reason}</p>
                    )}
                  </div>
                </div>
                {server.canConsole && (
                  <ActionButton
                    label="Pardon"
                    icon={UserCheck}
                    state={pending[`unban-${entry.name}`] ?? "idle"}
                    onClick={() => run(`unban-${entry.name}`, "unban", entry.name, undefined, refresh)}
                  />
                )}
              </div>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}
