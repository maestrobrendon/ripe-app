import { NextResponse, type NextRequest } from "next/server";

/**
 * Two jobs.
 *
 * 1. The admin's front door. The admin (src/app/(admin)/admin) is only served
 *    on ADMIN_HOST. There, every path is mapped into it, so none of the
 *    customer site exists on that host, and every response carries the
 *    admin's strict headers: a per-request nonce CSP, no caching, no
 *    indexing, no framing. On any other host (the shop, Vercel's preview and
 *    per-deployment URLs), anything admin-shaped is a plain 404.
 *
 * 2. Customer-site routing: "/home-menu" redirects to "/", and the root of a
 *    "test." host shows the /home-next draft. Which pages drop the site
 *    chrome is decided by route group: see src/app/(bare)/layout.tsx.
 *
 * The host is read from the Host header only. X-Forwarded-Host is set by
 * the client off Vercel and must never decide who reaches the admin.
 */

const ADMIN_HOST = (process.env.ADMIN_HOST ?? "").trim().toLowerCase();
const ADMIN_PREFIX = "/admin";
const PREVIEW_PATH = "/home-next";

function adminCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Inline style *attributes* only (layout values from React). Script injection stays blocked.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    // Product photos upload straight to Cloudinary with a server-signed request.
    `connect-src 'self' https://api.cloudinary.com${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function withAdminHeaders(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

function admin(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = adminCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  // The site's public photos (recipe images in the recipe editor) are served
  // as they are, still with the admin's headers.
  if (request.nextUrl.pathname.startsWith("/images/")) {
    return withAdminHeaders(NextResponse.next({ request: { headers } }), csp);
  }

  // "/orders" on the admin host is /admin/orders inside the app. A request
  // that already names /admin/... maps to /admin/admin/... and 404s, so the
  // admin has exactly one address for each screen.
  const url = request.nextUrl.clone();
  url.pathname = `${ADMIN_PREFIX}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
  return withAdminHeaders(NextResponse.rewrite(url, { request: { headers } }), csp);
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;

  if (ADMIN_HOST && host === ADMIN_HOST) return admin(request);

  // Not the admin host: the admin does not exist here.
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = "/__not-found";
    return NextResponse.rewrite(url, { status: 404 });
  }

  if (pathname === "/home-menu") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/" && /^(test|text)\./.test(host)) {
    const url = request.nextUrl.clone();
    url.pathname = PREVIEW_PATH;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except build assets and the site icons, which both hosts share.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)",
  ],
};
