import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ThemeClient } from "./client";
import type { UserTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Theme" };
export const dynamic = "force-dynamic";

export default async function ThemePage() {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { themeData: true },
  });

  const theme = (dbUser?.themeData ?? {}) as UserTheme;

  return <ThemeClient initialTheme={theme} />;
}
