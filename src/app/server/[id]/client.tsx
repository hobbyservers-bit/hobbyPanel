"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useCallback, useRef } from "react";
import { ArrowLeft, Server, AlertTriangle, ShieldOff, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConsoleTab, type ServerStatus, type StatsSnapshot } from "@/components/server/console-tab";
import { FilesTab } from "@/components/server/files-tab";
import { PluginsTab } from "@/components/server/plugins-tab";
import { SettingsTab } from "@/components/server/settings-tab";
import { BackupsTab } from "@/components/server/backups-tab";
import { UsersTab } from "@/components/server/users-tab";
import { MetricsTab, type MetricPoint } from "@/components/server/metrics-tab";
import { PlayersTab } from "@/components/server/players-tab";
import { PropertiesTab } from "@/components/server/properties-tab";
import { TasksTab } from "@/components/server/tasks-tab";
import { AlertsTab } from "@/components/server/alerts-tab";
import type { ServerPageData } from "./page";
import type { BadgeVariant } from "@/components/ui/badge";

// ── Status helpers ────────────────────────────────────────────────────────────

function statusVariant(s: string): BadgeVariant {
  if (s === "ONLINE") return "online";
  if (s === "STARTING") return "starting";
  if (s === "STOPPING") return "stopping";
  return "offline";
}

function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: "console",    label: "Console" },
  { id: "metrics",    label: "Metrics" },
  { id: "players",    label: "Players" },
  { id: "files",      label: "Files" },
  { id: "plugins",    label: "Plugins" },
  { id: "properties", label: "Properties" },
  { id: "tasks",      label: "Tasks" },
  { id: "alerts",     label: "Alerts" },
  { id: "settings",   label: "Settings" },
  { id: "backups",    label: "Backups" },
  { id: "users",      label: "Users" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Inner component (uses useSearchParams) ────────────────────────────────────

function wsStatusToDb(s: ServerStatus): string {
  if (s === "running")  return "ONLINE";
  if (s === "starting") return "STARTING";
  if (s === "stopping") return "STOPPING";
  return "OFFLINE";
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:text-foreground transition-colors"
      title="Copy server address"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      <span className="font-mono">{address}</span>
    </button>
  );
}

function Inner({ server, userEmail, isAdmin }: { server: ServerPageData; userEmail: string; isAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") ?? "console") as TabId;
  const [liveStatus, setLiveStatus] = useState<string>(server.status);
  const handleStatusChange = useCallback((s: ServerStatus) => setLiveStatus(wsStatusToDb(s)), []);

  const HISTORY_MAX = 300; // 5 min at 1s
  const metricsRef = useRef<MetricPoint[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<MetricPoint[]>([]);
  const handleStats = useCallback((snap: StatsSnapshot) => {
    const point: MetricPoint = { t: Date.now(), cpu: snap.cpuPercent, ram: snap.memoryMb };
    const next = [...metricsRef.current, point].slice(-HISTORY_MAX);
    metricsRef.current = next;
    setMetricsHistory(next);
  }, []);

  function setTab(tab: TabId) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  const powerBlocked = server.suspended || server.nodeMaintenance;

  // Data passed to each tab component
  const consoleData = {
    id: server.id,
    name: server.name,
    memoryMb: server.memoryMb,
    diskMb: server.diskMb,
    nodeFqdn: server.nodeFqdn,
    isOwner: server.isOwner,
    canPower: !powerBlocked && (server.isOwner || server.canPower),
    canConsole: server.isOwner || server.canConsole,
  };

  const filesData = {
    id: server.id,
    canFiles: server.isOwner || server.canFiles,
    ownerPlan: server.ownerPlan,
  };

  const pluginsData = {
    id: server.id,
    jarType: server.jarType,
    mcVersion: server.mcVersion,
    canFiles: server.isOwner || server.canFiles,
  };

  const settingsData = {
    id: server.id,
    name: server.name,
    mcVersion: server.mcVersion,
    startupCommand: server.startupCommand,
    dockerImage: server.dockerImage,
    isOwner: server.isOwner,
    canSettings: server.isOwner || server.canSettings,
  };

  const backupsData = {
    id: server.id,
    isOwner: server.isOwner,
  };

  const usersData = {
    id: server.id,
    isOwner: server.isOwner,
  };

  const metricsData = {
    history: metricsHistory,
    memoryMb: server.memoryMb,
    status: liveStatus,
    serverId: server.id,
  };

  const alertsData = {
    id: server.id,
    isOwner: server.isOwner,
  };

  const playersData = {
    id: server.id,
    status: liveStatus,
    canConsole: server.isOwner || server.canConsole,
  };

  const propertiesData = {
    id: server.id,
    name: server.name,
    canSettings: server.isOwner || server.canSettings,
  };

  const tasksData = {
    id: server.id,
    isOwner: server.isOwner,
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Top nav ─────────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <span className="text-border">/</span>
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-accent" />
          <span className="max-w-[180px] truncate text-sm font-semibold text-foreground">
            {server.name}
          </span>
        </div>
        <Badge variant={statusVariant(liveStatus)} dot className="ml-1">
          {statusLabel(liveStatus)}
        </Badge>
        {server.serverAddress && (
          <CopyAddress address={server.serverAddress} />
        )}
        <div className="ml-auto">
          <span className="hidden text-xs text-muted sm:block">{userEmail}</span>
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <nav className="flex shrink-0 gap-1 border-b border-border bg-background px-4">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "border-b-2 px-4 py-3 text-sm transition-colors",
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Status banners ──────────────────────────────────────────────────── */}
      {server.suspended && (
        <div className="flex shrink-0 items-center gap-2 border-b border-red-800 bg-red-950/60 px-4 py-2 text-sm text-red-300">
          <ShieldOff className="h-4 w-4 shrink-0" />
          <span>
            This server is <strong>suspended</strong>.{" "}
            {isAdmin
              ? "You can unsuspend it from the admin panel."
              : "Contact an administrator to restore access."}
          </span>
        </div>
      )}
      {server.nodeMaintenance && !server.suspended && (
        <div className="flex shrink-0 items-center gap-2 border-b border-yellow-700 bg-yellow-950/60 px-4 py-2 text-sm text-yellow-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            The node hosting this server is under <strong>maintenance</strong>. Power actions are temporarily disabled.
          </span>
        </div>
      )}

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      {/* Console is always mounted to keep WS alive; others are rendered on demand */}
      <div className="flex-1 overflow-hidden">
        <ConsoleTab server={consoleData} visible={activeTab === "console"} onStatusChange={handleStatusChange} onStats={handleStats} />
        {activeTab === "metrics" && <MetricsTab data={metricsData} />}
        {activeTab === "players" && <PlayersTab server={playersData} />}
        {activeTab === "files" && <FilesTab server={filesData} />}
        {activeTab === "plugins" && <PluginsTab server={pluginsData} />}
        {activeTab === "properties" && (
          <div className="h-full overflow-hidden">
            <PropertiesTab server={propertiesData} />
          </div>
        )}
        {activeTab === "tasks" && (
          <div className="h-full overflow-hidden">
            <TasksTab server={tasksData} />
          </div>
        )}
        {activeTab === "alerts" && (
          <div className="h-full overflow-hidden">
            <AlertsTab server={alertsData} />
          </div>
        )}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto">
            <SettingsTab server={settingsData} />
          </div>
        )}
        {activeTab === "backups" && (
          <div className="h-full overflow-y-auto">
            <BackupsTab server={backupsData} />
          </div>
        )}
        {activeTab === "users" && (
          <div className="h-full overflow-y-auto">
            <UsersTab server={usersData} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export (Suspense boundary for useSearchParams) ────────────────────────────

export function ServerClient({ server, userEmail, isAdmin }: { server: ServerPageData; userEmail: string; isAdmin: boolean }) {
  return (
    <Suspense fallback={null}>
      <Inner server={server} userEmail={userEmail} isAdmin={isAdmin} />
    </Suspense>
  );
}
