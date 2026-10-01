import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { GOAL_LABEL } from "@/lib/format";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import { SITE_NAME } from "@/lib/site";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "You are all set" };

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const goal = user.preferences?.primaryGoal;
  const goalLine = goal ? (GOAL_LABEL[goal] ?? goal).toLowerCase() : null;
  const windowDay = user.shoppingWindowDay ? SHOPPING_WINDOW_DAY_LABEL[user.shoppingWindowDay] : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-carbon">Account created</p>
      <h1 className="text-heading-lg mt-2">Welcome to {SITE_NAME}, {user.name.split(" ")[0]}</h1>

      <Card className="mt-8 space-y-4 text-sm">
        <p className="font-medium">How this works</p>
        <p className="text-muted">
          {goalLine
            ? `Your basket is set up around ${goalLine}. `
            : "Your basket is saved to your account. "}
          {windowDay
            ? `It is scheduled to ship on ${windowDay}. `
            : ""}
          You can open it and change any item whenever you like.
        </p>
        <p className="text-muted">
          Nothing is charged automatically, ever. When you are ready, checking out and paying is what
          confirms the order for your day. Until then the basket just sits there, yours to edit.
        </p>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        <LinkButton href="/basket" size="lg">Open my basket</LinkButton>
        <LinkButton href="/shop" variant="secondary" size="lg">Browse the shop</LinkButton>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Your basket and account are saved. There is nothing else you need to do right now.
      </p>
    </div>
  );
}
