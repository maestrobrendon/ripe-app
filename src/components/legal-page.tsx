import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Shared layout for the terms and privacy pages: a plain-English summary, an
 * "On this page" index, then numbered sections the index links to.
 */
export function LegalPage({
  title,
  lastUpdated,
  summary,
  sections,
}: {
  title: string;
  lastUpdated: string;
  summary: string[];
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {lastUpdated}</p>

      <div className="mt-8 rounded-card border border-border bg-surface p-5">
        <h2 className="font-medium">The short version</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          This summary is here to help. The full text below is what applies.
        </p>
      </div>

      <nav aria-label="On this page" className="mt-8">
        <h2 className="text-sm font-medium">On this page</h2>
        <ol className="mt-3 grid list-decimal gap-x-6 gap-y-1.5 pl-5 text-sm text-muted sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:text-foreground hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-lg font-semibold">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
