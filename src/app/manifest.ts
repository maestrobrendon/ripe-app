import type { MetadataRoute } from "next";

/*
 * Basket as an app on the customer's phone (and desktop). Installed, it opens
 * straight to Home without the browser's bars, has its own icon in the app
 * list, and can receive notifications (public/sw.js). Kachi offers to install
 * it once a customer is signed in (components/app/app-setup.tsx).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/basket",
    name: "Basket",
    short_name: "Basket",
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
