import { CollectionPage } from "@/components/collection-page";

export const metadata = { title: "Fruits. Ripe" };

export default function FruitsPage() {
  return (
    <CollectionPage
      title="Fruits"
      blurb="Picked days before it reaches your door, sourced locally from trusted farmers."
      where={{ category: "FRUIT" }}
    />
  );
}
