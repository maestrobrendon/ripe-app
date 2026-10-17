import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "../../_ui/kit";

export const metadata: Metadata = { title: "Not available" };

export default function ForbiddenPage() {
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <p className="text-[17px] font-semibold">Your role doesn&apos;t include this page</p>
      <p className="mt-2 text-[14px] text-carbon/60">If you need it for your work, ask an Owner to change your role. Attempts are recorded.</p>
      <Link href="/" className="mt-5 inline-block text-[14px] font-semibold underline underline-offset-2">
        Back to the overview
      </Link>
    </Card>
  );
}
