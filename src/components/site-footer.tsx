import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-ripe-green-light/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-lg font-semibold text-ripe-green">Ripe</p>
            <p className="mt-2 max-w-xs text-sm text-muted">
              Fruits and vegetables, curated for health, delivered farm-direct across Lagos.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Ripe</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><Link href="/subscribe" className="hover:text-foreground">Subscription tiers</Link></li>
              <li><Link href="/shop" className="hover:text-foreground">Shop</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Account</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li><Link href="/account" className="hover:text-foreground">Dashboard</Link></li>
              <li><Link href="/basket" className="hover:text-foreground">Your basket</Link></li>
              <li><Link href="/assistant" className="hover:text-foreground">Trained assistant</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted">
          Ripe is not trying to replace Chowdeck, roadside sellers, or supermarkets — it&rsquo;s built for people who already want to eat better, consistently.
        </p>
      </div>
    </footer>
  );
}
