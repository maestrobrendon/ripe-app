import { redirect } from "next/navigation";

// Account creation now runs through the guided flow. /signup is kept only as a
// stable entry point (typed URLs, old links) that forwards into it.
export default function SignupPage() {
  redirect("/start");
}
