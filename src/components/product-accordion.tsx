import Link from "next/link";

export type AccordionSection = {
  title: string;
  body: string | null;
  /** Optional link rendered under the body, for example into Recipes. */
  link?: { href: string; label: string };
};

/** Collapsed-by-default accordion for the product detail page. */
export function ProductAccordion({ sections }: { sections: AccordionSection[] }) {
  const visible = sections.filter((s) => s.body);
  if (visible.length === 0) return null;

  return (
    <div className="divide-y divide-border border-y border-border">
      {visible.map((s) => (
        <details key={s.title} className="group py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
            {s.title}
            <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 text-sm text-muted">
            <p>{s.body}</p>
            {s.link && (
              <Link href={s.link.href} className="mt-2 inline-block font-medium text-ripe-green underline">
                {s.link.label}
              </Link>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
