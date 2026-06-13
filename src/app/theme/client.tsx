"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Server, Palette, Check, Upload, X, RotateCcw, Save, ChevronRight } from "lucide-react";
import { PRESETS, hexToHsl, hslToHex, getPreset, type UserTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Props {
  initialTheme: UserTheme;
}

// Apply the theme to the live document so changes are visible immediately
function applyLive(theme: UserTheme) {
  const preset = getPreset(theme.preset ?? "default");
  const el = document.documentElement;

  for (const [k, v] of Object.entries(preset.vars)) {
    el.style.setProperty(k, v);
  }

  if (theme.accentOverride) {
    const [h, s] = theme.accentOverride.split(" ");
    el.style.setProperty("--accent", theme.accentOverride);
    el.style.setProperty("--accent-muted", `${h} ${s} 13%`);
  } else {
    el.style.removeProperty("--accent");
    el.style.removeProperty("--accent-muted");
  }

  if (theme.bgImage) {
    el.style.setProperty("--bg-image-url", `url('${theme.bgImage}')`);
    el.style.setProperty("--bg-image-opacity", String(theme.bgImageOpacity ?? 0.15));
    el.style.setProperty("--bg-image-blur", `${theme.bgImageBlur ?? 0}px`);
  } else {
    el.style.setProperty("--bg-image-url", "none");
    el.style.setProperty("--bg-image-opacity", "0");
    el.style.setProperty("--bg-image-blur", "0px");
  }
}

export function ThemeClient({ initialTheme }: Props) {
  const [theme, setTheme]         = useState<UserTheme>(initialTheme);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = useCallback((patch: Partial<UserTheme>) => {
    setTheme((prev) => {
      const next = { ...prev, ...patch };
      applyLive(next);
      return next;
    });
  }, []);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setSaveError(d.error ?? "Failed to save");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function uploadBackground(file: File) {
    setUploading(true);
    setSaveError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch("/api/theme/background", { method: "POST", body: fd });
      const d = (await r.json()) as { url?: string; error?: string };
      if (!r.ok) { setSaveError(d.error ?? "Upload failed"); return; }
      update({ bgImage: d.url, bgImageOpacity: theme.bgImageOpacity ?? 0.15, bgImageBlur: theme.bgImageBlur ?? 0 });
    } catch {
      setSaveError("Network error");
    } finally {
      setUploading(false);
    }
  }

  async function removeBackground() {
    setRemoving(true);
    setSaveError(null);
    try {
      await fetch("/api/theme/background", { method: "DELETE" });
      update({ bgImage: null, bgImageOpacity: undefined, bgImageBlur: undefined });
    } catch {
      setSaveError("Network error");
    } finally {
      setRemoving(false);
    }
  }

  function resetToDefault() {
    const next: UserTheme = { preset: "default" };
    setTheme(next);
    applyLive(next);
  }

  const effectiveAccentHex = theme.accentOverride
    ? hslToHex(theme.accentOverride)
    : hslToHex(getPreset(theme.preset ?? "default").vars["--accent"] ?? "38 92% 50%");

  const presetBgHex = (id: string) => {
    const vars = PRESETS.find((p) => p.id === id)?.vars ?? {};
    return hslToHex(vars["--background"] ?? "240 10% 4%");
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Server className="h-4 w-4 text-accent" />
              <span className="font-semibold text-sm text-foreground">HobbyPanel</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted/50" />
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Palette className="h-4 w-4 text-accent" />
              Theme
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToDefault}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:bg-accent/90 disabled:opacity-60 transition-colors"
            >
              {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saved ? "Saved!" : saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">

        {saveError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs text-red-400">
            {saveError}
          </div>
        )}

        {/* ── Preset themes ────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Preset Themes</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {PRESETS.map((preset) => {
              const active = (theme.preset ?? "default") === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => update({ preset: preset.id, accentOverride: null })}
                  className={cn(
                    "group flex flex-col items-center gap-2 rounded-xl border p-2.5 transition-all",
                    active
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:border-accent/40"
                  )}
                >
                  {/* Mini swatch */}
                  <div
                    className="relative h-8 w-full rounded-lg overflow-hidden border border-white/5"
                    style={{ backgroundColor: presetBgHex(preset.id) }}
                  >
                    <div
                      className="absolute bottom-1 right-1 h-3 w-3 rounded-full border border-white/20"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium leading-none",
                    active ? "text-accent" : "text-muted group-hover:text-foreground"
                  )}>
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Accent Color ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Accent Color</h2>
          <p className="mb-3 text-xs text-muted">Override the accent color for buttons, links, and highlights.</p>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="relative h-10 w-10 shrink-0">
              <input
                type="color"
                value={effectiveAccentHex}
                onChange={(e) => update({ accentOverride: hexToHsl(e.target.value) })}
                className="absolute inset-0 h-full w-full cursor-pointer rounded-lg border-0 p-0 opacity-0"
              />
              <div
                className="pointer-events-none h-10 w-10 rounded-lg border-2 border-border shadow-md"
                style={{ backgroundColor: effectiveAccentHex }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">{effectiveAccentHex}</span>
                {theme.accentOverride && (
                  <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">Click the swatch to pick a color</p>
            </div>
            {theme.accentOverride && (
              <button
                type="button"
                onClick={() => update({ accentOverride: null })}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-foreground transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Accent preview chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Default", hsl: "11 87% 62%"  },
              { label: "Amber",   hsl: "38 92% 50%"  },
              { label: "Indigo",  hsl: "239 84% 67%" },
              { label: "Sky",     hsl: "199 89% 48%" },
              { label: "Green",   hsl: "142 71% 45%" },
              { label: "Orange",  hsl: "25 95% 53%"  },
              { label: "Rose",    hsl: "350 89% 60%" },
              { label: "Purple",  hsl: "270 91% 65%" },
            ].map((c) => {
              const hex = hslToHex(c.hsl);
              const isCurrent = (theme.accentOverride ?? getPreset(theme.preset ?? "default").vars["--accent"]) === c.hsl;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => update({ accentOverride: c.hsl })}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    isCurrent ? "border-accent/70 bg-accent/10 text-foreground" : "border-border text-muted hover:border-border/80 hover:text-foreground"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full border border-white/10" style={{ backgroundColor: hex }} />
                  {c.label}
                  {isCurrent && <Check className="h-2.5 w-2.5 text-accent" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Background Image ─────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Background Image</h2>
          <p className="mb-3 text-xs text-muted">Add a custom background image to your panel. Works across all pages.</p>

          <div className="rounded-xl border border-border bg-surface overflow-hidden">

            {/* Upload / current image */}
            {theme.bgImage ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={theme.bgImage}
                  alt="Background preview"
                  className="h-32 w-full object-cover opacity-70"
                />
                <div className="absolute inset-0 flex items-end justify-between p-3 bg-gradient-to-t from-black/50 to-transparent">
                  <span className="text-xs text-white/80 font-mono truncate max-w-[60%]">{theme.bgImage}</span>
                  <button
                    type="button"
                    onClick={removeBackground}
                    disabled={removing}
                    className="flex items-center gap-1 rounded-lg bg-black/50 px-2.5 py-1.5 text-xs text-white hover:bg-destructive/80 transition-colors disabled:opacity-60"
                  >
                    <X className="h-3 w-3" /> {removing ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadBackground(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-muted transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-60"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-xs font-medium">{uploading ? "Uploading…" : "Click to upload an image"}</span>
                  <span className="text-[10px] opacity-60">JPEG, PNG, WebP, or GIF — max 5 MB</span>
                </button>
              </div>
            )}

            {/* Opacity + Blur sliders — only when image is set */}
            {theme.bgImage && (
              <div className="space-y-4 p-4 border-t border-border">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Opacity</span>
                    <span className="font-semibold text-foreground">
                      {Math.round((theme.bgImageOpacity ?? 0.15) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0} max={1} step={0.01}
                    value={theme.bgImageOpacity ?? 0.15}
                    onChange={(e) => update({ bgImageOpacity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-border"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Blur</span>
                    <span className="font-semibold text-foreground">
                      {theme.bgImageBlur ?? 0}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0} max={20} step={1}
                    value={theme.bgImageBlur ?? 0}
                    onChange={(e) => update({ bgImageBlur: parseInt(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-border"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Bottom save bar ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-surface/60 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-muted">
            Changes apply instantly as a preview.{" "}
            <span className="text-foreground">Save</span> to keep them across sessions.
          </p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-black hover:bg-accent/90 disabled:opacity-60 transition-colors"
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

      </main>
    </div>
  );
}
