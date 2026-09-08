import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStarterCandidates } from "@/lib/starter-basket";
import { StartFlow } from "./start-flow";

export const metadata = { title: "Get started" };

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect("/account");

  const candidates = await getStarterCandidates();

  return <StartFlow candidates={candidates} error={error ?? null} />;
}
