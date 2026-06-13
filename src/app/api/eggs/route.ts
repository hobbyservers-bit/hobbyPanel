import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eggs = await prisma.egg.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      variables: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ eggs });
}
