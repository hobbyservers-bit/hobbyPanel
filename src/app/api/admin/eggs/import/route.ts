/**
 * POST /api/admin/eggs/import
 * Imports a Pterodactyl v1/v2 egg JSON, creating or updating the egg by name.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PtdlVariableSchema = z.object({
  name:          z.string(),
  description:   z.string().default(""),
  env_variable:  z.string(),
  default_value: z.string().default(""),
  user_viewable: z.boolean().default(true),
  user_editable: z.boolean().default(true),
  rules:         z.string().default(""),
});

const PtdlEggSchema = z.object({
  name:          z.string(),
  author:        z.string().optional(),
  description:   z.string().optional(),
  features:      z.array(z.string()).optional(),
  docker_images: z.record(z.string()).optional(),
  startup:       z.string(),
  config: z.object({
    stop:    z.string().default("stop"),
    startup: z.string().optional(),
    files:   z.string().optional(),
  }).optional(),
  scripts: z.object({
    installation: z.object({
      script:     z.string().optional(),
      container:  z.string().optional(),
    }).optional(),
  }).optional(),
  variables: z.array(PtdlVariableSchema).optional(),
});

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = PtdlEggSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: `Invalid Pterodactyl egg JSON: ${parsed.error.errors[0]?.message}` }, { status: 400 });
  }

  const d = parsed.data;
  const dockerImages = d.docker_images ?? {};
  const dockerImage = Object.keys(dockerImages)[0] ?? "ghcr.io/pterodactyl/yolks:java_21";

  const egg = await prisma.egg.upsert({
    where: { name: d.name },
    update: {
      author:          d.author ?? "",
      description:     d.description ?? "",
      features:        d.features ?? [],
      dockerImage,
      dockerImages,
      startup:         d.startup,
      configStop:      d.config?.stop ?? "stop",
      configStartup:   d.config?.startup ?? "{}",
      configFiles:     d.config?.files ?? "{}",
      installScript:   d.scripts?.installation?.script ?? "",
      installContainer: d.scripts?.installation?.container ?? "ghcr.io/pterodactyl/installers:alpine",
    },
    create: {
      name:            d.name,
      author:          d.author ?? "",
      description:     d.description ?? "",
      features:        d.features ?? [],
      dockerImage,
      dockerImages,
      startup:         d.startup,
      configStop:      d.config?.stop ?? "stop",
      configStartup:   d.config?.startup ?? "{}",
      configFiles:     d.config?.files ?? "{}",
      installScript:   d.scripts?.installation?.script ?? "",
      installContainer: d.scripts?.installation?.container ?? "ghcr.io/pterodactyl/installers:alpine",
    },
  });

  if (d.variables?.length) {
    // Replace all variables
    await prisma.eggVariable.deleteMany({ where: { eggId: egg.id } });
    await prisma.eggVariable.createMany({
      data: d.variables.map((v, i) => ({
        eggId:        egg.id,
        name:         v.name,
        description:  v.description,
        envVariable:  v.env_variable,
        defaultValue: v.default_value,
        userViewable: v.user_viewable,
        userEditable: v.user_editable,
        rules:        v.rules,
        sortOrder:    i,
      })),
    });
  }

  const full = await prisma.egg.findUnique({
    where: { id: egg.id },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ egg: full }, { status: 201 });
}
