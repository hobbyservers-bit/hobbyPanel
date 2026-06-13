import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";

const CACHE_TAG = "panel_settings";

export const getPanelSettings = unstable_cache(
  async () => {
    const row = await prisma.setting.findUnique({ where: { key: "maintenance_mode" } });
    return { maintenanceMode: row?.value === "true" };
  },
  [CACHE_TAG],
  { revalidate: 30, tags: [CACHE_TAG] }
);

export async function setPanelMaintenance(enabled: boolean): Promise<void> {
  await prisma.setting.upsert({
    where:  { key: "maintenance_mode" },
    update: { value: String(enabled) },
    create: { key: "maintenance_mode", value: String(enabled) },
  });
  revalidateTag(CACHE_TAG);
}
