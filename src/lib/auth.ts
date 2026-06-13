/**
 * Custom session-based auth.
 *
 * Sessions are 32-byte random tokens stored as-is in the database and in an
 * HTTP-only cookie. The DB session row IS the auth material — no JWT overhead,
 * no library dep. Sessions expire after SESSION_EXPIRES_DAYS.
 */

import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { cache } from "react";
import { randomBytes } from "crypto";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "hp_session";
const SESSION_EXPIRES_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
};

// ── Session lifecycle ─────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  return token;
}

export async function invalidateSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => {
    // Already deleted — safe to ignore
  });
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_EXPIRES_DAYS,
  };
}

// ── Request validation (React-cached — one DB call per request) ───────────────

export const validateRequest = cache(
  async (): Promise<{
    user: SessionUser | null;
    session: { id: string; expiresAt: Date } | null;
  }> => {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
    if (!token) return { user: null, session: null };

    const session = await prisma.session.findUnique({
      where: { id: token },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!session) return { user: null, session: null };

    // Expired — clean up and reject
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: token } }).catch(() => {});
      return { user: null, session: null };
    }

    return { user: session.user, session };
  }
);
