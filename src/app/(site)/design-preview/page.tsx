import { notFound } from "next/navigation";
import { DesignShowcase } from "./design-showcase";

export const metadata = { title: "Design system · preview" };

/** Dev-only. A living page of every system primitive, in every state. */
export default function DesignSystemPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase />;
}
