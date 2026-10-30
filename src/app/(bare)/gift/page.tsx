import { getCurrentUser } from "@/lib/session";
import { paystackReady } from "@/lib/paystack";
import { GiftFlow } from "./gift-flow";
import "../home-menu/home-menu.css";

export const metadata = {
  title: "Gift a basket. BasketNG",
  description: "Send someone in Lagos fresh fruit and veg. They pick what they like; we bring it to their door.",
};

export default async function GiftPage() {
  const user = await getCurrentUser();
  return <GiftFlow signedIn={Boolean(user)} firstName={user?.name.trim().split(/\s+/)[0] ?? ""} online={paystackReady()} />;
}
