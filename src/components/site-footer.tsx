import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-ripe-green-light/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-4">
          <div>
            <p className="text-lg font-semibold text-ripe-green">Ripe</p>
            <p className="mt-2 max-w-xs text-sm text-muted">
              Fruits and vegetables, delivered across Lagos, sourced locally from trusted farmers.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Shop</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li><Link href="/fruits" className="hover:text-foreground">Fruits</Link></li>
              <li><Link href="/boxes-baskets" className="hover:text-foreground">Boxes &amp; Baskets</Link></li>
              <li><Link href="/fresh-cuts" className="hover:text-foreground">Fresh Cuts</Link></li>
              <li><Link href="/recipes" className="hover:text-foreground">Recipes</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Company</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li><Link href="/subscribe" className="hover:text-foreground">Subscription</Link></li>
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><Link href="/delivery-areas" className="hover:text-foreground">Delivery areas</Link></li>
              <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Support</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li><a href="mailto:hello@ripe.ng" className="hover:text-foreground">hello@ripe.ng</a></li>
              <li><a href="https://wa.me/2348000000000" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">WhatsApp us</a></li>
              <li><Link href="/account" className="hover:text-foreground">Your account</Link></li>
              <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted">
          Ripe is not trying to replace Chowdeck, roadside sellers, or supermarkets. It is built for people who already want to eat better, consistently.
        </p>
      </div>
    </footer>
  );
}
