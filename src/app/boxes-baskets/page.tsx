import { CollectionPage } from "@/components/collection-page";

export const metadata = { title: "Boxes & Baskets. Ripe" };

export default function BoxesBasketsPage() {
  return (
    <CollectionPage
      title="Boxes & Baskets"
      blurb="Pre-picked mixes for a week of meals. Members get combo pricing on every box."
      where={{ category: "BOX_BUNDLE" }}
    />
  );
}
