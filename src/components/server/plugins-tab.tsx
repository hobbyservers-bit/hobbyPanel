"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Download,
  Package,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ModrinthProject } from "@/app/api/servers/[id]/plugins/search/route";

export interface PluginsTabData {
  id: string;
  jarType: string;
  mcVersion: string;
  canFiles: boolean;
}

type InstallState = "idle" | "installing" | "done" | "error";

const LIMIT = 20;

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function LoaderBadge({ name }: { name: string }) {
  return (
    <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
      {name}
    </span>
  );
}

function ProjectCard({
  project,
  canFiles,
  installState,
  onInstall,
}: {
  project: ModrinthProject;
  canFiles: boolean;
  installState: InstallState;
  onInstall: () => void;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-2/60">
      {/* Icon */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
        {project.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.icon_url}
            alt={project.title}
            className="h-11 w-11 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <Package className="h-5 w-5 text-muted" />
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground leading-tight">
            {project.title}
          </span>
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
            <Download className="h-3 w-3" />
            {formatDownloads(project.downloads)}
          </div>
        </div>

        <p className="line-clamp-2 text-xs text-muted leading-relaxed">
          {project.description}
        </p>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {(project.loaders ?? []).slice(0, 4).map((l) => (
              <LoaderBadge key={l} name={l} />
            ))}
          </div>

          {canFiles ? (
            <button
              onClick={onInstall}
              disabled={installState !== "idle"}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                installState === "idle" &&
                  "bg-accent text-background hover:bg-accent/90",
                installState === "installing" &&
                  "cursor-not-allowed bg-surface-2 text-muted",
                installState === "done" &&
                  "cursor-default bg-surface-2 text-muted",
                installState === "error" &&
                  "cursor-default bg-status-offline/10 text-status-offline"
              )}
            >
              {installState === "idle" && "Install"}
              {installState === "installing" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Installing…
                </>
              )}
              {installState === "done" && "Installed"}
              {installState === "error" && (
                <>
                  <AlertCircle className="h-3 w-3" />
                  Failed
                </>
              )}
            </button>
          ) : (
            <span className="text-xs text-muted">No file access</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PluginsTab({ server }: { server: PluginsTabData }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<ModrinthProject[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>(() => {
    try {
      const raw = sessionStorage.getItem(`hp:plugins:${server.id}`);
      return raw ? (JSON.parse(raw) as Record<string, InstallState>) : {};
    } catch { return {}; }
  });
  const [installErrors, setInstallErrors] = useState<Record<string, string>>({});

  // Persist only "done" entries so they survive tab switches
  useEffect(() => {
    try {
      const done = Object.fromEntries(
        Object.entries(installStates).filter(([, v]) => v === "done")
      );
      sessionStorage.setItem(`hp:plugins:${server.id}`, JSON.stringify(done));
    } catch {}
  }, [installStates, server.id]);

  const isPlugin = server.jarType !== "fabric";
  const noun = isPlugin ? "plugin" : "mod";

  // Debounce: reset offset + fire after 400 ms of no typing
  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(0);
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch whenever debounced query or offset changes
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/servers/${server.id}/plugins/search?q=${encodeURIComponent(debouncedQuery)}&offset=${offset}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.unsupported) { setUnsupported(true); return; }
        if (data.error) throw new Error(data.error);
        setResults(data.hits ?? []);
        setTotalHits(data.total_hits ?? 0);
      } catch (e) {
        if (!cancelled) setFetchError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [server.id, debouncedQuery, offset]);

  async function install(project: ModrinthProject) {
    setInstallStates((s) => ({ ...s, [project.project_id]: "installing" }));
    setInstallErrors((e) => { const n = { ...e }; delete n[project.project_id]; return n; });
    try {
      const res = await fetch(`/api/servers/${server.id}/plugins/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.project_id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Install failed");
      setInstallStates((s) => ({ ...s, [project.project_id]: "done" }));
    } catch (e) {
      setInstallStates((s) => ({ ...s, [project.project_id]: "error" }));
      setInstallErrors((errs) => ({ ...errs, [project.project_id]: (e as Error).message }));
      setTimeout(() => {
        setInstallStates((s) => {
          if (s[project.project_id] === "error") return { ...s, [project.project_id]: "idle" };
          return s;
        });
      }, 4_000);
    }
  }

  if (unsupported) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted opacity-40" />
          <p className="text-sm text-muted">Vanilla servers don't support plugins or mods.</p>
          <p className="mt-1 text-xs text-muted opacity-70">Switch to Paper, Purpur, or Fabric to use this feature.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalHits / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${noun}s on Modrinth…`}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />}
        {!loading && query && (
          <button onClick={() => setQuery("")} className="text-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Result list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {fetchError && (
          <div className="mb-3 rounded border border-status-offline/30 bg-status-offline/10 px-3 py-2 text-xs text-status-offline">
            {fetchError}
          </div>
        )}

        {!loading && results.length === 0 && !fetchError && (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-center text-xs text-muted">
            <Package className="h-7 w-7 opacity-30" />
            {debouncedQuery
              ? `No ${noun}s found for "${debouncedQuery}"`
              : `Start typing to search for ${noun}s`}
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className="mb-2 text-xs text-muted">
              {totalHits.toLocaleString()} results
              {debouncedQuery && ` for "${debouncedQuery}"`}
              {" · "}
              showing {offset + 1}–{Math.min(offset + LIMIT, totalHits)}
            </p>

            <div className="flex flex-col gap-2">
              {results.map((project) => {
                const state = installStates[project.project_id] ?? "idle";
                return (
                  <div key={project.project_id}>
                    <ProjectCard
                      project={project}
                      canFiles={server.canFiles}
                      installState={state}
                      onInstall={() => install(project)}
                    />
                    {state === "error" && installErrors[project.project_id] && (
                      <p className="mt-0.5 pl-1 text-[11px] text-status-offline">
                        {installErrors[project.project_id]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={offset + LIMIT >= totalHits}
                  onClick={() => setOffset(offset + LIMIT)}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
