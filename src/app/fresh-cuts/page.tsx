import { CollectionPage } from "@/components/collection-page";
import { FRESH_CUTS_TAG } from "@/lib/product";

export const metadata = { title: "Fresh Cuts. Ripe" };

// Working name for the pre-cut, ready-to-eat line (see the brief, Section 1).
export default function FreshCutsPage() {
  return (
    <CollectionPage
      title="Fresh Cuts"
      blurb="Pre-cut and ready to eat. Washed, chopped and packed the morning it goes out."
      where={{ tags: { has: FRESH_CUTS_TAG } }}
    />
  );
}
