"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  RefreshCw,
  Save,
  X,
  Upload,
  UploadCloud,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { MonacoEditor, languageForFile } from "./monaco-editor";
import type { WingsFileEntry } from "@/lib/wings/types";

interface ServerData {
  id: string;
  canFiles: boolean;
  ownerPlan: string;
}

type FileEntry = WingsFileEntry;

// ── File icon helper ──────────────────────────────────────────────────────────

function FileIcon({ entry, className }: { entry: FileEntry; className?: string }) {
  if (!entry.is_file) return <Folder className={cn("text-yellow-500", className)} />;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const codeExts = new Set(["js", "ts", "json", "yml", "yaml", "toml", "xml", "java", "py", "lua", "sh", "properties", "cfg", "conf"]);
  if (codeExts.has(ext)) return <FileCode className={cn("text-accent", className)} />;
  return <File className={cn("text-muted", className)} />;
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ cwd, onNavigate }: { cwd: string; onNavigate: (p: string) => void }) {
  const parts = cwd === "/" ? [] : cwd.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-xs text-muted overflow-x-auto">
      <button
        onClick={() => onNavigate("/")}
        className={cn("hover:text-foreground transition-colors shrink-0", cwd === "/" && "text-foreground font-medium")}
      >
        /
      </button>
      {parts.map((part, i) => {
        const path = "/" + parts.slice(0, i + 1).join("/");
        return (
          <span key={path} className="flex items-center gap-1 shrink-0">
            <span className="text-border">/</span>
            <button
              onClick={() => onNavigate(path)}
              className={cn(
                "hover:text-foreground transition-colors",
                i === parts.length - 1 && "text-foreground font-medium"
              )}
            >
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}

// ── File row ──────────────────────────────────────────────────────────────────

function FileRow({
  entry,
  selected,
  onOpen,
  onDelete,
  onDownload,
  canFiles,
}: {
  entry: FileEntry;
  selected: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onDownload: () => void;
  canFiles: boolean;
}) {
  const modDate = new Date(entry.modified_at);
  const dateStr = isNaN(modDate.getTime()) ? "—" : modDate.toLocaleDateString();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
        selected ? "bg-accent/10 text-foreground" : "hover:bg-surface-2"
      )}
    >
      <FileIcon entry={entry} className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-foreground">{entry.name}</span>
      <span className="hidden w-16 shrink-0 text-right text-xs text-muted sm:block">
        {entry.is_file ? formatBytes(entry.size) : "—"}
      </span>
      <span className="hidden w-20 shrink-0 text-right text-xs text-muted md:block">{dateStr}</span>

      {/* Actions — only visible on hover */}
      <div
        className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {entry.is_file && (
          <button
            onClick={onDownload}
            title="Download"
            className="rounded p-1 text-muted hover:text-foreground hover:bg-surface-2"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        {canFiles && (
          <button
            onClick={onDelete}
            title="Delete"
            className="rounded p-1 text-muted hover:text-status-offline hover:bg-surface-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Create folder dialog ──────────────────────────────────────────────────────

function CreateFolderRow({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="flex items-center gap-2 rounded border border-accent/30 bg-accent/5 px-2 py-1.5">
      <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Folder name"
        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
      />
      <button onClick={() => name.trim() && onConfirm(name.trim())} className="text-xs text-accent hover:text-foreground">OK</button>
      <button onClick={onCancel} className="text-xs text-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// ── File browser panel ────────────────────────────────────────────────────────

function FileBrowser({
  serverId,
  cwd,
  onCwdChange,
  selectedFile,
  onSelect,
  canFiles,
}: {
  serverId: string;
  cwd: string;
  onCwdChange: (p: string) => void;
  selectedFile: string | null;
  onSelect: (entry: FileEntry | null, path: string | null) => void;
  canFiles: boolean;
}) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/files?directory=${encodeURIComponent(cwd)}`);
      const data = (await res.json()) as { files: FileEntry[] };
      setEntries(data.files ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [serverId, cwd]);

  useEffect(() => { refresh(); }, [refresh]);

  function handleOpen(entry: FileEntry) {
    if (!entry.is_file) {
      onCwdChange(cwd === "/" ? `/${entry.name}` : `${cwd}/${entry.name}`);
      onSelect(null, null);
    } else if (entry.is_editable) {
      const path = cwd === "/" ? `/${entry.name}` : `${cwd}/${entry.name}`;
      onSelect(entry, path);
    }
  }

  async function handleDelete(entry: FileEntry) {
    if (!confirm(`Delete ${entry.name}?`)) return;
    const name = entry.name;
    await fetch(`/api/servers/${serverId}/files/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: cwd, files: [name] }),
    });
    if (selectedFile?.endsWith("/" + name)) onSelect(null, null);
    refresh();
  }

  function handleDownload(entry: FileEntry) {
    const path = cwd === "/" ? `/${entry.name}` : `${cwd}/${entry.name}`;
    window.open(`/api/servers/${serverId}/files/content?file=${encodeURIComponent(path)}&download=1`);
  }

  async function handleCreateFolder(name: string) {
    setCreating(false);
    await fetch(`/api/servers/${serverId}/files/mkdir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, directory: cwd }),
    });
    refresh();
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("directory", cwd);
      await fetch(`/api/servers/${serverId}/files/upload`, { method: "POST", body: fd });
    }
    refresh();
  }

  // Sort: dirs first, then alphabetical
  const sorted = [...entries].sort((a, b) => {
    if (a.is_file !== b.is_file) return a.is_file ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Breadcrumb cwd={cwd} onNavigate={onCwdChange} />
        <div className="ml-auto flex items-center gap-1">
          {cwd !== "/" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => {
                const parent = cwd.split("/").slice(0, -1).join("/") || "/";
                onCwdChange(parent);
                onSelect(null, null);
              }}
              title="Go up"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {canFiles && (
            <>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCreating(true)} title="New folder">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => uploadRef.current?.click()}
                title="Upload"
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <input
                ref={uploadRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={refresh} title="Refresh" disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-2 border-b border-border/50 bg-surface-2 px-2 py-1 text-[11px] text-muted">
        <span className="flex-1">Name</span>
        <span className="hidden w-16 text-right sm:block">Size</span>
        <span className="hidden w-20 text-right md:block">Modified</span>
        <span className="w-14 text-right">Actions</span>
      </div>

      {/* Rows — also the drag-and-drop target */}
      <div
        className="relative flex-1 overflow-y-auto p-1"
        onDragEnter={(e) => {
          if (!canFiles) return;
          e.preventDefault();
          dragCounterRef.current += 1;
          if (dragCounterRef.current === 1) setIsDragOver(true);
        }}
        onDragOver={(e) => {
          if (!canFiles) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          if (!canFiles) return;
          dragCounterRef.current -= 1;
          if (dragCounterRef.current === 0) setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragCounterRef.current = 0;
          setIsDragOver(false);
          if (!canFiles) return;
          handleUpload(e.dataTransfer.files);
        }}
      >
        {/* Drop overlay */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-accent bg-accent/10 backdrop-blur-[1px]">
            <UploadCloud className="h-8 w-8 text-accent" />
            <p className="text-sm font-medium text-accent">Drop to upload</p>
            <p className="text-xs text-muted">Files will be added to {cwd}</p>
          </div>
        )}

        {creating && (
          <CreateFolderRow
            onConfirm={handleCreateFolder}
            onCancel={() => setCreating(false)}
          />
        )}
        {loading && !entries.length ? (
          <div className="p-4 text-center text-xs text-muted">Loading…</div>
        ) : sorted.length === 0 && !creating ? (
          <div className="p-8 text-center text-xs text-muted">
            {canFiles ? "Empty directory — drop files here to upload" : "Empty directory"}
          </div>
        ) : (
          sorted.map((entry) => {
            const path = cwd === "/" ? `/${entry.name}` : `${cwd}/${entry.name}`;
            return (
              <FileRow
                key={entry.name}
                entry={entry}
                selected={selectedFile === path}
                onOpen={() => handleOpen(entry)}
                onDelete={() => handleDelete(entry)}
                onDownload={() => handleDownload(entry)}
                canFiles={canFiles}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Editor panel ──────────────────────────────────────────────────────────────

function EditorPanel({
  serverId,
  filePath,
  onClose,
  canFiles,
}: {
  serverId: string;
  filePath: string;
  onClose: () => void;
  canFiles: boolean;
}) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = content !== originalContent;
  const filename = filePath.split("/").pop() ?? filePath;
  const language = languageForFile(filename);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/servers/${serverId}/files/content?file=${encodeURIComponent(filePath)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load file");
        return r.text();
      })
      .then((text) => {
        setContent(text);
        setOriginalContent(text);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [serverId, filePath]);

  async function save() {
    if (!canFiles || !isDirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/files/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: filePath, contents: content }),
      });
      if (!res.ok) throw new Error("Save failed");
      setOriginalContent(content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-w-0 border-l border-border">
      {/* Editor toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <FileCode className="h-4 w-4 shrink-0 text-accent" />
        <span className="flex-1 truncate text-sm font-medium text-foreground">{filename}</span>
        {isDirty && <span className="text-xs text-muted">(unsaved)</span>}
        {canFiles && (
          <Button
            size="sm"
            onClick={save}
            disabled={!isDirty || saving}
            loading={saving}
            className="h-7 gap-1.5"
          >
            <Save className="h-3 w-3" />
            Save
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-xs text-muted">
            Loading…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-xs text-status-offline">
            {error}
          </div>
        ) : (
          <MonacoEditor
            value={content}
            onChange={setContent}
            language={language}
            onSave={save}
            readOnly={!canFiles}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function FilesTab({ server }: { server: ServerData }) {
  const [cwd, setCwd] = useState("/");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const isFree = server.ownerPlan === "FREE";

  function handleSelect(_entry: FileEntry | null, path: string | null) {
    setSelectedFile(path);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Free plan notice */}
      {isFree && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-2 px-3 py-1.5 text-xs text-muted">
          <Lock className="h-3 w-3 shrink-0 text-accent/70" />
          <span>System files (server.properties, .jar) are hidden on the Free plan.</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* File browser: full width when no file open, 40% when editing */}
        <div className={cn("flex flex-col", selectedFile ? "w-2/5 border-r border-border" : "flex-1")}>
          <FileBrowser
            serverId={server.id}
            cwd={cwd}
            onCwdChange={setCwd}
            selectedFile={selectedFile}
            onSelect={handleSelect}
            canFiles={server.canFiles}
          />
        </div>

        {/* Editor panel */}
        {selectedFile && (
          <div className="flex-1">
            <EditorPanel
              serverId={server.id}
              filePath={selectedFile}
              onClose={() => setSelectedFile(null)}
              canFiles={server.canFiles}
            />
          </div>
        )}
      </div>
    </div>
  );
}
