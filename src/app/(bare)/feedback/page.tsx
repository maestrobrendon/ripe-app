import { getCurrentUser } from "@/lib/session";
import { FEEDBACK_REWARD, hadFeedbackReward } from "@/lib/feedback";
import { FeedbackFlow } from "./feedback-flow";
import "../home-menu/home-menu.css";

export const metadata = {
  title: "Tell us how we're doing. BasketNG",
  description: "Two minutes, one question at a time. Tell us what you love and what we should do better.",
};

export default async function FeedbackPage() {
  const user = await getCurrentUser();
  const rewarded = user ? await hadFeedbackReward(user.id) : false;
  return <FeedbackFlow firstName={user?.name.trim().split(/\s+/)[0] || null} signedIn={Boolean(user)} reward={rewarded ? 0 : FEEDBACK_REWARD} />;
}
