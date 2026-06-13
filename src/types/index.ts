import type { Server, Node, User, ServerStatus, Role } from "@prisma/client";

// ── Re-export Prisma enums for convenience ────────────────────────────────────
export type { ServerStatus, Role };

// ── Dashboard / server card ───────────────────────────────────────────────────

export interface ServerStats {
  cpuPercent: number;
  memoryMb: number;
  diskMb: number;
  players: number;
  maxPlayers: number;
  uptimeSeconds: number;
}

export interface ServerWithStats extends Server {
  stats: ServerStats | null;
}

// ── Wings API types ───────────────────────────────────────────────────────────

export type PowerAction = "start" | "stop" | "restart" | "kill";

export interface WingsFileEntry {
  name: string;
  mode: string;
  size: number;
  isFile: boolean;
  isSymlink: boolean;
  isEditable: boolean;
  mimetype: string;
  createdAt: string;
  modifiedAt: string;
}

export interface WingsServerResources {
  object: "stats";
  attributes: {
    state: "running" | "offline" | "starting" | "stopping";
    isSuspended: boolean;
    resources: {
      memoryBytes: number;
      cpuAbsolute: number;
      diskBytes: number;
      networkRxBytes: number;
      networkTxBytes: number;
      uptime: number;
    };
  };
}

export interface WingsConsoleAuth {
  token: string;
  socket: string;
}

// ── WebSocket events (proxied to browser) ────────────────────────────────────

export type ConsoleEvent =
  | { type: "console_output"; data: string }
  | { type: "stats"; data: ServerStats }
  | { type: "status"; data: { status: ServerStatus } }
  | { type: "token_expiring" }
  | { type: "token_expired" };

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

// ── API response shapes ────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

export interface ApiSuccess<T = void> {
  data: T;
}
