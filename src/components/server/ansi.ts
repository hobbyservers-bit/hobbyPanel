// Lightweight ANSI SGR + Minecraft § color parser for the console tab.

export interface AnsiSpan {
  text: string;
  color?: string;
  bold?: boolean;
}

// Standard ANSI 16-color palette (dark-theme friendly)
const ANSI_FG: Record<number, string> = {
  30: "#4e4e4e",
  31: "#e06c75",
  32: "#98c379",
  33: "#e5c07b",
  34: "#61afef",
  35: "#c678dd",
  36: "#56b6c2",
  37: "#abb2bf",
  90: "#7f7f7f",
  91: "#ff6c6b",
  92: "#aece91",
  93: "#ffcb6b",
  94: "#82b1ff",
  95: "#c792ea",
  96: "#89ddff",
  97: "#ffffff",
};

const MC_COLORS: Record<string, string> = {
  "0": "#000000", "1": "#0000aa", "2": "#00aa00", "3": "#00aaaa",
  "4": "#aa0000", "5": "#aa00aa", "6": "#ffaa00", "7": "#aaaaaa",
  "8": "#555555", "9": "#5555ff", a: "#55ff55", b: "#55ffff",
  c: "#ff5555", d: "#ff55ff", e: "#ffff55", f: "#ffffff",
};

export function parseAnsiLine(raw: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let color: string | undefined;
  let bold = false;

  // Split on ANSI escape sequences, keeping them as tokens
  const tokens = raw.split(/(\x1b\[[0-9;]*m)/);

  for (const token of tokens) {
    if (token.startsWith("\x1b[")) {
      const codes = token.slice(2, -1).split(";").map(Number);
      for (const code of codes) {
        if (code === 0 || isNaN(code)) { color = undefined; bold = false; }
        else if (code === 1) { bold = true; }
        else if (code === 22) { bold = false; }
        else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) { color = ANSI_FG[code]; }
      }
      continue;
    }

    if (!token) continue;

    // Process Minecraft § color codes within plain text
    let remaining = token;
    while (remaining.length > 0) {
      const idx = remaining.indexOf("§");
      if (idx === -1) {
        if (remaining) spans.push({ text: remaining, color, bold: bold || undefined });
        remaining = "";
      } else {
        if (idx > 0) spans.push({ text: remaining.slice(0, idx), color, bold: bold || undefined });
        const code = remaining[idx + 1]?.toLowerCase() ?? "";
        if (MC_COLORS[code]) { color = MC_COLORS[code]; bold = false; }
        else if (code === "r") { color = undefined; bold = false; }
        else if (code === "l") { bold = true; }
        remaining = remaining.slice(idx + 2);
      }
    }
  }

  return spans.filter((s) => s.text);
}
