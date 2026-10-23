import type { MetadataRoute } from "next";

/*
 * Basket as an app on the customer's phone (and desktop). Installed, it opens
 * straight to Home without the browser's bars, has its own icon in the app
 * list, and can receive notifications (public/sw.js).
 *
 * Only signed-in pages link to it (generateMetadata in (site)/layout.tsx), so
 * a browser only offers to install Basket once someone has an account; Kachi
 * then offers it too (components/app/app-setup.tsx).
 */
function manifest(): MetadataRoute.Manifest {
  return {
    id: "/basket",
    name: "BasketNG",
    short_name: "BasketNG",
    description: "Fresh fruit and vegetables every week, and exciting ways to eat them. Delivered across Lagos.",
    start_url: "/basket?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["food", "shopping", "health"],
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Your basket", url: "/basket?source=app-shortcut", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Shop", url: "/shop?source=app-shortcut", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Recipes", url: "/recipes?source=app-shortcut", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Orders", url: "/orders?source=app-shortcut", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
    ],
  };
}

export function GET() {
  return new Response(JSON.stringify(manifest()), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
