import type { NextConfig } from "next";

/*
 * Baseline security headers for the customer site. The admin host gets its
 * own, stricter set (nonce CSP, no-store, noindex) from src/proxy.ts.
 * Geolocation stays allowed for this origin: sign-up's "Use my location".
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), usb=(), serial=(), bluetooth=(), geolocation=(self), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // Not on the admin host: src/proxy.ts gives it a stricter set of its own.
    const adminHost = process.env.ADMIN_HOST?.trim().toLowerCase();
    return [
      {
        source: "/:path*",
        ...(adminHost ? { missing: [{ type: "host" as const, value: adminHost.split(":")[0] }] } : {}),
        headers: SECURITY_HEADERS,
      },
    ];
  },
  // The old storefront collections now live on one page, /shop, as filters.
  // Fresh Cuts is discontinued; its address lands on the full list.
  async redirects() {
    return [
      { source: "/fruits", destination: "/shop?category=FRUIT", permanent: true },
      { source: "/boxes-baskets", destination: "/shop?category=BOX_BUNDLE", permanent: true },
      { source: "/fresh-cuts", destination: "/shop", permanent: true },
      { source: "/pricing", destination: "/subscribe", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dusynu0kv/**",
      },
    ],
  },
};

export default nextConfig;
