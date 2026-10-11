import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
