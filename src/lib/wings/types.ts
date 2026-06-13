import { z } from "zod";

// ── Request schemas ───────────────────────────────────────────────────────────

export const PowerActionSchema = z.enum(["start", "stop", "restart", "kill"]);
export type PowerAction = z.infer<typeof PowerActionSchema>;

export const FileRenameSchema = z.object({
  root: z.string(),
  files: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ),
});

export const FileDeleteSchema = z.object({
  root: z.string(),
  files: z.array(z.string()),
});

export const FileCompressSchema = z.object({
  root: z.string(),
  files: z.array(z.string()),
});

export const FileDecompressSchema = z.object({
  root: z.string(),
  file: z.string(),
});

export const CreateBackupSchema = z.object({
  uuid: z.string().uuid(),
  ignored: z.string().default(""),
  adapter: z.enum(["wings", "s3"]).default("wings"),
});

// ── Response types ────────────────────────────────────────────────────────────

export interface WingsFileEntry {
  name: string;
  mode: string;
  size: number;
  is_file: boolean;
  is_symlink: boolean;
  is_editable: boolean;
  mimetype: string;
  created_at: string;
  modified_at: string;
}

export interface WingsDirectoryContents {
  object: "list";
  data: WingsFileEntry[];
}

export interface WingsServerState {
  object: "server_state";
  attributes: {
    current_state: "running" | "offline" | "starting" | "stopping";
    is_suspended: boolean;
    resources: {
      memory_bytes: number;
      cpu_absolute: number;
      disk_bytes: number;
      network_rx_bytes: number;
      network_tx_bytes: number;
      uptime: number;
    };
  };
}

export interface WingsConsoleAuth {
  token: string;
  socket: string;
}

export interface WingsBackup {
  uuid: string;
  is_successful: boolean;
  checksum: string | null;
  checksum_type: string;
  file_size: number;
  parts: null;
  created_at: string;
}

// ── Node credentials (decrypted, in-memory only) ─────────────────────────────
export interface NodeCredentials {
  nodeId: string;
  fqdn: string;
  port: number;
  tlsEnabled: boolean;
  tokenId: string;
  tokenSecret: string;
}
