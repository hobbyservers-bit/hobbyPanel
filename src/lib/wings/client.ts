/**
 * Wings HTTP API client.
 *
 * When MOCK_WINGS=true this module transparently delegates to the Wings
 * simulator — the rest of the app never needs to know which mode is active.
 */

import { SignJWT } from "jose";
import { v4 as uuidv4 } from "uuid";
import type { NodeCredentials, WingsDirectoryContents, WingsServerState, WingsConsoleAuth, WingsBackup } from "./types";
import type { PowerAction } from "./types";

// ── JWT generation ────────────────────────────────────────────────────────────

async function signWingsToken(creds: NodeCredentials): Promise<string> {
  const secret = new TextEncoder().encode(creds.tokenSecret);
  return new SignJWT({
    unique_id: creds.tokenId,
    jti: uuidv4(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("HobbyPanel")
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime("30s")
    .sign(secret);
}

// ── Base request helper ────────────────────────────────────────────────────────

async function wingsRequest<T>(
  creds: NodeCredentials,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await signWingsToken(creds);
  const proto = creds.tlsEnabled ? "https" : "http";
  const url = `${proto}://${creds.fqdn}:${creds.port}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
    // Abort after 15s — Wings should respond quickly
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Wings ${method} ${path} → ${res.status}: ${text}`);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Wings API surface ─────────────────────────────────────────────────────────

export async function getServerResources(
  creds: NodeCredentials,
  serverUuid: string
): Promise<WingsServerState> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.getResources(serverUuid);
  }
  return wingsRequest<WingsServerState>(
    creds,
    "GET",
    `/api/servers/${serverUuid}/resources`
  );
}

export async function sendPowerAction(
  creds: NodeCredentials,
  serverUuid: string,
  action: PowerAction,
  meta?: { jarType?: string; mcVersion?: string; memoryMb?: number; cpuLimit?: number; isFree?: boolean; env?: Record<string, string>; mcPort?: number }
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.power(serverUuid, action, meta?.jarType, meta?.mcVersion, meta?.memoryMb, meta?.cpuLimit, meta?.isFree, meta?.env ?? {}, meta?.mcPort);
  }
  return wingsRequest<void>(creds, "POST", `/api/servers/${serverUuid}/power`, {
    action,
  });
}

export async function getConsoleAuth(
  creds: NodeCredentials,
  serverUuid: string
): Promise<WingsConsoleAuth> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.getConsoleAuth(serverUuid);
  }
  return wingsRequest<WingsConsoleAuth>(
    creds,
    "GET",
    `/api/servers/${serverUuid}/ws`
  );
}

export async function listDirectory(
  creds: NodeCredentials,
  serverUuid: string,
  directory: string
): Promise<WingsDirectoryContents> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.listDirectory(serverUuid, directory);
  }
  return wingsRequest<WingsDirectoryContents>(
    creds,
    "GET",
    `/api/servers/${serverUuid}/files/list-directory?directory=${encodeURIComponent(directory)}`
  );
}

export async function getFileContents(
  creds: NodeCredentials,
  serverUuid: string,
  file: string
): Promise<string> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.readFile(serverUuid, file);
  }

  const token = await signWingsToken(creds);
  const proto = creds.tlsEnabled ? "https" : "http";
  const url = `${proto}://${creds.fqdn}:${creds.port}/api/servers/${serverUuid}/files/contents?file=${encodeURIComponent(file)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Wings GET file contents → ${res.status}`);
  return res.text();
}

export async function writeFileContents(
  creds: NodeCredentials,
  serverUuid: string,
  file: string,
  contents: string
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.writeFile(serverUuid, file, contents);
  }

  const token = await signWingsToken(creds);
  const proto = creds.tlsEnabled ? "https" : "http";
  const url = `${proto}://${creds.fqdn}:${creds.port}/api/servers/${serverUuid}/files/write?file=${encodeURIComponent(file)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: contents,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Wings POST file write → ${res.status}`);
}

export async function deleteFiles(
  creds: NodeCredentials,
  serverUuid: string,
  root: string,
  files: string[]
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.deleteFiles(serverUuid, root, files);
  }
  return wingsRequest<void>(
    creds,
    "POST",
    `/api/servers/${serverUuid}/files/delete`,
    { root, files }
  );
}

export async function createBackup(
  creds: NodeCredentials,
  serverUuid: string,
  backupUuid: string
): Promise<WingsBackup> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.createBackup(serverUuid, backupUuid);
  }
  return wingsRequest<WingsBackup>(
    creds,
    "POST",
    `/api/servers/${serverUuid}/backup`,
    { uuid: backupUuid, ignored: "", adapter: "wings" }
  );
}

export async function deleteBackup(
  creds: NodeCredentials,
  serverUuid: string,
  backupUuid: string
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.deleteBackup(serverUuid, backupUuid);
  }
  return wingsRequest<void>(
    creds,
    "DELETE",
    `/api/servers/${serverUuid}/backup/${backupUuid}`
  );
}

export async function renameFiles(
  creds: NodeCredentials,
  serverUuid: string,
  root: string,
  files: Array<{ from: string; to: string }>
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.renameFiles(serverUuid, root, files);
  }
  return wingsRequest<void>(creds, "PUT", `/api/servers/${serverUuid}/files/rename`, { root, files });
}

export async function createDirectory(
  creds: NodeCredentials,
  serverUuid: string,
  name: string,
  directory: string
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.createDirectory(serverUuid, name, directory);
  }
  return wingsRequest<void>(creds, "POST", `/api/servers/${serverUuid}/files/create-directory`, { name, path: directory });
}

export async function uploadFileBinary(
  creds: NodeCredentials,
  serverUuid: string,
  directory: string,
  filename: string,
  data: Buffer
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    const filePath = directory.replace(/\/+$/, "") + "/" + filename;
    return simulator.writeFileBinary(serverUuid, filePath, data);
  }
  const token = await signWingsToken(creds);
  const proto = creds.tlsEnabled ? "https" : "http";
  const url = `${proto}://${creds.fqdn}:${creds.port}/api/servers/${serverUuid}/files/upload?directory=${encodeURIComponent(directory)}`;
  const fd = new FormData();
  const ab = data.buffer instanceof ArrayBuffer
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as unknown as ArrayBuffer;
  fd.append("files", new Blob([ab], { type: "application/java-archive" }), filename);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Wings binary upload → ${res.status}`);
}

export async function uploadFile(
  creds: NodeCredentials,
  serverUuid: string,
  directory: string,
  filename: string,
  contents: string
): Promise<void> {
  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner: simulator } = await import("./docker-runner");
    return simulator.uploadFile(serverUuid, directory, filename, contents);
  }
  // Real Wings uses multipart upload
  const token = await signWingsToken(creds);
  const proto = creds.tlsEnabled ? "https" : "http";
  const url = `${proto}://${creds.fqdn}:${creds.port}/api/servers/${serverUuid}/files/upload?directory=${encodeURIComponent(directory)}`;
  const fd = new FormData();
  fd.append("files", new Blob([contents]), filename);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Wings upload → ${res.status}`);
}
