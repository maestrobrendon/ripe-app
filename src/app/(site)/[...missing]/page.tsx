import { notFound } from "next/navigation";

// With two root layouts there is no top-level one for an unknown URL to
// render inside, so Next would serve a bare, unstyled 404. Catching them here
// keeps the 404 inside the site chrome, as it was with a single root layout.
export default function MissingPage() {
  notFound();
}
