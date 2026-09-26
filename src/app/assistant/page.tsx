import { redirect } from "next/navigation";

// Ideas now lives in the basket hub, with a second entry point on Recipes.
export default function AssistantRedirect() {
  redirect("/basket");
}
