"use client";

import { useMemo, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Cpu, MemoryStick, Activity, TrendingUp, TrendingDown, Minus, Gauge } from "lucide-react";
import { formatBytes, cn } from "@/lib/utils";

export interface MetricPoint {
  t: number;
  cpu: number;
  ram: number; // MB
}

interface TpsPoint {
  t: number;
  tps1m: number;
}

interface MetricsTabData {
  history: MetricPoint[];
  memoryMb: number;
  status: string;
  serverId: string;
}

function timeLabel(t: number): string {
  const d = new Date(t);
  return `${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function thin(data: MetricPoint[], maxPoints = 120): MetricPoint[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0 || i === data.length - 1);
}

function thinTps(data: TpsPoint[], maxPoints = 120): TpsPoint[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0 || i === data.length - 1);
}

function trend(history: MetricPoint[], key: "cpu" | "ram", lookback = 30): "up" | "down" | "flat" {
  if (history.length < lookback + 1) return "flat";
  const now  = history[history.length - 1]![key];
  const then = history[history.length - 1 - lookback]![key];
  const delta = now - then;
  if (delta > (key === "cpu" ? 3 : 10)) return "up";
  if (delta < (key === "cpu" ? -3 : -10)) return "down";
  return "flat";
}

function tpsTrend(history: TpsPoint[], lookback = 6): "up" | "down" | "flat" {
  if (history.length < lookback + 1) return "flat";
  const now  = history[history.length - 1]!.tps1m;
  const then = history[history.length - 1 - lookback]!.tps1m;
  const delta = now - then;
  if (delta > 0.3) return "up";
  if (delta < -0.3) return "down";
  return "flat";
}

function tpsColor(tps: number): { text: string; bar: string; ring: string } {
  if (tps >= 18) return { text: "text-status-online",  bar: "bg-green-400",  ring: "bg-green-400/10 text-green-400" };
  if (tps >= 15) return { text: "text-yellow-400",     bar: "bg-yellow-400", ring: "bg-yellow-400/10 text-yellow-400" };
  return            { text: "text-status-offline",      bar: "bg-red-400",    ring: "bg-red-400/10 text-red-400" };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, pct, color, icon: Icon, direction,
}: {
  label: string; value: string; sub: string; pct: number;
  color: "amber" | "blue" | "green" | "yellow" | "red";
  icon: React.ElementType; direction: "up" | "down" | "flat";
}) {
  const TrendIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const trendColor =
    direction === "flat" ? "text-muted" :
    direction === "up"   ? "text-status-offline" : "text-status-online";

  const colors = {
    amber:  { bar: "bg-amber-400",   ring: "bg-amber-400/10 text-amber-400" },
    blue:   { bar: "bg-blue-400",    ring: "bg-blue-400/10 text-blue-400" },
    green:  { bar: "bg-green-400",   ring: "bg-green-400/10 text-green-400" },
    yellow: { bar: "bg-yellow-400",  ring: "bg-yellow-400/10 text-yellow-400" },
    red:    { bar: "bg-red-400",     ring: "bg-red-400/10 text-red-400" },
  };
  const { bar, ring } = colors[color];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", ring)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span className="capitalize">{direction}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted">{sub}</p>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className={cn("h-full rounded-full transition-all duration-500", bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────

function ChartTooltip({
  active, payload, label, formatter,
}: {
  active?: boolean; payload?: { value: number }[]; label?: number; formatter: (v: number) => string;
}) {
  if (!active || !payload?.length || payload[0] === undefined) return null;
  return (
    <div className="rounded-lg border border-border bg-surface shadow-xl px-3 py-2">
      <p className="mb-1 text-[10px] text-muted font-mono">{label !== undefined ? timeLabel(label) : ""}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{formatter(payload[0].value)}</p>
    </div>
  );
}

function ChartCard({
  title, icon: Icon, currentValue, color, children,
}: {
  title: string; icon: React.ElementType; currentValue: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <span className={cn("text-xl font-bold tabular-nums", color)}>{currentValue}</span>
      </div>
      <div className="px-2 py-4">{children}</div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MetricsTab({ data }: { data: MetricsTabData }) {
  const isActive = data.status === "ONLINE" || data.status === "STARTING";
  const points   = useMemo(() => thin(data.history), [data.history]);
  const latest   = data.history[data.history.length - 1];

  // TPS polling
  const [tpsHistory, setTpsHistory] = useState<TpsPoint[]>([]);
  const [tpsAvailable, setTpsAvailable] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    let alive = true;
    const poll = () => {
      fetch(`/api/servers/${data.serverId}/tps`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then((d: { tps1m: number }) => {
          if (!alive) return;
          setTpsAvailable(true);
          setTpsHistory(prev => [...prev, { t: Date.now(), tps1m: d.tps1m }].slice(-300));
        })
        .catch(() => { if (alive) setTpsAvailable(false); });
    };
    poll();
    const id = setInterval(poll, 5_000);
    return () => { alive = false; clearInterval(id); };
  }, [data.serverId, isActive]);

  if (!isActive && data.history.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
          <Activity className="h-7 w-7 text-muted opacity-40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">No data yet</p>
          <p className="mt-0.5 text-xs text-muted">Start the server to see live metrics</p>
        </div>
      </div>
    );
  }

  const currentCpu = latest?.cpu ?? 0;
  const currentRam = latest?.ram ?? 0;
  const ramPct     = data.memoryMb > 0 ? (currentRam / data.memoryMb) * 100 : 0;
  const currentTps = tpsHistory[tpsHistory.length - 1]?.tps1m ?? 0;
  const tpsPoints  = thinTps(tpsHistory);
  const tpsCol     = tpsColor(currentTps);

  const cpuTrend = trend(data.history, "cpu");
  const ramTrend = trend(data.history, "ram");
  const tpsDirec = tpsTrend(tpsHistory);

  const minutesOfData = Math.max(Math.round(data.history.length / 60), 1);

  // TPS stat card color enum
  const tpsCardColor = currentTps >= 18 ? "green" : currentTps >= 15 ? "yellow" : "red";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-5 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Performance</h2>
            <p className="text-xs text-muted mt-0.5">Last {minutesOfData} min · updates every second</p>
          </div>
          {isActive && (
            <div className="flex items-center gap-2 rounded-full border border-status-online/20 bg-status-online/10 px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-online opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-status-online" />
              </span>
              <span className="text-xs font-medium text-status-online">Live</span>
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="CPU" value={`${currentCpu.toFixed(1)}%`} sub="across all cores"
            pct={currentCpu} color="amber" icon={Cpu} direction={cpuTrend}
          />
          <StatCard
            label="RAM used" value={formatBytes(currentRam * 1_048_576)}
            sub={`of ${formatBytes(data.memoryMb * 1_048_576)} allocated`}
            pct={ramPct} color="blue" icon={MemoryStick} direction={ramTrend}
          />
          {tpsAvailable && tpsHistory.length > 0 ? (
            <StatCard
              label="TPS (1 min avg)" value={currentTps.toFixed(1)} sub="target: 20.0 ticks/s"
              pct={(currentTps / 20) * 100} color={tpsCardColor} icon={Gauge} direction={tpsDirec}
            />
          ) : (
            <StatCard
              label="RAM" value={`${ramPct.toFixed(1)}%`} sub="of allocated memory"
              pct={ramPct} color="blue" icon={MemoryStick} direction={ramTrend}
            />
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* CPU chart */}
          <ChartCard title="CPU Usage" icon={Cpu} currentValue={`${currentCpu.toFixed(1)}%`} color="text-amber-400">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="0" />
                <XAxis dataKey="t" tickFormatter={timeLabel} tick={{ fontSize: 10, fill: "hsl(var(--muted))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={50} />
                <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10, fill: "hsl(var(--muted))" }} tickLine={false} axisLine={false} width={38} ticks={[0, 25, 50, 75, 100]} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(1)}%`} />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="cpu" stroke="#f59e0b" strokeWidth={2} fill="url(#cpuGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* RAM chart */}
          <ChartCard title="RAM Usage" icon={MemoryStick} currentValue={formatBytes(currentRam * 1_048_576)} color="text-blue-400">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#61afef" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#61afef" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="0" />
                <XAxis dataKey="t" tickFormatter={timeLabel} tick={{ fontSize: 10, fill: "hsl(var(--muted))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={50} />
                <YAxis domain={[0, data.memoryMb || "auto"]} tickFormatter={(v: number) => v >= 1024 ? `${(v / 1024).toFixed(0)}G` : `${v}M`} tick={{ fontSize: 10, fill: "hsl(var(--muted))" }} tickLine={false} axisLine={false} width={38} />
                <Tooltip content={<ChartTooltip formatter={(v) => formatBytes(v * 1_048_576)} />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="ram" stroke="#61afef" strokeWidth={2} fill="url(#ramGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* TPS chart — only shown when data is available */}
          {tpsAvailable && tpsPoints.length > 0 && (
            <ChartCard
              title="TPS (Ticks Per Second)" icon={Gauge}
              currentValue={`${currentTps.toFixed(1)} / 20`}
              color={tpsCol.text}
            >
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={tpsPoints} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#4ade80" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="0" />
                  <XAxis dataKey="t" tickFormatter={timeLabel} tick={{ fontSize: 10, fill: "hsl(var(--muted))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={50} />
                  <YAxis domain={[0, 21]} ticks={[0, 5, 10, 15, 20]} tickFormatter={(v: number) => `${v}`} tick={{ fontSize: 10, fill: "hsl(var(--muted))" }} tickLine={false} axisLine={false} width={28} />
                  {/* Reference line at 20 TPS (target) */}
                  <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(2)} TPS`} />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="tps1m" stroke="#4ade80" strokeWidth={2} fill="url(#tpsGrad)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="mt-1 px-3 text-[10px] text-muted">
                Polled every 5 s via RCON · Paper/Spigot only · target 20.0
              </p>
            </ChartCard>
          )}

        </div>
      </div>
    </div>
  );
}
