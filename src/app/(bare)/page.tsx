import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import HomeMenuPage, { metadata } from "./home-menu/page";

export { metadata };

/**
 * The homepage: the recipe-led design in src/app/(bare)/home-menu. The previous one
 * is archived at /archive/home.
 */
export default async function HomePage() {
  // A member's home is the basket hub, not the shop front.
  if (await getCurrentUser()) redirect("/basket");
  return <HomeMenuPage />;
}
