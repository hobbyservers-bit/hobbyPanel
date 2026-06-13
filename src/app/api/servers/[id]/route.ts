import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "./_shared";
import { deleteServerWithBackup } from "@/lib/server-deletion";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;
  if (!access.isOwner) {
    return NextResponse.json({ error: "Only the server owner can delete this server" }, { status: 403 });
  }

  await deleteServerWithBackup(id);

  return NextResponse.json({ ok: true });
}
