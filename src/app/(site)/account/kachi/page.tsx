import Link from "next/link";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { getCurrentUser } from "@/lib/session";
import { listMemories } from "@/lib/kachi-memory";
import { MemoryList } from "./memory-list";

export const metadata = { title: "What Kachi knows" };

/** Everything Kachi remembers about you, to read, correct or delete. */
export default async function KachiMemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/kachi");
  const memories = await listMemories(user.id);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-grouped">
      <div className="mx-auto max-w-2xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
        <BackButton fallback="/account" label="Me" />
        <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">What Kachi knows</h1>
        <p className="mt-1 text-[15px] text-muted">
          When you tell Kachi something that stays true, like a food you don&rsquo;t eat, she keeps a note so you don&rsquo;t have to say it again. Change or delete anything here.
        </p>
        <MemoryList memories={memories} />
        <p className="mt-6 text-[13px] leading-relaxed text-muted">
          She also uses your{" "}
          <Link href="/account" className="font-semibold text-carbon underline-offset-2 hover:underline">
            food and household
          </Link>{" "}
          settings. Only Kachi uses these notes, to help you with food. See our{" "}
          <Link href="/privacy" className="font-semibold text-carbon underline-offset-2 hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
