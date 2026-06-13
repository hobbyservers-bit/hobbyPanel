"use client";

import dynamic from "next/dynamic";
import type { OnMount, EditorProps } from "@monaco-editor/react";

// Monaco is lazy-loaded — only bundled when the Files tab is opened.
const MonacoRaw = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse items-center justify-center bg-[#1e1e1e] text-xs text-muted">
      Loading editor…
    </div>
  ),
});

interface Props {
  value: string;
  onChange?: (v: string) => void;
  language?: string;
  onSave?: () => void;
  readOnly?: boolean;
  className?: string;
}

export function MonacoEditor({ value, onChange, language = "plaintext", onSave, readOnly, className }: Props) {
  const handleMount: OnMount = (editor, monaco) => {
    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onSave);
    }
  };

  const options: EditorProps["options"] = {
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    minimap: { enabled: false },
    wordWrap: "on",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    readOnly,
    lineNumbers: "on",
    renderLineHighlight: "line",
    smoothScrolling: true,
    cursorBlinking: "smooth",
  };

  return (
    <div className={className ?? "h-full w-full"}>
      <MonacoRaw
        value={value}
        onChange={(v) => onChange?.(v ?? "")}
        language={language}
        theme="vs-dark"
        options={options}
        onMount={handleMount}
      />
    </div>
  );
}

// Map file extension → Monaco language ID
export function languageForFile(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    yml: "yaml", yaml: "yaml",
    json: "json",
    properties: "ini",
    toml: "ini",
    xml: "xml",
    sh: "shell", bash: "shell",
    js: "javascript", mjs: "javascript",
    ts: "typescript",
    log: "plaintext", txt: "plaintext",
    java: "java",
    py: "python",
    lua: "lua",
    cfg: "ini", conf: "ini",
    md: "markdown",
    html: "html", htm: "html",
    css: "css",
  };
  return map[ext] ?? "plaintext";
}
