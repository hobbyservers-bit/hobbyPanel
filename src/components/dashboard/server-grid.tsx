"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Search, Plus, Server } from "lucide-react";
import { ServerCard } from "./server-card";
import { CreateServerDialog } from "./create-server-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ServersListResponse } from "@/app/api/servers/route";

// ── Fetcher ───────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch servers");
    return r.json() as Promise<ServersListResponse>;
  });

// ── Skeleton cards ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="h-[172px] rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2.5">
        <div>
          <div className="mb-1 flex justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
        <div>
          <div className="mb-1 flex justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
      </div>
      <div className="mt-3 border-t border-border/60 pt-2.5">
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

// ── Create-server CTA card ────────────────────────────────────────────────────

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-full min-h-[172px] w-full rounded-lg border-2 border-dashed border-border",
        "flex flex-col items-center justify-center gap-2 p-4",
        "text-muted transition-colors hover:border-accent/50 hover:text-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <Plus className="h-5 w-5" />
      <span className="text-sm font-medium">New server</span>
    </button>
  );
}

// ── Main grid ─────────────────────────────────────────────────────────────────

interface Props {
  initialData: ServersListResponse;
}

export function ServerGrid({ initialData }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, mutate } = useSWR<ServersListResponse>(
    "/api/servers",
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: 5_000,
      revalidateOnFocus: true,
      dedupingInterval: 2_000,
    }
  );

  const servers = data?.servers ?? [];
  const canCreate = data?.canCreateServer ?? false;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) => s.name.toLowerCase().includes(q));
  }, [servers, search]);

  function handleCreated(id: string) {
    mutate(); // Immediately refresh the grid
    router.push(`/server/${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter servers…"
            className={cn(
              "h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            )}
          />
        </div>

        {canCreate && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New server
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading && servers.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Search className="mb-2 h-6 w-6 text-muted/50" />
          <p className="text-sm text-muted">
            No servers match <span className="text-foreground">"{search}"</span>
          </p>
        </div>
      ) : servers.length === 0 ? (
        /* Empty state — also shows create card */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canCreate && <CreateCard onClick={() => setDialogOpen(true)} />}
          {!canCreate && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
              <Server className="mb-3 h-8 w-8 text-muted/50" />
              <p className="text-sm font-medium text-foreground">No servers yet</p>
              <p className="mt-1 text-xs text-muted">
                You have no servers and cannot create more on this plan.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
          {canCreate && !search && (
            <CreateCard onClick={() => setDialogOpen(true)} />
          )}
        </div>
      )}

      <CreateServerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
