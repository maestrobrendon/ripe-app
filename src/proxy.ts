import { NextResponse, type NextRequest } from "next/server";

/**
 * The homepage ("/") is the recipe-led design in src/app/home-menu, which
 * draws its own header and footer. Paths here get a header the root layout
 * reads to drop the site chrome (banner, header, footer, tab bar).
 *
 * /home-menu redirects to "/" so the homepage has one address. The earlier
 * draft, /home-next, still answers at its own path and at the root of a
 * "test." host, for comparison.
 */
const PREVIEW_PATH = "/home-next";
const BARE_PATHS = new Set(["/", PREVIEW_PATH]);
const BARE_HEADER = "x-basket-bare";

export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.delete(BARE_HEADER);

  if (pathname === "/home-menu") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/" && /^(test|text)\./.test(host)) {
    headers.set(BARE_HEADER, "1");
    const url = request.nextUrl.clone();
    url.pathname = PREVIEW_PATH;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (BARE_PATHS.has(pathname)) {
    headers.set(BARE_HEADER, "1");
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/", "/home-next", "/home-menu"],
};
