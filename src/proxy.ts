import { NextResponse, type NextRequest } from "next/server";

/**
 * The homepage ("/") is the recipe-led design in src/app/(bare)/home-menu.
 * Which pages drop the site chrome is decided by route group, not here: see
 * src/app/(bare)/layout.tsx.
 *
 * /home-menu redirects to "/" so the homepage has one address. The earlier
 * draft, /home-next, still answers at its own path and at the root of a
 * "test." host, for comparison.
 */
const PREVIEW_PATH = "/home-next";

export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;

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
  matcher: ["/", "/home-menu"],
};
