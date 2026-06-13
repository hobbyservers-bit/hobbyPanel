import Link from "next/link";
import { Cpu, HardDrive, MemoryStick, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes, formatUptime } from "@/lib/utils";
import type { ServerListItem } from "@/app/api/servers/route";
import type { BadgeVariant } from "@/components/ui/badge";

type DisplayStatus = "ONLINE" | "OFFLINE" | "STARTING" | "STOPPING";

function liveStatus(server: ServerListItem): DisplayStatus {
  const cs = server.resources?.currentState;
  if (cs === "running")  return "ONLINE";
  if (cs === "starting") return "STARTING";
  if (cs === "stopping") return "STOPPING";
  if (cs === "offline")  return "OFFLINE";
  return server.status;
}

function statusVariant(s: DisplayStatus): BadgeVariant {
  switch (s) {
    case "ONLINE":   return "online";
    case "OFFLINE":  return "offline";
    case "STARTING": return "starting";
    case "STOPPING": return "stopping";
  }
}

function statusLabel(s: DisplayStatus): string {
  switch (s) {
    case "ONLINE":   return "Online";
    case "OFFLINE":  return "Offline";
    case "STARTING": return "Starting";
    case "STOPPING": return "Stopping";
  }
}

interface Props {
  server: ServerListItem;
}

export function ServerCard({ server }: Props) {
  const r = server.resources;
  const status = liveStatus(server);
  const ramPct = r ? Math.round((r.memoryMb / server.memoryMb) * 100) : 0;
  const cpuPct = r ? Math.round(r.cpuPercent) : 0;
  const isActive = status === "ONLINE" || status === "STARTING";

  return (
    <Link
      href={`/server/${server.id}`}
      prefetch
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
    >
      <article
        className={cn(
          "h-full rounded-lg border bg-surface p-4 transition-all duration-150",
          "group-hover:border-accent/40 group-hover:shadow-card-hover group-hover:-translate-y-0.5",
          status === "ONLINE"   && "border-status-online/20",
          status === "STARTING" && "border-status-starting/20",
          status === "OFFLINE"  && "border-border",
          status === "STOPPING" && "border-status-stopping/20",
        )}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {server.name}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {server.jarType} {server.mcVersion}
            </p>
          </div>
          <Badge variant={statusVariant(status)} dot className="shrink-0">
            {statusLabel(status)}
          </Badge>
        </div>

        {/* Resource bars */}
        <div className="space-y-2.5">
          {/* RAM */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <MemoryStick className="h-3 w-3" />
                RAM
              </span>
              <span className="text-[11px] text-muted">
                {isActive && r
                  ? `${formatBytes(r.memoryMb * 1_048_576)} / ${formatBytes(server.memoryMb * 1_048_576)}`
                  : `${formatBytes(server.memoryMb * 1_048_576)}`}
              </span>
            </div>
            <Progress value={isActive ? ramPct : 0} />
          </div>

          {/* CPU */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <Cpu className="h-3 w-3" />
                CPU
              </span>
              <span className="text-[11px] text-muted">
                {isActive && r ? `${cpuPct}%` : "—"}
              </span>
            </div>
            <Progress value={isActive ? cpuPct : 0} />
          </div>
        </div>

        {/* Footer: IP · disk · uptime */}
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 gap-2 min-w-0">
          <span className="flex items-center gap-1 text-[11px] text-muted truncate min-w-0">
            <Network className="h-3 w-3 shrink-0" />
            <span className="truncate">{server.serverAddress ?? `${server.nodeFqdn}:?`}</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted shrink-0">
            {isActive && r && r.uptimeSeconds > 0
              ? `up ${formatUptime(r.uptimeSeconds)}`
              : <><HardDrive className="h-3 w-3" />{r ? formatBytes(r.diskMb * 1_048_576) : formatBytes(server.diskMb * 1_048_576)}</>
            }
          </span>
        </div>
      </article>
    </Link>
  );
}
