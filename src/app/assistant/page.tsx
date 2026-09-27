import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AssistantChat } from "./assistant-chat";

export const metadata = { title: "Assistant. Basket" };

/**
 * Its own top-level tab, full screen on every breakpoint (per the Mobile Nav
 * and AI Agent addendum, Section 1 and the follow-up build note) — the only
 * surface in the app where a conversation can mutate a basket or cart. See
 * src/lib/assistant-tools.ts for the tool functions and their authorization
 * checks, and src/app/api/assistant/route.ts for the model wiring.
 */
export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/assistant");

  return <AssistantChat />;
}
