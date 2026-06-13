export interface ThemePreset {
  id: string;
  name: string;
  swatch: string; // hex for the UI swatch
  vars: Record<string, string>; // bare HSL component values
}

export interface UserTheme {
  preset?: string;
  accentOverride?: string | null; // bare HSL like "38 92% 50%"
  bgImage?: string | null;
  bgImageOpacity?: number;
  bgImageBlur?: number;
}

export const PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "Default",
    swatch: "#f26648",
    vars: {
      "--background":        "240 10% 4%",
      "--surface":           "240 8% 7%",
      "--surface-2":         "240 6% 10%",
      "--border":            "240 5% 14%",
      "--border-subtle":     "240 4% 12%",
      "--foreground":        "0 0% 93%",
      "--muted":             "240 4% 54%",
      "--accent":            "11 87% 62%",
      "--accent-foreground": "0 0% 0%",
      "--accent-muted":      "11 87% 15%",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    swatch: "#818cf8",
    vars: {
      "--background":        "235 40% 6%",
      "--surface":           "235 35% 9%",
      "--surface-2":         "235 28% 12%",
      "--border":            "235 20% 17%",
      "--border-subtle":     "235 18% 14%",
      "--foreground":        "230 30% 95%",
      "--muted":             "235 15% 55%",
      "--accent":            "239 84% 67%",
      "--accent-foreground": "0 0% 100%",
      "--accent-muted":      "239 84% 15%",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: "#38bdf8",
    vars: {
      "--background":        "204 70% 5%",
      "--surface":           "204 60% 8%",
      "--surface-2":         "204 50% 11%",
      "--border":            "204 35% 16%",
      "--border-subtle":     "204 30% 13%",
      "--foreground":        "200 30% 94%",
      "--muted":             "204 20% 55%",
      "--accent":            "199 89% 48%",
      "--accent-foreground": "0 0% 0%",
      "--accent-muted":      "199 89% 12%",
    },
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "#4ade80",
    vars: {
      "--background":        "150 35% 4%",
      "--surface":           "150 30% 7%",
      "--surface-2":         "150 25% 10%",
      "--border":            "150 18% 15%",
      "--border-subtle":     "150 15% 12%",
      "--foreground":        "140 25% 93%",
      "--muted":             "150 12% 52%",
      "--accent":            "142 71% 45%",
      "--accent-foreground": "0 0% 0%",
      "--accent-muted":      "142 71% 10%",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: "#fb923c",
    vars: {
      "--background":        "20 45% 5%",
      "--surface":           "20 38% 8%",
      "--surface-2":         "20 32% 11%",
      "--border":            "20 22% 16%",
      "--border-subtle":     "20 18% 13%",
      "--foreground":        "30 25% 93%",
      "--muted":             "20 14% 52%",
      "--accent":            "25 95% 53%",
      "--accent-foreground": "0 0% 0%",
      "--accent-muted":      "25 95% 12%",
    },
  },
  {
    id: "rose",
    name: "Rose",
    swatch: "#fb7185",
    vars: {
      "--background":        "345 30% 5%",
      "--surface":           "345 25% 8%",
      "--surface-2":         "345 20% 11%",
      "--border":            "345 15% 16%",
      "--border-subtle":     "345 12% 13%",
      "--foreground":        "350 20% 93%",
      "--muted":             "345 10% 52%",
      "--accent":            "350 89% 60%",
      "--accent-foreground": "0 0% 100%",
      "--accent-muted":      "350 89% 13%",
    },
  },
  {
    id: "neon",
    name: "Neon",
    swatch: "#a855f7",
    vars: {
      "--background":        "270 25% 4%",
      "--surface":           "270 20% 7%",
      "--surface-2":         "270 16% 10%",
      "--border":            "270 12% 15%",
      "--border-subtle":     "270 10% 12%",
      "--foreground":        "280 20% 93%",
      "--muted":             "270 10% 52%",
      "--accent":            "270 91% 65%",
      "--accent-foreground": "0 0% 100%",
      "--accent-muted":      "270 91% 13%",
    },
  },
  {
    id: "slate",
    name: "Slate",
    swatch: "#94a3b8",
    vars: {
      "--background":        "215 28% 7%",
      "--surface":           "215 22% 10%",
      "--surface-2":         "215 18% 13%",
      "--border":            "215 14% 18%",
      "--border-subtle":     "215 12% 15%",
      "--foreground":        "210 20% 93%",
      "--muted":             "215 10% 52%",
      "--accent":            "215 20% 65%",
      "--accent-foreground": "215 10% 4%",
      "--accent-muted":      "215 20% 15%",
    },
  },
];

export function getPreset(id: string): ThemePreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;
}

export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslToHex(hsl: string): string {
  const parts = hsl.trim().replace(/%/g, "").split(/[\s,]+/);
  const h = parseFloat(parts[0]!) / 360;
  const s = parseFloat(parts[1]!) / 100;
  const l = parseFloat(parts[2]!) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rv = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const gv = Math.round(hue2rgb(p, q, h) * 255);
  const bv = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${rv.toString(16).padStart(2, "0")}${gv.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`;
}

/** Returns CSS custom-property key/value pairs suitable for use as inline `style` on `<html>`. */
export function buildThemeVars(theme: UserTheme): Record<string, string> {
  const preset = getPreset(theme.preset ?? "default");
  const vars: Record<string, string> = { ...preset.vars };

  if (theme.accentOverride) {
    const [h, s] = theme.accentOverride.split(" ");
    vars["--accent"] = theme.accentOverride;
    vars["--accent-muted"] = `${h} ${s} 13%`;
  }

  vars["--bg-image-url"]     = theme.bgImage ? `url('${theme.bgImage}')` : "none";
  vars["--bg-image-opacity"] = theme.bgImage ? String(theme.bgImageOpacity ?? 0.15) : "0";
  vars["--bg-image-blur"]    = theme.bgImage ? `${theme.bgImageBlur ?? 0}px` : "0px";

  return vars;
}

/** @deprecated use buildThemeVars for inline-style injection */
export function buildThemeCss(theme: UserTheme): string {
  const vars = buildThemeVars(theme);
  let css = ":root {\n";
  for (const [k, v] of Object.entries(vars)) css += `  ${k}: ${v};\n`;
  css += "}";
  return css;
}
