"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// ── Minecraft color palette ───────────────────────────────────────────────────

const MC_COLORS = [
  { code: "0", hex: "#000000", name: "Black" },
  { code: "1", hex: "#0000AA", name: "Dark Blue" },
  { code: "2", hex: "#00AA00", name: "Dark Green" },
  { code: "3", hex: "#00AAAA", name: "Dark Aqua" },
  { code: "4", hex: "#AA0000", name: "Dark Red" },
  { code: "5", hex: "#AA00AA", name: "Dark Purple" },
  { code: "6", hex: "#FFAA00", name: "Gold" },
  { code: "7", hex: "#AAAAAA", name: "Gray" },
  { code: "8", hex: "#555555", name: "Dark Gray" },
  { code: "9", hex: "#5555FF", name: "Blue" },
  { code: "a", hex: "#55FF55", name: "Green" },
  { code: "b", hex: "#55FFFF", name: "Aqua" },
  { code: "c", hex: "#FF5555", name: "Red" },
  { code: "d", hex: "#FF55FF", name: "Light Purple" },
  { code: "e", hex: "#FFFF55", name: "Yellow" },
  { code: "f", hex: "#FFFFFF", name: "White" },
] as const;

const MC_FORMATS = [
  { code: "l", label: "B",  title: "Bold",          cls: "font-bold" },
  { code: "o", label: "I",  title: "Italic",         cls: "italic" },
  { code: "n", label: "U",  title: "Underline",      cls: "underline" },
  { code: "m", label: "S",  title: "Strikethrough",  cls: "line-through" },
  { code: "k", label: "✦",  title: "Obfuscated",     cls: "" },
  { code: "r", label: "↺",  title: "Reset",          cls: "" },
] as const;

const COLOR_MAP: Record<string, string> = Object.fromEntries(
  MC_COLORS.map((c) => [c.code, c.hex])
);

// ── Texture pixel data ────────────────────────────────────────────────────────

// Grass block side face (16x16). Each value indexes into GRASS_PALETTE or DIRT_PALETTE.
// Values 0-4 = grass, values 10-15 = dirt (offset by 10)
const GRASS_PALETTE = ["#65A81C","#568F15","#74BF22","#4B7B11","#7DC523"];
const DIRT_PALETTE  = ["#866043","#7A5534","#9D7857","#5B3B1D","#AF8A64","#6F4C2B"];

const G = (i: number) => i;
const D = (i: number) => 10 + i;

// Grass block side face — approximates Java Edition grass_block_side.png + overlay
const GRASS_BLOCK_FACE: number[][] = [
  [G(0),G(1),G(0),G(2),G(0),G(0),G(1),G(0),G(0),G(2),G(0),G(1),G(0),G(0),G(2),G(0)],
  [G(1),G(0),G(2),G(0),G(0),G(1),G(0),G(2),G(1),G(0),G(0),G(1),G(2),G(0),G(0),G(1)],
  [G(0),G(2),D(0),G(1),G(0),D(1),G(0),G(1),D(0),G(0),G(1),D(1),G(0),G(2),D(0),G(0)],
  [D(1),G(1),D(0),D(2),G(1),D(0),D(1),G(0),D(0),D(1),G(0),D(0),D(1),D(0),G(1),D(1)],
  [D(0),D(2),D(1),D(0),D(3),D(0),D(2),D(1),D(0),D(2),D(1),D(0),D(4),D(1),D(0),D(2)],
  [D(2),D(0),D(3),D(2),D(0),D(1),D(0),D(3),D(1),D(0),D(3),D(2),D(0),D(1),D(2),D(0)],
  [D(1),D(3),D(0),D(1),D(2),D(3),D(1),D(0),D(2),D(1),D(0),D(1),D(2),D(0),D(1),D(3)],
  [D(0),D(1),D(2),D(0),D(1),D(0),D(4),D(2),D(0),D(3),D(2),D(0),D(1),D(2),D(0),D(1)],
  [D(2),D(0),D(1),D(3),D(0),D(2),D(1),D(0),D(3),D(1),D(0),D(2),D(3),D(1),D(2),D(0)],
  [D(0),D(2),D(0),D(1),D(2),D(1),D(0),D(3),D(0),D(2),D(1),D(0),D(1),D(0),D(1),D(2)],
  [D(3),D(1),D(2),D(0),D(1),D(0),D(2),D(1),D(2),D(0),D(3),D(2),D(0),D(3),D(0),D(1)],
  [D(1),D(0),D(3),D(2),D(0),D(2),D(1),D(0),D(1),D(2),D(1),D(0),D(2),D(1),D(2),D(0)],
  [D(0),D(2),D(1),D(0),D(3),D(1),D(0),D(2),D(0),D(1),D(0),D(3),D(1),D(0),D(1),D(2)],
  [D(2),D(1),D(0),D(2),D(1),D(0),D(3),D(1),D(3),D(0),D(2),D(1),D(0),D(2),D(0),D(1)],
  [D(1),D(0),D(2),D(1),D(0),D(2),D(1),D(0),D(1),D(2),D(1),D(0),D(2),D(1),D(3),D(0)],
  [D(0),D(3),D(1),D(0),D(2),D(1),D(0),D(2),D(0),D(1),D(0),D(2),D(0),D(1),D(0),D(2)],
];

// Pure dirt tile used for the tiling background
const DIRT_TILE: number[][] = [
  [D(0),D(2),D(1),D(0),D(3),D(0),D(2),D(1),D(0),D(2),D(1),D(0),D(4),D(1),D(0),D(2)],
  [D(2),D(0),D(3),D(2),D(0),D(1),D(0),D(3),D(1),D(0),D(3),D(2),D(0),D(1),D(2),D(0)],
  [D(1),D(3),D(0),D(1),D(2),D(3),D(1),D(0),D(2),D(1),D(0),D(1),D(2),D(0),D(1),D(3)],
  [D(0),D(1),D(2),D(0),D(1),D(0),D(4),D(2),D(0),D(3),D(2),D(0),D(1),D(2),D(0),D(1)],
  [D(2),D(0),D(1),D(3),D(0),D(2),D(1),D(0),D(3),D(1),D(0),D(2),D(3),D(1),D(2),D(0)],
  [D(0),D(2),D(0),D(1),D(2),D(1),D(0),D(3),D(0),D(2),D(1),D(0),D(1),D(0),D(1),D(2)],
  [D(3),D(1),D(2),D(0),D(1),D(0),D(2),D(1),D(2),D(0),D(3),D(2),D(0),D(3),D(0),D(1)],
  [D(1),D(0),D(3),D(2),D(0),D(2),D(1),D(0),D(1),D(2),D(1),D(0),D(2),D(1),D(2),D(0)],
  [D(0),D(2),D(1),D(0),D(3),D(1),D(0),D(2),D(0),D(1),D(0),D(3),D(1),D(0),D(1),D(2)],
  [D(2),D(1),D(0),D(2),D(1),D(0),D(3),D(1),D(3),D(0),D(2),D(1),D(0),D(2),D(0),D(1)],
  [D(1),D(0),D(2),D(1),D(0),D(2),D(1),D(0),D(1),D(2),D(1),D(0),D(2),D(1),D(3),D(0)],
  [D(0),D(3),D(1),D(0),D(2),D(1),D(0),D(2),D(0),D(1),D(0),D(2),D(0),D(1),D(0),D(2)],
  [D(2),D(0),D(3),D(2),D(0),D(1),D(0),D(3),D(1),D(0),D(3),D(2),D(0),D(1),D(2),D(0)],
  [D(1),D(3),D(0),D(1),D(2),D(3),D(1),D(0),D(2),D(1),D(0),D(1),D(2),D(0),D(1),D(3)],
  [D(0),D(1),D(2),D(0),D(1),D(0),D(4),D(2),D(0),D(3),D(2),D(0),D(1),D(2),D(0),D(1)],
  [D(3),D(0),D(1),D(3),D(0),D(2),D(1),D(0),D(3),D(1),D(0),D(2),D(3),D(1),D(2),D(0)],
];

function pixelColor(p: number): string {
  if (p < 10) return GRASS_PALETTE[p] ?? GRASS_PALETTE[0]!;
  return DIRT_PALETTE[p - 10] ?? DIRT_PALETTE[0]!;
}

function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  grid: number[][],
  scale: number,
  offsetX = 0,
  offsetY = 0
) {
  grid.forEach((row, y) => {
    row.forEach((p, x) => {
      ctx.fillStyle = pixelColor(p);
      ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
    });
  });
}

// ── Texture hooks ─────────────────────────────────────────────────────────────

function useGrassBlockUrl(size = 64): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const scale = size / 16;
    drawPixelGrid(ctx, GRASS_BLOCK_FACE, scale);
    setUrl(canvas.toDataURL());
  }, [size]);
  return url;
}

function useDirtBackgroundUrl(tileSize = 32): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const scale = tileSize / 16;
    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext("2d")!;
    drawPixelGrid(ctx, DIRT_TILE, scale);
    setUrl(canvas.toDataURL());
  }, [tileSize]);
  return url;
}

// ── MOTD parser ───────────────────────────────────────────────────────────────

interface Segment {
  text: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  obfuscated: boolean;
}

function parseLine(line: string): Segment[] {
  const segments: Segment[] = [];
  let color = "#AAAAAA";
  let bold = false, italic = false, underline = false, strike = false, obfuscated = false;
  let i = 0;
  while (i < line.length) {
    if ((line[i] === "§" || line[i] === "&") && i + 1 < line.length) {
      const code = line[i + 1]!.toLowerCase();
      i += 2;
      if (COLOR_MAP[code]) {
        color = COLOR_MAP[code]!;
        bold = italic = underline = strike = obfuscated = false;
      } else if (code === "l") bold = true;
      else if (code === "o") italic = true;
      else if (code === "n") underline = true;
      else if (code === "m") strike = true;
      else if (code === "k") obfuscated = true;
      else if (code === "r") {
        color = "#AAAAAA";
        bold = italic = underline = strike = obfuscated = false;
      }
      continue;
    }
    let text = "";
    while (i < line.length && line[i] !== "§" && line[i] !== "&") {
      text += line[i++];
    }
    if (text) segments.push({ text, color, bold, italic, underline, strike, obfuscated });
  }
  return segments;
}

function darken(hex: string, factor = 0.25): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `rgb(${r},${g},${b})`;
}

function renderLine(segments: Segment[], key: number) {
  if (!segments.length) return <span key={key}>&nbsp;</span>;
  return (
    <span key={key}>
      {segments.map((seg, si) => (
        <span
          key={si}
          style={{
            color: seg.color,
            fontWeight: seg.bold ? "bold" : "normal",
            fontStyle: seg.italic ? "italic" : "normal",
            textDecoration: [seg.underline && "underline", seg.strike && "line-through"]
              .filter(Boolean).join(" ") || "none",
            filter: seg.obfuscated ? "blur(3px)" : undefined,
            textShadow: `1px 1px 0 ${darken(seg.color)}`,
          }}
        >
          {seg.text}
        </span>
      ))}
    </span>
  );
}

// ── Ping bars SVG ─────────────────────────────────────────────────────────────

function PingBars({ color = "#55FF55" }: { color?: string }) {
  return (
    <svg width="11" height="9" viewBox="0 0 11 9" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x="0" y="6" width="2" height="3" fill={color} />
      <rect x="3" y="3" width="2" height="6" fill={color} />
      <rect x="6" y="1" width="2" height="8" fill={color} />
      <rect x="9" y="0" width="2" height="9" fill={color} opacity="0.3" />
    </svg>
  );
}

// ── Server browser preview ────────────────────────────────────────────────────

function MCPreview({
  motd,
  serverName,
  grassBlockUrl,
  dirtBgUrl,
}: {
  motd: string;
  serverName: string;
  grassBlockUrl: string;
  dirtBgUrl: string;
}) {
  const rawLines = motd.replace(/\\n/g, "\n").split("\n");
  const line1 = parseLine(rawLines[0] ?? "");
  const line2 = rawLines[1] !== undefined ? parseLine(rawLines[1]) : null;

  return (
    <div
      className="overflow-hidden rounded select-none"
      style={{
        backgroundImage: dirtBgUrl ? `url(${dirtBgUrl})` : undefined,
        backgroundColor: "#6B5132",
        backgroundRepeat: "repeat",
        backgroundSize: "32px 32px",
        imageRendering: "pixelated",
        // Outer MC GUI border (dark → medium → light inset)
        boxShadow: "inset 0 0 0 2px #000, inset 0 0 0 3px #373737",
        padding: "8px",
      }}
    >
      {/* Single server slot */}
      <div
        style={{
          background: "rgba(0,0,0,0.5)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 2px rgba(0,0,0,0.4)",
          padding: "6px 8px",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          minHeight: "64px",
        }}
      >
        {/* Grass block icon */}
        <div
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            imageRendering: "pixelated",
            boxShadow: "inset -1px -1px 0 rgba(0,0,0,0.4), inset 1px 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {grassBlockUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={grassBlockUrl}
              alt="server icon"
              width={48}
              height={48}
              style={{ imageRendering: "pixelated", display: "block" }}
            />
          ) : (
            <div style={{ width: 48, height: 48, background: "#5FA81A" }} />
          )}
        </div>

        {/* Text area */}
        <div style={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}>
          {/* Top row: server name + ping */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{
              color: "#FFFFFF",
              fontSize: 13,
              textShadow: "1px 1px 0 #3f3f3f",
              fontWeight: "normal",
              letterSpacing: "0.2px",
            }}>
              {serverName || "Minecraft Server"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <PingBars />
              <span style={{ color: "#AAAAAA", fontSize: 10, textShadow: "1px 1px 0 #2a2a2a" }}>5ms</span>
            </div>
          </div>

          {/* MOTD lines */}
          <div style={{ fontSize: 12, lineHeight: "1.55", letterSpacing: "0.2px" }}>
            <div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {renderLine(line1, 0)}
            </div>
            {line2 !== null && (
              <div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {renderLine(line2, 1)}
              </div>
            )}
          </div>
        </div>

        {/* Player count */}
        <div style={{ flexShrink: 0, textAlign: "right", marginTop: 1, fontFamily: "monospace" }}>
          <div style={{ fontSize: 11, lineHeight: 1 }}>
            <span style={{ color: "#AAAAAA", textShadow: "1px 1px 0 #2a2a2a" }}>0</span>
            <span style={{ color: "#555555", textShadow: "1px 1px 0 #111111" }}>/20</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface MOTDEditorProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  serverName?: string;
}

export function MOTDEditor({ value, onChange, disabled, serverName = "Minecraft Server" }: MOTDEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const grassBlockUrl = useGrassBlockUrl(64);
  const dirtBgUrl = useDirtBackgroundUrl(32);

  function insertCode(code: string) {
    const ta = textareaRef.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = value.slice(0, start) + "§" + code + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + 2, start + 2);
    });
  }

  function insertNewline() {
    const ta = textareaRef.current;
    if (!ta || disabled || value.includes("\\n")) return;
    const start = ta.selectionStart;
    const next  = value.slice(0, start) + "\\n" + value.slice(start);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + 2, start + 2);
    });
  }

  return (
    <div className="space-y-3">
      {/* Live preview */}
      <MCPreview
        motd={value}
        serverName={serverName}
        grassBlockUrl={grassBlockUrl}
        dirtBgUrl={dirtBgUrl}
      />

      {/* Editor controls */}
      <div className={cn(
        "rounded-lg border border-border bg-surface-2 p-3 space-y-3",
        disabled && "opacity-50 pointer-events-none"
      )}>
        {/* Color palette */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Colors</p>
          <div className="flex flex-wrap gap-1.5">
            {MC_COLORS.map((c) => (
              <button
                key={c.code}
                title={`§${c.code} ${c.name}`}
                onClick={() => insertCode(c.code)}
                className="h-6 w-6 rounded-sm transition-transform hover:scale-125 hover:ring-2 hover:ring-white/40 active:scale-95"
                style={{
                  backgroundColor: c.hex,
                  boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.3), 2px 2px 0 ${darken(c.hex)}`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Format buttons */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Formatting</p>
          <div className="flex flex-wrap gap-1.5">
            {MC_FORMATS.map((f) => (
              <button
                key={f.code}
                title={f.title}
                onClick={() => insertCode(f.code)}
                className={cn(
                  "flex h-7 min-w-[28px] items-center justify-center rounded border border-border bg-surface px-2",
                  "text-xs text-muted hover:border-accent/50 hover:text-foreground transition-colors",
                  f.cls
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              title={value.includes("\\n") ? "Only one line break allowed" : "Insert line break (2nd MOTD line)"}
              onClick={insertNewline}
              disabled={value.includes("\\n")}
              className="flex h-7 items-center justify-center rounded border border-border bg-surface px-2 text-xs text-muted hover:border-accent/50 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Line 2
            </button>
          </div>
        </div>

        {/* Raw textarea */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Raw MOTD</p>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={2}
            spellCheck={false}
            placeholder="§6Welcome to §cMy Server!\n§7Join us today."
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-[10px] text-muted">
            §0–§f for colors · §l bold · §o italic · §r reset · Use the palette or type codes directly
          </p>
        </div>
      </div>
    </div>
  );
}
