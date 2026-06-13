/**
 * Development seed — creates demo accounts and a fake server.
 * Never runs in production (guarded by NODE_ENV check).
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed must not run in production. Set NODE_ENV=development.");
  }

  console.log("Seeding development database...");

  // ── Upsert admin user ────────────────────────────────────────────────────
  const adminHash = await hash("password", ARGON2_OPTIONS);
  const admin = await prisma.user.upsert({
    where: { email: "admin@local.test" },
    update: {},
    create: {
      email: "admin@local.test",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });
  console.log("  admin@local.test / password  (role: ADMIN)");

  // ── Upsert regular user ──────────────────────────────────────────────────
  const userHash = await hash("password", ARGON2_OPTIONS);
  const regularUser = await prisma.user.upsert({
    where: { email: "user@local.test" },
    update: {},
    create: {
      email: "user@local.test",
      passwordHash: userHash,
      role: "USER",
    },
  });
  console.log("  user@local.test / password   (role: USER)");

  // ── Upsert demo node (fake — used by Wings simulator) ───────────────────
  const node = await prisma.node.upsert({
    where: { id: "demo-node-id" },
    update: {},
    create: {
      id: "demo-node-id",
      name: "Local Demo Node",
      fqdn: "localhost",
      port: 8080,
      tokenId: "demo-token-id",
      tokenSecret: "demo-token-secret",
      tlsEnabled: false,
    },
  });

  // ── Upsert demo servers ──────────────────────────────────────────────────
  const server1ExternalId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const server1 = await prisma.server.upsert({
    where: { externalId: server1ExternalId },
    update: {},
    create: {
      name: "Survival World",
      userId: admin.id,
      nodeId: node.id,
      externalId: server1ExternalId,
      status: "OFFLINE",
      memoryMb: 2048,
      diskMb: 10240,
      mcVersion: "1.21.4",
      jarType: "paper",
      startupCommand:
        "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar server.jar --nogui",
      dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    },
  });

  const server2ExternalId = "11111111-2222-3333-4444-555555555555";
  await prisma.server.upsert({
    where: { externalId: server2ExternalId },
    update: {},
    create: {
      name: "Creative Hub",
      userId: regularUser.id,
      nodeId: node.id,
      externalId: server2ExternalId,
      status: "OFFLINE",
      memoryMb: 1024,
      diskMb: 5120,
      mcVersion: "1.21.4",
      jarType: "paper",
      startupCommand:
        "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar server.jar --nogui",
      dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    },
  });

  // Give the admin subuser access to server2 too
  await prisma.serverUser.upsert({
    where: {
      userId_serverId: { userId: admin.id, serverId: server1.id },
    },
    update: {},
    create: {
      userId: admin.id,
      serverId: server1.id,
      canConsole: true,
      canFiles: true,
      canPower: true,
      canSettings: true,
    },
  });

  console.log("  Demo servers: 'Survival World', 'Creative Hub'");
  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
