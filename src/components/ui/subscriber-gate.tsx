import { LinkButton } from "@/components/ui/button";

/**
 * The one reusable pattern for a subscriber-only feature: never invisible,
 * never silently disabled. A non-subscriber sees what the feature is and gets
 * a direct route to unlock it, wherever this gate is used (multiple baskets,
 * member pricing, the recurring basket mechanics).
 */
export function SubscriberGate({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-border bg-surface p-4 ${className ?? ""}`}
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
      <LinkButton href="/subscribe" size="sm" className="shrink-0">
        Subscribe to unlock
      </LinkButton>
    </div>
  );
}
