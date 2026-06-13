/**
 * Seeds built-in Pterodactyl-compatible eggs.
 * Safe to re-run — uses upsert on name.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JAVA_IMAGES = {
  "ghcr.io/pterodactyl/yolks:java_21": "Java 21",
  "ghcr.io/pterodactyl/yolks:java_17": "Java 17",
  "ghcr.io/pterodactyl/yolks:java_11": "Java 11",
};

interface EggDef {
  name: string;
  author: string;
  description: string;
  features: string[];
  dockerImage: string;
  dockerImages: Record<string, string>;
  startup: string;
  configStop: string;
  configStartup: string;
  itzgType: string;
  variables: {
    name: string;
    description: string;
    envVariable: string;
    defaultValue: string;
    userViewable: boolean;
    userEditable: boolean;
    rules: string;
    sortOrder: number;
  }[];
}

const BUILT_IN_EGGS: EggDef[] = [
  {
    name: "Minecraft Java — Paper",
    author: "support@pterodactyl.io",
    description: "High-performance fork of Spigot with game-changing patches and better performance.",
    features: ["eula", "java_version"],
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    dockerImages: JAVA_IMAGES,
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}",
    configStop: "stop",
    configStartup: JSON.stringify({ done: "Done (\\d+\\.\\d+s)! For help", userInteraction: ["Go to eula.txt"] }),
    itzgType: "PAPER",
    variables: [
      { name: "Server Jar File", description: "Jar filename used to launch the server.", envVariable: "SERVER_JARFILE", defaultValue: "server.jar", userViewable: true, userEditable: false, rules: "required|string|between:1,40", sortOrder: 0 },
      { name: "Minecraft Version", description: "The version of Minecraft to download and run.", envVariable: "MC_VERSION", defaultValue: "latest", userViewable: true, userEditable: true, rules: "required|string|between:1,20", sortOrder: 1 },
      { name: "Build Number", description: "Paper build number to use. Use 'latest' for the newest build.", envVariable: "BUILD_NUMBER", defaultValue: "latest", userViewable: true, userEditable: true, rules: "required|string|between:1,10", sortOrder: 2 },
      { name: "Online Mode", description: "Requires players to have a valid Mojang account. Disable for offline/cracked clients.", envVariable: "ONLINE_MODE", defaultValue: "TRUE", userViewable: true, userEditable: true, rules: "required|string|in:TRUE,FALSE", sortOrder: 3 },
      { name: "Max Players", description: "Maximum number of players allowed on the server.", envVariable: "MAX_PLAYERS", defaultValue: "20", userViewable: true, userEditable: true, rules: "required|integer|min:1|max:1000", sortOrder: 4 },
    ],
  },
  {
    name: "Minecraft Java — Purpur",
    author: "support@pterodactyl.io",
    description: "Fork of Paper with extra configuration options, patches, and API additions.",
    features: ["eula", "java_version"],
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    dockerImages: JAVA_IMAGES,
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}",
    configStop: "stop",
    configStartup: JSON.stringify({ done: "Done (\\d+\\.\\d+s)! For help", userInteraction: ["Go to eula.txt"] }),
    itzgType: "PURPUR",
    variables: [
      { name: "Server Jar File", description: "Jar filename used to launch the server.", envVariable: "SERVER_JARFILE", defaultValue: "server.jar", userViewable: true, userEditable: false, rules: "required|string|between:1,40", sortOrder: 0 },
      { name: "Minecraft Version", description: "The version of Minecraft to download and run.", envVariable: "MC_VERSION", defaultValue: "latest", userViewable: true, userEditable: true, rules: "required|string|between:1,20", sortOrder: 1 },
      { name: "Build Number", description: "Purpur build number to use. Use 'latest' for the newest build.", envVariable: "BUILD_NUMBER", defaultValue: "latest", userViewable: true, userEditable: true, rules: "required|string|between:1,10", sortOrder: 2 },
      { name: "Online Mode", description: "Requires players to have a valid Mojang account.", envVariable: "ONLINE_MODE", defaultValue: "TRUE", userViewable: true, userEditable: true, rules: "required|string|in:TRUE,FALSE", sortOrder: 3 },
      { name: "Max Players", description: "Maximum number of players allowed on the server.", envVariable: "MAX_PLAYERS", defaultValue: "20", userViewable: true, userEditable: true, rules: "required|integer|min:1|max:1000", sortOrder: 4 },
    ],
  },
  {
    name: "Minecraft Java — Fabric",
    author: "support@pterodactyl.io",
    description: "Lightweight, modular modding toolchain for Minecraft Java Edition.",
    features: ["eula", "java_version"],
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    dockerImages: JAVA_IMAGES,
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui",
    configStop: "stop",
    configStartup: JSON.stringify({ done: "Done (\\d+\\.\\d+s)! For help", userInteraction: ["Go to eula.txt"] }),
    itzgType: "FABRIC",
    variables: [
      { name: "Server Jar File", description: "Jar filename used to launch the server.", envVariable: "SERVER_JARFILE", defaultValue: "fabric-server-launch.jar", userViewable: true, userEditable: false, rules: "required|string|between:1,40", sortOrder: 0 },
      { name: "Minecraft Version", description: "The version of Minecraft to download and run.", envVariable: "MC_VERSION", defaultValue: "latest", userViewable: true, userEditable: true, rules: "required|string|between:1,20", sortOrder: 1 },
      { name: "Fabric Loader Version", description: "Fabric Loader version. Use 'latest' for the newest.", envVariable: "FABRIC_VERSION", defaultValue: "latest", userViewable: true, userEditable: true, rules: "required|string|between:1,20", sortOrder: 2 },
      { name: "Online Mode", description: "Requires players to have a valid Mojang account.", envVariable: "ONLINE_MODE", defaultValue: "TRUE", userViewable: true, userEditable: true, rules: "required|string|in:TRUE,FALSE", sortOrder: 3 },
      { name: "Max Players", description: "Maximum number of players allowed on the server.", envVariable: "MAX_PLAYERS", defaultValue: "20", userViewable: true, userEditable: true, rules: "required|integer|min:1|max:1000", sortOrder: 4 },
    ],
  },
  {
    name: "Minecraft Java — Vanilla",
    author: "support@pterodactyl.io",
    description: "Official Mojang Minecraft server with no modifications.",
    features: ["eula", "java_version"],
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    dockerImages: JAVA_IMAGES,
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} --nogui",
    configStop: "stop",
    configStartup: JSON.stringify({ done: "Done (\\d+\\.\\d+s)! For help", userInteraction: ["Go to eula.txt"] }),
    itzgType: "VANILLA",
    variables: [
      { name: "Server Jar File", description: "Jar filename used to launch the server.", envVariable: "SERVER_JARFILE", defaultValue: "server.jar", userViewable: true, userEditable: false, rules: "required|string|between:1,40", sortOrder: 0 },
      { name: "Minecraft Version", description: "The version of Minecraft to download and run.", envVariable: "MC_VERSION", defaultValue: "latest", userViewable: true, userEditable: true, rules: "required|string|between:1,20", sortOrder: 1 },
      { name: "Online Mode", description: "Requires players to have a valid Mojang account.", envVariable: "ONLINE_MODE", defaultValue: "TRUE", userViewable: true, userEditable: true, rules: "required|string|in:TRUE,FALSE", sortOrder: 3 },
      { name: "Max Players", description: "Maximum number of players allowed on the server.", envVariable: "MAX_PLAYERS", defaultValue: "20", userViewable: true, userEditable: true, rules: "required|integer|min:1|max:1000", sortOrder: 4 },
    ],
  },
];

export async function seedEggs() {
  console.log("  Seeding built-in eggs…");
  for (const def of BUILT_IN_EGGS) {
    const egg = await prisma.egg.upsert({
      where: { name: def.name },
      update: {
        author: def.author,
        description: def.description,
        features: def.features,
        dockerImage: def.dockerImage,
        dockerImages: def.dockerImages,
        startup: def.startup,
        configStop: def.configStop,
        configStartup: def.configStartup,
        itzgType: def.itzgType,
      },
      create: {
        name: def.name,
        author: def.author,
        description: def.description,
        features: def.features,
        dockerImage: def.dockerImage,
        dockerImages: def.dockerImages,
        startup: def.startup,
        configStop: def.configStop,
        configStartup: def.configStartup,
        itzgType: def.itzgType,
      },
    });

    // Upsert variables (by eggId + envVariable)
    for (const v of def.variables) {
      await prisma.eggVariable.upsert({
        where: { eggId_envVariable: { eggId: egg.id, envVariable: v.envVariable } },
        update: { name: v.name, description: v.description, defaultValue: v.defaultValue, userViewable: v.userViewable, userEditable: v.userEditable, rules: v.rules, sortOrder: v.sortOrder },
        create: { eggId: egg.id, ...v },
      });
    }
    console.log(`    ${def.name}`);
  }
}

async function main() {
  await seedEggs();
  console.log("Egg seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
