import { NextRequest, NextResponse } from "next/server";

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

const SESSION_COOKIE = "hp_session";

// Routes that require a valid session cookie (redirect to /login if missing)
const PROTECTED = ["/dashboard", "/server", "/account", "/credits", "/theme", "/admin"];
// Routes that should redirect to /dashboard when already authenticated
const AUTH_ONLY  = ["/login", "/register"];

const IS_PROD = process.env.NODE_ENV === "production";

function buildCsp(nonce: string): string {
  // 'strict-dynamic' lets the inline bootstrap script load all other scripts
  // without needing 'unsafe-inline', which is the main XSS vector.
  const scriptSrc = IS_PROD
    ? `'nonce-${nonce}' 'strict-dynamic'`
    : `'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",          // inline style= attributes for theme vars
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",               // WebSocket (Wings console)
    "frame-ancestors 'none'",                    // clickjacking prevention
    "base-uri 'self'",                           // block <base> tag injection
    "form-action 'self'",                        // block form hi-jacking
    "object-src 'none'",                         // no Flash / plugins
    ...(IS_PROD ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // ── Routing ────────────────────────────────────────────────────────────────
  let response: NextResponse;

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    response = NextResponse.redirect(url);
  } else if (AUTH_ONLY.some((p) => pathname.startsWith(p)) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    response = NextResponse.redirect(url);
  } else {
    // Pass the nonce to Server Components via a request header so Next.js
    // can apply it to the hydration <script> bootstrap automatically.
    const nonce = randomNonce();
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-nonce", nonce);

    response = NextResponse.next({ request: { headers: reqHeaders } });

    // ── Security headers ───────────────────────────────────────────────────
    response.headers.set("Content-Security-Policy", buildCsp(nonce));
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
    response.headers.set("X-DNS-Prefetch-Control", "on");
    if (IS_PROD) {
      // Tell browsers to only use HTTPS for the next 2 years
      response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
