import { NextResponse, type NextRequest } from "next/server";

/**
 * The new homepage is built beside the live one, not over it. On a "test."
 * host (test.getbasket...) the root URL serves /home-next; everywhere else
 * nothing changes. /home-next also works directly, for local development.
 *
 * Both get a header the root layout reads to drop the site chrome (banner,
 * header, footer, tab bar), because the new page draws its own.
 */
const PREVIEW_PATH = "/home-next";
const BARE_HEADER = "x-basket-bare";

export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.delete(BARE_HEADER);

  if (pathname === "/" && /^(test|text)\./.test(host)) {
    headers.set(BARE_HEADER, "1");
    const url = request.nextUrl.clone();
    url.pathname = PREVIEW_PATH;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (pathname === PREVIEW_PATH) {
    headers.set(BARE_HEADER, "1");
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/", "/home-next"],
};
