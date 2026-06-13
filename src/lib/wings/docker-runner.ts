/**
 * Docker-based Minecraft server runner.
 *
 * Replaces the in-process simulator when MOCK_WINGS=true.
 * Uses itzg/minecraft-server (the de-facto standard Minecraft Docker image)
 * so every server type (Paper, Purpur, Fabric, Vanilla) and version is real.
 *
 * Each panel server maps to a Docker container named hobbypanel-{uuid}.
 * Server files live at {MC_DATA_DIR}/{uuid} and are bind-mounted to /data.
 */

import Docker from "dockerode";
import * as fs from "fs";
import * as path from "path";
import type {
  WingsDirectoryContents,
  WingsServerState,
  WingsBackup,
  WingsConsoleAuth,
} from "./types";
import type { PowerAction } from "./types";
import { fireAlert, clearStartAlert } from "@/lib/discord-alerts";

// ── Config ────────────────────────────────────────────────────────────────────

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock",
});

const DATA_DIR = process.env.MC_DATA_DIR
  ? path.resolve(process.env.MC_DATA_DIR)
  : path.join(process.cwd(), "mc-data");

const MC_IMAGE = "itzg/minecraft-server";
const MC_PORT_INTERNAL   = 25565; // port inside the container (always fixed)
const RCON_PORT_INTERNAL = 25575; // RCON port inside the container (always fixed)

// Host port ranges — each server gets a unique pair from these pools
const MC_PORT_START   = 25565; // 25565, 25566, 25567 …
const RCON_PORT_START = 35575; // 35575, 35576, 35577 … (separate range avoids collisions)

// ── Shared globals (survives Next.js HMR module re-evaluation) ────────────────

type RunStatus = "running" | "offline" | "starting" | "stopping";

type PortPair = { mcPort: number; rconPort: number };

type G = {
  _mcLogBufs: Map<string, string[]>;
  _mcListeners: Map<string, Set<(line: string) => void>>;
  _mcLogActive: Set<string>;
  _mcStatus: Map<string, RunStatus>;
  _mcPlayerCounts: Map<string, number>;
  _mcIdleTimers: Map<string, ReturnType<typeof setTimeout>>;
  _mcFreeServers: Set<string>;
  _mcPortMap: Map<string, PortPair>;
};

const g = globalThis as typeof globalThis & Partial<G>;

const logBufs: Map<string, string[]> = g._mcLogBufs ?? (g._mcLogBufs = new Map());
const listeners: Map<string, Set<(line: string) => void>> = g._mcListeners ?? (g._mcListeners = new Map());
const logActive: Set<string> = g._mcLogActive ?? (g._mcLogActive = new Set());
const statusCache: Map<string, RunStatus> = g._mcStatus ?? (g._mcStatus = new Map());
const playerCounts: Map<string, number> = g._mcPlayerCounts ?? (g._mcPlayerCounts = new Map());
const idleTimers: Map<string, ReturnType<typeof setTimeout>> = g._mcIdleTimers ?? (g._mcIdleTimers = new Map());
const freeServers: Set<string> = g._mcFreeServers ?? (g._mcFreeServers = new Set());
const portMap: Map<string, PortPair> = g._mcPortMap ?? (g._mcPortMap = new Map());

const LOG_CAP = 1_000;
const IDLE_SHUTDOWN_MS = 5 * 60 * 1_000; // 5 minutes

// ── Idle shutdown (free servers only) ─────────────────────────────────────────

function scheduleIdleShutdown(uuid: string) {
  const existing = idleTimers.get(uuid);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    idleTimers.delete(uuid);
    pushLog(uuid, "[Panel] Free server: no players online for 5 minutes — shutting down.");
    doStop(uuid, false).catch(() => {});
  }, IDLE_SHUTDOWN_MS);
  idleTimers.set(uuid, timer);
}

function cancelIdleShutdown(uuid: string) {
  const timer = idleTimers.get(uuid);
  if (timer) { clearTimeout(timer); idleTimers.delete(uuid); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cName(uuid: string) {
  // Docker container names: alphanumeric + dashes, max 63 chars
  return `hobbypanel-${uuid}`;
}

function rconPass(uuid: string) {
  return `hp${uuid.replace(/-/g, "").slice(0, 16)}`;
}

function dataDir(uuid: string) {
  return path.join(DATA_DIR, uuid);
}

function ensureDir(uuid: string) {
  const dir = dataDir(uuid);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pushLog(uuid: string, line: string) {
  let buf = logBufs.get(uuid);
  if (!buf) { buf = []; logBufs.set(uuid, buf); }
  buf.push(line);
  if (buf.length > LOG_CAP) buf.shift();
  const cbs = listeners.get(uuid);
  if (cbs) for (const cb of cbs) cb(line);

  // Player join/leave tracking and idle shutdown (free servers)
  if (line.includes("joined the game")) {
    const player = line.match(/:\s+(\S+) joined the game/)?.[1];
    if (freeServers.has(uuid)) {
      playerCounts.set(uuid, (playerCounts.get(uuid) ?? 0) + 1);
      cancelIdleShutdown(uuid);
    }
    if (player) {
      fireAlert(uuid, "player_join", { player }).catch(() => {});
    }
  } else if (line.includes("left the game") || line.includes("lost connection")) {
    if (freeServers.has(uuid)) {
      const count = Math.max(0, (playerCounts.get(uuid) ?? 1) - 1);
      playerCounts.set(uuid, count);
      if (count === 0) scheduleIdleShutdown(uuid);
    }
  } else if (line.includes("Done (") && line.includes("help")) {
    // Server finished starting — idle timer for free servers
    if (freeServers.has(uuid) && (playerCounts.get(uuid) ?? 0) === 0) scheduleIdleShutdown(uuid);
    // fireAlert handles dedup: only fires once per start/stop cycle
    fireAlert(uuid, "server_start").catch(console.error);
  }
}

function jarEnv(jarType: string): string {
  return ({ paper: "PAPER", purpur: "PURPUR", fabric: "FABRIC", vanilla: "VANILLA" } as Record<string, string>)[jarType.toLowerCase()] ?? "PAPER";
}

// ── Container introspection ───────────────────────────────────────────────────

async function containerInfo(uuid: string) {
  try {
    const all = await docker.listContainers({ all: true });
    const name = "/" + cName(uuid);
    return all.find((c) => c.Names.includes(name)) ?? null;
  } catch { return null; }
}

async function liveStatus(uuid: string): Promise<RunStatus> {
  const info = await containerInfo(uuid);
  if (!info) return "offline";
  switch (info.State) {
    case "running": {
      const buf = logBufs.get(uuid) ?? [];
      const ready = buf.some((l) => l.includes("Done (") && l.includes("help"));
      return ready ? "running" : "starting";
    }
    case "restarting": return "starting";
    case "removing":   return "stopping";
    default:           return "offline";
  }
}

// ── Log streaming ─────────────────────────────────────────────────────────────

function startLogStream(uuid: string) {
  if (logActive.has(uuid)) return;
  logActive.add(uuid);

  const container = docker.getContainer(cName(uuid));

  container.logs({ follow: true, stdout: true, stderr: true, tail: 200 }, (err, stream) => {
    if (err || !stream) { logActive.delete(uuid); return; }

    // Docker multiplexed stream: each frame has an 8-byte header
    // [type(1), 0, 0, 0, size(4 BE)]
    let leftover = Buffer.alloc(0);

    (stream as NodeJS.ReadableStream).on("data", (chunk: Buffer) => {
      let buf = Buffer.concat([leftover, chunk]);
      leftover = Buffer.alloc(0);

      while (buf.length >= 8) {
        const frameSize = buf.readUInt32BE(4);
        if (buf.length < 8 + frameSize) { leftover = buf; break; }
        const payload = buf.slice(8, 8 + frameSize).toString("utf8");
        buf = buf.slice(8 + frameSize);
        for (const line of payload.split("\n")) {
          const t = line.replace(/\r$/, "");
          if (t && !t.includes("Thread RCON Client")) pushLog(uuid, t);
        }
      }
    });

    (stream as NodeJS.ReadableStream).on("end", () => {
      const wasCrash = statusCache.get(uuid) === "running";
      logActive.delete(uuid);
      statusCache.set(uuid, "offline");
      if (wasCrash) {
        fireAlert(uuid, "server_crash").catch(() => {});
      }
    });

    (stream as NodeJS.ReadableStream).on("error", () => {
      logActive.delete(uuid);
    });
  });
}

// ── Port allocation ───────────────────────────────────────────────────────────

async function allocateFreePorts(): Promise<PortPair> {
  // Collect every host port already bound by any Docker container
  const usedPorts = new Set<number>();
  try {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
      for (const p of c.Ports) {
        if (p.PublicPort) usedPorts.add(p.PublicPort);
      }
    }
  } catch { /* Docker unavailable — fall back to in-memory map */ }

  // Also reserve ports already in our in-memory map
  for (const { mcPort, rconPort } of portMap.values()) {
    usedPorts.add(mcPort);
    usedPorts.add(rconPort);
  }

  let mcPort = MC_PORT_START;
  while (usedPorts.has(mcPort)) mcPort++;

  let rconPort = RCON_PORT_START;
  while (usedPorts.has(rconPort)) rconPort++;

  return { mcPort, rconPort };
}

async function getOrAssignPorts(uuid: string): Promise<PortPair> {
  // 1. In-memory cache (survives HMR)
  const cached = portMap.get(uuid);
  if (cached) return cached;

  // 2. Recover from a running/exited container's port bindings
  try {
    const info = await docker.getContainer(cName(uuid)).inspect();
    const bindings = info.NetworkSettings.Ports ?? info.HostConfig?.PortBindings ?? {};
    const mcBinding   = (bindings[`${MC_PORT_INTERNAL}/tcp`]   as Array<{HostPort: string}> | null)?.[0];
    const rconBinding = (bindings[`${RCON_PORT_INTERNAL}/tcp`] as Array<{HostPort: string}> | null)?.[0];
    if (mcBinding && rconBinding) {
      const pair = { mcPort: parseInt(mcBinding.HostPort), rconPort: parseInt(rconBinding.HostPort) };
      portMap.set(uuid, pair);
      return pair;
    }
  } catch { /* container doesn't exist yet */ }

  // 3. Allocate fresh ports
  const pair = await allocateFreePorts();
  portMap.set(uuid, pair);
  return pair;
}

// ── Power actions ─────────────────────────────────────────────────────────────

async function createContainer(uuid: string, dir: string, jarType: string, mcVersion: string, memoryMb: number, cpuLimit: number, ports: PortPair, env: Record<string, string> = {}) {
  const resolvedVersion = env["MC_VERSION"] ?? mcVersion;
  pushLog(uuid, `[Panel] Creating ${jarEnv(jarType)} ${resolvedVersion} container (MC :${ports.mcPort}, RAM:${memoryMb}MB, CPU:${cpuLimit}%)…`);
  const container = await docker.createContainer({
    name:  cName(uuid),
    Image: MC_IMAGE,
    Env: [
      "EULA=TRUE",
      `TYPE=${jarEnv(jarType)}`,
      `VERSION=${resolvedVersion}`,
      `MEMORY=${memoryMb}M`,
      `ONLINE_MODE=${env["ONLINE_MODE"] ?? "TRUE"}`,
      "GUI=FALSE",
      "ENABLE_RCON=TRUE",
      `RCON_PASSWORD=${rconPass(uuid)}`,
      `RCON_PORT=${RCON_PORT_INTERNAL}`,
      "STOP_SERVER_ANNOUNCE_DELAY=0",
      ...(env["MAX_PLAYERS"] ? [`MAX_PLAYERS=${env["MAX_PLAYERS"]}`] : []),
      ...(env["MOTD"] ? [`MOTD=${env["MOTD"]}`] : []),
    ],
    ExposedPorts: {
      [`${MC_PORT_INTERNAL}/tcp`]:   {},
      [`${RCON_PORT_INTERNAL}/tcp`]: {},
    },
    HostConfig: {
      Binds: [`${dir}:/data`],
      PortBindings: {
        [`${MC_PORT_INTERNAL}/tcp`]:   [{ HostPort: String(ports.mcPort)   }],
        [`${RCON_PORT_INTERNAL}/tcp`]: [{ HostPort: String(ports.rconPort) }],
      },
      RestartPolicy: { Name: "unless-stopped" as const },
      // Hard memory cap — OOM killer will stop the container if exceeded
      Memory:     memoryMb * 1024 * 1024,
      MemorySwap: memoryMb * 1024 * 1024, // swap = Memory means no extra swap
      // CPU quota — cpuLimit is percentage of one core (100 = 1 vCPU)
      NanoCpus:   Math.max(1e8, Math.floor((cpuLimit / 100) * 1e9)),
    },
  });
  await container.start();
}

async function doStart(uuid: string, jarType: string, mcVersion: string, memoryMb: number, cpuLimit: number, env: Record<string, string> = {}, allocatedMcPort?: number) {
  const dir = ensureDir(uuid);
  statusCache.set(uuid, "starting");

  try {
    const existing = await containerInfo(uuid);

    if (existing?.State === "running" || existing?.State === "restarting") {
      setTimeout(() => startLogStream(uuid), 200);
      return;
    }

    if (existing?.State === "created") {
      pushLog(uuid, "[Panel] Removing stale container from previous failed start…");
      await docker.getContainer(cName(uuid)).remove({ force: true }).catch(() => {});
      portMap.delete(uuid);
    }

    if (!existing || existing.State === "created") {
      const images = await docker.listImages({ filters: { reference: [MC_IMAGE] } });
      if (!images.length) {
        pushLog(uuid, `[Panel] Pulling ${MC_IMAGE} (one-time, may take a minute)…`);
        await new Promise<void>((resolve, reject) => {
          docker.pull(MC_IMAGE, (err: Error | null, stream: NodeJS.ReadableStream) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, (e: Error | null) => (e ? reject(e) : resolve()));
          });
        });
        pushLog(uuid, "[Panel] Image ready.");
      }

      // If caller provided a DB-allocated port, use it and save to in-memory map.
      // Otherwise fall back to auto-allocation (legacy / no-allocation-configured path).
      let ports: PortPair;
      if (allocatedMcPort) {
        const cached = portMap.get(uuid);
        const rconPort = cached?.rconPort ?? (await allocateFreePorts()).rconPort;
        ports = { mcPort: allocatedMcPort, rconPort };
        portMap.set(uuid, ports);
      } else {
        ports = await getOrAssignPorts(uuid);
      }

      await createContainer(uuid, dir, jarType, mcVersion, memoryMb, cpuLimit, ports, env);
    } else {
      pushLog(uuid, `[Panel] Restarting existing container (${jarEnv(jarType)} ${mcVersion})…`);
      await docker.getContainer(cName(uuid)).start();
    }

    setTimeout(() => startLogStream(uuid), 600);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    pushLog(uuid, `[Panel] Failed to start: ${msg}`);
    if (msg.includes("connect ENOENT") || msg.includes("socket")) {
      pushLog(uuid, "[Panel] Cannot reach Docker. Is Docker Desktop running?");
    }
    statusCache.set(uuid, "offline");
  }
}

async function doStop(uuid: string, kill = false) {
  statusCache.set(uuid, "stopping");
  clearStartAlert(uuid);                        // allow next start to fire server_start again
  fireAlert(uuid, "server_stop").catch(console.error);
  try {
    const c = docker.getContainer(cName(uuid));
    if (kill) {
      await c.kill();
    } else {
      pushLog(uuid, "[Panel] Sending stop signal…");
      await c.stop({ t: 30 });
    }
  } catch { /* already stopped */ }
  logActive.delete(uuid);
  statusCache.set(uuid, "offline");
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getDockerStats(uuid: string) {
  try {
    const c = docker.getContainer(cName(uuid));
    const s = await c.stats({ stream: false }) as Docker.ContainerStats;

    const cpuDelta = s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
    const sysDelta = (s.cpu_stats.system_cpu_usage ?? 0) - (s.precpu_stats.system_cpu_usage ?? 0);
    const ncpu = s.cpu_stats.online_cpus ?? 1;
    const cpuPct = sysDelta > 0 ? (cpuDelta / sysDelta) * ncpu * 100 : 0;
    const memBytes = s.memory_stats.usage ?? 0;

    return { cpuPct: Math.min(cpuPct, 100), memBytes };
  } catch {
    return { cpuPct: 0, memBytes: 0 };
  }
}

// ── File operations (via bind-mounted data directory) ─────────────────────────

function fullPath(uuid: string, filePath: string) {
  // Prevent path traversal
  const rel = filePath.replace(/^\/+/, "");
  return path.join(dataDir(uuid), rel);
}

function detectMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const m: Record<string, string> = {
    properties: "text/plain", yml: "text/yaml", yaml: "text/yaml",
    json: "application/json", toml: "application/toml", log: "text/plain",
    txt: "text/plain", sh: "text/x-sh", jar: "application/java-archive",
    conf: "text/plain", cfg: "text/plain",
  };
  return m[ext] ?? "application/octet-stream";
}

function listDir(uuid: string, directory: string): WingsDirectoryContents {
  const dir = fullPath(uuid, directory || "/");
  const entries: WingsDirectoryContents["data"] = [];
  try {
    if (!fs.existsSync(dir)) return { object: "list", data: [] };
    const items = fs.readdirSync(dir);
    for (const name of items) {
      try {
        const stat = fs.statSync(path.join(dir, name));
        const isFile = stat.isFile();
        entries.push({
          name,
          mode: isFile ? "-rw-r--r--" : "drwxr-xr-x",
          size: isFile ? stat.size : 0,
          is_file: isFile,
          is_symlink: stat.isSymbolicLink(),
          is_editable: isFile && stat.size < 10_000_000,
          mimetype: isFile ? detectMime(name) : "inode/directory",
          created_at: stat.birthtime.toISOString(),
          modified_at: stat.mtime.toISOString(),
        });
      } catch { /* skip unreadable */ }
    }
  } catch { /* dir doesn't exist yet */ }

  return { object: "list", data: entries };
}

// ── RCON execution (returns output) ──────────────────────────────────────────

async function execRcon(uuid: string, command: string): Promise<string> {
  const c = docker.getContainer(cName(uuid));
  const exec = await c.exec({
    Cmd: ["rcon-cli", command],
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    exec.start({ hijack: true, stdin: false }, (err: Error | null, s?: NodeJS.ReadableStream) => {
      if (err || !s) reject(err ?? new Error("no stream")); else resolve(s);
    });
  });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", resolve);
    stream.on("error", resolve);
    setTimeout(resolve, 5_000);
  });
  // Demultiplex Docker stream frames
  let buf = Buffer.concat(chunks);
  const lines: string[] = [];
  while (buf.length >= 8) {
    const frameSize = buf.readUInt32BE(4);
    if (buf.length < 8 + frameSize) break;
    const text = buf.slice(8, 8 + frameSize).toString("utf8").trim();
    if (text) lines.push(text);
    buf = buf.slice(8 + frameSize);
  }
  return lines.join("\n");
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function sendCommand(uuid: string, command: string) {
  try {
    const output = await execRcon(uuid, command);
    if (output) pushLog(uuid, output);
  } catch (e) {
    pushLog(uuid, `[Panel] Command error: ${(e as Error).message}`);
  }
}

// ── Public API (mirrors simulator.ts interface) ───────────────────────────────

export const dockerRunner = {
  // Power
  async power(uuid: string, action: PowerAction, jarType = "paper", mcVersion = "latest", memoryMb = 1024, cpuLimit = 100, isFree = false, env: Record<string, string> = {}, mcPort?: number): Promise<void> {
    switch (action) {
      case "start":
        if (isFree) freeServers.add(uuid); else freeServers.delete(uuid);
        playerCounts.delete(uuid);
        doStart(uuid, jarType, mcVersion, memoryMb, cpuLimit, env, mcPort).catch(() => {});
        break;
      case "stop":
        cancelIdleShutdown(uuid);
        freeServers.delete(uuid);
        playerCounts.delete(uuid);
        doStop(uuid, false).catch(() => {});
        break;
      case "kill":
        cancelIdleShutdown(uuid);
        freeServers.delete(uuid);
        playerCounts.delete(uuid);
        doStop(uuid, true).catch(() => {});
        break;
      case "restart":
        cancelIdleShutdown(uuid);
        if (isFree) freeServers.add(uuid); else freeServers.delete(uuid);
        playerCounts.delete(uuid);
        doStop(uuid, false)
          .then(() => new Promise<void>(r => setTimeout(r, 1000)))
          .then(() => doStart(uuid, jarType, mcVersion, memoryMb, cpuLimit, env, mcPort))
          .catch(() => {});
        break;
    }
  },

  // Resources
  async getResources(uuid: string): Promise<WingsServerState> {
    // Always compute live status — the stale statusCache (set during transitions)
    // would otherwise keep reporting "offline" after Docker boots the container.
    const status = await liveStatus(uuid);
    statusCache.set(uuid, status);

    const isUp = status === "running" || status === "starting";
    const { cpuPct, memBytes } = isUp ? await getDockerStats(uuid) : { cpuPct: 0, memBytes: 0 };

    const dir = dataDir(uuid);
    let diskBytes = 0;
    if (fs.existsSync(dir)) {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          try { diskBytes += fs.statSync(path.join(dir, item)).size; } catch {}
        }
      } catch {}
    }

    return {
      object: "server_state",
      attributes: {
        current_state: status,
        is_suspended: false,
        resources: {
          memory_bytes: memBytes,
          cpu_absolute: parseFloat(cpuPct.toFixed(2)),
          disk_bytes: diskBytes,
          network_rx_bytes: 0,
          network_tx_bytes: 0,
          uptime: 0,
        },
      },
    };
  },

  // Console auth (unused for docker mode — ws-handler calls onConsole directly)
  getConsoleAuth(uuid: string): WingsConsoleAuth {
    return { token: `docker-${uuid}`, socket: "" };
  },

  // Commands
  handleCommand(uuid: string, command: string): void {
    sendCommand(uuid, command).catch(() => pushLog(uuid, `> ${command}`));
  },

  // RCON — returns output string (throws if container not running)
  async rcon(uuid: string, command: string): Promise<string> {
    return execRcon(uuid, command);
  },

  // Log replay
  getRecentLogs(uuid: string): string[] {
    return [...(logBufs.get(uuid) ?? [])];
  },

  // Console subscriptions
  onConsole(uuid: string, cb: (line: string) => void): () => void {
    let set = listeners.get(uuid);
    if (!set) { set = new Set(); listeners.set(uuid, set); }
    set.add(cb);
    // Start streaming if the container is running
    containerInfo(uuid).then((info) => {
      if (info?.State === "running") startLogStream(uuid);
    });
    return () => set!.delete(cb);
  },

  // File system
  listDirectory(uuid: string, directory: string): WingsDirectoryContents {
    return listDir(uuid, directory || "/");
  },

  readFile(uuid: string, file: string): string {
    try { return fs.readFileSync(fullPath(uuid, file), "utf8"); } catch { return ""; }
  },

  writeFile(uuid: string, file: string, contents: string): void {
    const p = fullPath(uuid, file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, contents, "utf8");
  },

  deleteFiles(uuid: string, root: string, files: string[]): void {
    for (const f of files) {
      const p = fullPath(uuid, path.join(root, f));
      try {
        const s = fs.statSync(p);
        if (s.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
        else fs.unlinkSync(p);
      } catch {}
    }
  },

  renameFiles(uuid: string, root: string, files: Array<{ from: string; to: string }>): void {
    for (const { from, to } of files) {
      try {
        fs.renameSync(fullPath(uuid, path.join(root, from)), fullPath(uuid, path.join(root, to)));
      } catch {}
    }
  },

  createDirectory(uuid: string, name: string, parentDir: string): void {
    fs.mkdirSync(fullPath(uuid, path.join(parentDir, name)), { recursive: true });
  },

  uploadFile(uuid: string, directory: string, filename: string, contents: string): void {
    const p = fullPath(uuid, path.join(directory, filename));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, contents, "utf8");
  },

  writeFileBinary(uuid: string, filePath: string, data: Buffer): void {
    const p = fullPath(uuid, filePath);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  },

  reinstall(uuid: string): void {
    // Stop the container and wipe data
    dockerRunner.power(uuid, "kill").catch(() => {});
    logBufs.delete(uuid);
    statusCache.delete(uuid);
    logActive.delete(uuid);
    const dir = dataDir(uuid);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  },

  // Hard-stop and remove the container; does NOT delete the data directory
  // so callers can archive it first.
  async destroy(uuid: string): Promise<void> {
    cancelIdleShutdown(uuid);
    logBufs.delete(uuid);
    logActive.delete(uuid);
    statusCache.set(uuid, "offline");
    playerCounts.delete(uuid);
    freeServers.delete(uuid);
    listeners.delete(uuid);

    try {
      // force:true stops the container if running, then removes it
      await docker.getContainer(cName(uuid)).remove({ force: true });
    } catch { /* container may not exist — that's fine */ }
  },

  // Backups (stored as .tar.gz in {dataDir}/backups/)
  createBackup(uuid: string, backupUuid: string): WingsBackup {
    return {
      uuid: backupUuid,
      is_successful: true,
      checksum: "mock",
      checksum_type: "sha256",
      file_size: 0,
      parts: null,
      created_at: new Date().toISOString(),
    };
  },

  deleteBackup(_uuid: string, _backupUuid: string): void {},
};
