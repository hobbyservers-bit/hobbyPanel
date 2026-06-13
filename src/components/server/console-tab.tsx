"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  KeyboardEvent,
} from "react";
import { Play, Square, RotateCcw, Zap, Terminal, ChevronRight, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes, formatUptime } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { parseAnsiLine, type AnsiSpan } from "./ansi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConsoleLine {
  id: number;
  spans: AnsiSpan[];
}

export interface StatsSnapshot {
  cpuPercent: number;
  memoryMb: number;
  diskMb: number;
  uptimeSeconds: number;
}

type ServerStatus = "running" | "offline" | "starting" | "stopping";

interface ServerData {
  id: string;
  name: string;
  memoryMb: number;
  diskMb: number;
  nodeFqdn: string;
  isOwner: boolean;
  canPower: boolean;
  canConsole: boolean;
}

// ── Console renderer ──────────────────────────────────────────────────────────

const MAX_LINES = 5_000;
const HISTORY_CAP = 100;

let lineIdCounter = 0;

function makeLine(raw: string): ConsoleLine {
  return { id: lineIdCounter++, spans: parseAnsiLine(raw) };
}

function ConsoleOutput({ lines }: { lines: ConsoleLine[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Keep pinned to bottom when new lines arrive
  useEffect(() => {
    if (pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [lines]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden bg-black/30"
      style={{ minHeight: 0 }}
      onScroll={handleScroll}
    >
      <div className="py-1">
        {lines.map((line) => (
          <div
            key={line.id}
            className="whitespace-pre-wrap break-all px-2 font-mono text-[12px] leading-5 text-foreground/90"
          >
            {line.spans.length > 0 ? (
              line.spans.map((s, j) => (
                <span key={j} style={{ color: s.color, fontWeight: s.bold ? "bold" : undefined }}>
                  {s.text}
                </span>
              ))
            ) : (
              " "
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({
  stats,
  cpuHistory,
  ramHistory,
  memoryMb,
  status,
}: {
  stats: StatsSnapshot | null;
  cpuHistory: number[];
  ramHistory: number[];
  memoryMb: number;
  status: ServerStatus;
}) {
  const isActive = status === "running" || status === "starting";

  return (
    <div className="flex shrink-0 items-center gap-6 border-b border-border bg-surface px-4 py-2">
      {/* CPU */}
      <div className="flex items-center gap-2">
        <Sparkline data={cpuHistory.length ? cpuHistory : [0]} color="#f59e0b" min={0} max={100} />
        <div className="text-xs">
          <div className="text-muted">CPU</div>
          <div className="font-medium text-foreground">
            {isActive && stats ? `${stats.cpuPercent.toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      {/* RAM */}
      <div className="flex items-center gap-2">
        <Sparkline data={ramHistory.length ? ramHistory : [0]} color="#61afef" min={0} max={memoryMb} />
        <div className="text-xs">
          <div className="text-muted">RAM</div>
          <div className="font-medium text-foreground">
            {isActive && stats
              ? `${formatBytes(stats.memoryMb * 1_048_576)} / ${formatBytes(memoryMb * 1_048_576)}`
              : "—"}
          </div>
        </div>
      </div>

      {/* Uptime */}
      <div className="ml-auto text-xs">
        <div className="text-muted">Uptime</div>
        <div className="font-medium text-foreground">
          {isActive && stats && stats.uptimeSeconds > 0
            ? formatUptime(stats.uptimeSeconds)
            : "—"}
        </div>
      </div>
    </div>
  );
}

// ── Power buttons ─────────────────────────────────────────────────────────────

type PowerAction = "start" | "stop" | "restart" | "kill";

function PowerButtons({
  serverId,
  status,
  canPower,
  nodeFqdn,
}: {
  serverId: string;
  status: ServerStatus;
  canPower: boolean;
  nodeFqdn: string;
}) {
  const [loading, setLoading] = useState<PowerAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doAction(action: PowerAction) {
    if (!canPower || loading) return;
    setError(null);
    setLoading(action);
    try {
      const res = await fetch(`/api/servers/${serverId}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `${res.status} ${res.statusText}`);
      }
    } catch (e) {
      setError((e as Error).message ?? "Network error");
    } finally {
      setLoading(null);
    }
  }

  const isRunning = status === "running";
  const isOffline = status === "offline";
  const isTransitioning = status === "starting" || status === "stopping";

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2">
      <Terminal className="h-4 w-4 shrink-0 text-accent" />
      <span className="mr-2 text-xs font-medium text-foreground">Console</span>
      <span className="flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted border border-border select-all">
        <Network className="h-3 w-3 shrink-0" />
        {nodeFqdn}:25565
      </span>

      {error && (
        <span className="text-xs text-status-offline truncate max-w-[200px]" title={error}>
          {error}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {/* Start */}
        {(isOffline || isTransitioning) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => doAction("start")}
            loading={loading === "start"}
            disabled={!canPower || loading !== null || !isOffline}
            className="gap-1.5 text-status-online"
          >
            <Play className="h-3 w-3" />
            Start
          </Button>
        )}

        {/* Stop */}
        {(isRunning || status === "starting") && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => doAction("stop")}
            loading={loading === "stop"}
            disabled={!canPower || loading !== null}
          >
            <Square className="h-3 w-3" />
            Stop
          </Button>
        )}

        {/* Restart */}
        {isRunning && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => doAction("restart")}
            loading={loading === "restart"}
            disabled={!canPower || loading !== null}
          >
            <RotateCcw className="h-3 w-3" />
            Restart
          </Button>
        )}

        {/* Kill */}
        {!isOffline && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => doAction("kill")}
            loading={loading === "kill"}
            disabled={!canPower || loading !== null}
            className="text-status-offline"
          >
            <Zap className="h-3 w-3" />
            Kill
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Command input ─────────────────────────────────────────────────────────────

function CommandInput({
  onSend,
  disabled,
}: {
  onSend: (cmd: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const savedInputRef = useRef("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const cmd = value.trim();
      if (!cmd) return;
      onSend(cmd);
      historyRef.current.unshift(cmd);
      if (historyRef.current.length > HISTORY_CAP) historyRef.current.pop();
      historyIndexRef.current = -1;
      setValue("");
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const history = historyRef.current;
      if (!history.length) return;
      if (historyIndexRef.current === -1) savedInputRef.current = value;
      const next = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = next;
      setValue(history[next] ?? "");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndexRef.current === -1) return;
      const next = historyIndexRef.current - 1;
      historyIndexRef.current = next;
      setValue(next < 0 ? savedInputRef.current : (historyRef.current[next] ?? ""));
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-3 py-2">
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-accent" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? "Server offline" : "Enter command…"}
        className={cn(
          "flex-1 bg-transparent font-mono text-[12px] text-foreground placeholder:text-muted/50 outline-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

// ── WebSocket hook ────────────────────────────────────────────────────────────

function useConsoleWs(serverId: string) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [status, setStatus] = useState<ServerStatus>("offline");
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use state value (not dispatch) as dep so the effect re-runs on reconnect
  const [reconnectSeq, setReconnectSeq] = useState(0);

  const sendCmd = useCallback((cmd: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "send command", args: [cmd] }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/servers/${serverId}/console/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: "auth", args: [] }));
    };

    ws.onmessage = (ev) => {
      let msg: { event: string; args?: string[] };
      try { msg = JSON.parse(ev.data as string); } catch { return; }

      if (msg.event === "auth success") {
        ws.send(JSON.stringify({ event: "request logs", args: [] }));
      }

      if (msg.event === "console output") {
        const raw = msg.args?.[0] ?? "";
        setLines((prev) => {
          const next = [...prev, makeLine(raw)];
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
        });
      }

      if (msg.event === "stats") {
        try {
          const s = JSON.parse(msg.args?.[0] ?? "{}") as {
            memory_bytes: number;
            cpu_absolute: number;
            disk_bytes: number;
            uptime: number;
          };
          const snap: StatsSnapshot = {
            cpuPercent: parseFloat(s.cpu_absolute.toFixed(1)),
            memoryMb: Math.round(s.memory_bytes / 1_048_576),
            diskMb: Math.round(s.disk_bytes / 1_048_576),
            uptimeSeconds: Math.floor(s.uptime),
          };
          setStats(snap);
          setCpuHistory((h) => [...h.slice(-59), snap.cpuPercent]);
          setRamHistory((h) => [...h.slice(-59), snap.memoryMb]);
        } catch { /* ignore malformed */ }
      }

      if (msg.event === "status") {
        setStatus((msg.args?.[0] ?? "offline") as ServerStatus);
      }
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(() => setReconnectSeq((n) => n + 1), 3_000);
    };

    ws.onerror = () => ws.close();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws.onclose = null;
      ws.close();
    };
  }, [serverId, reconnectSeq]);

  return { lines, stats, status, cpuHistory, ramHistory, sendCmd };
}

// ── Main export ───────────────────────────────────────────────────────────────

export type { ServerStatus };

export function ConsoleTab({
  server,
  visible,
  onStatusChange,
  onStats,
}: {
  server: ServerData;
  visible: boolean;
  onStatusChange?: (s: ServerStatus) => void;
  onStats?: (snap: StatsSnapshot) => void;
}) {
  const { lines, stats, status, cpuHistory, ramHistory, sendCmd } = useConsoleWs(server.id);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (stats) onStats?.(stats);
  }, [stats, onStats]);

  const canSend = server.canConsole && status === "running";

  return (
    <div
      className={cn("flex h-full flex-col overflow-hidden", !visible && "hidden")}
      aria-hidden={!visible}
    >
      <PowerButtons serverId={server.id} status={status} canPower={server.canPower} nodeFqdn={server.nodeFqdn} />
      <StatsBar
        stats={stats}
        cpuHistory={cpuHistory}
        ramHistory={ramHistory}
        memoryMb={server.memoryMb}
        status={status}
      />
      <ConsoleOutput lines={lines} />
      <CommandInput onSend={sendCmd} disabled={!canSend} />
    </div>
  );
}
