import { redirect } from "next/navigation";

// The trained assistant now lives inside Recipes (see the brief, Section 2).
export default function AssistantRedirect() {
  redirect("/recipes");
}
