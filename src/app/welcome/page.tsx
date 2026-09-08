import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { GOAL_LABEL } from "@/lib/format";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";

export const metadata = { title: "You are all set" };

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const goal = user.preferences?.primaryGoal;
  const goalLine = goal ? (GOAL_LABEL[goal] ?? goal).toLowerCase() : null;
  const windowDay = user.shoppingWindowDay ? SHOPPING_WINDOW_DAY_LABEL[user.shoppingWindowDay] : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-ripe-green">Account created</p>
      <h1 className="mt-2 text-3xl font-semibold">Welcome to Ripe, {user.name.split(" ")[0]}</h1>

      <div className="mt-8 space-y-4 rounded-2xl border border-border bg-surface p-5 text-sm">
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
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/basket"
          className="rounded-full bg-ripe-green px-6 py-3 text-center text-sm font-medium text-white hover:bg-ripe-green-dark"
        >
          Open my basket
        </Link>
        <Link
          href="/shop"
          className="rounded-full border border-border px-6 py-3 text-center text-sm font-medium hover:bg-ripe-green-light"
        >
          Browse the shop
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Your basket and account are saved. There is nothing else you need to do right now.
      </p>
    </div>
  );
}
