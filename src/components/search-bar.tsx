"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatNaira } from "@/lib/format";

type Result = { slug: string; name: string; unit: string; imageEmoji: string; price: number };

export function SearchBar({
  compact = false,
  autoFocus = false,
  onNavigate,
}: {
  compact?: boolean;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as { results: Result[] };
          setResults(data.results);
          setOpen(true);
        }
      } catch {
        /* ignore transient search failures */
      }
    }, 180);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div ref={boxRef} className={`relative ${compact ? "w-full" : "w-full max-w-sm"}`}>
      <form onSubmit={submit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          autoFocus={autoFocus}
          placeholder="Search produce"
          aria-label="Search produce"
          className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm"
        />
      </form>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          {results.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/products/${r.slug}`}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-ripe-green-light"
              >
                <span className="text-xl">{r.imageEmoji}</span>
                <span className="flex-1">{r.name}</span>
                <span className="text-xs text-muted">{formatNaira(r.price)}</span>
              </Link>
            </li>
          ))}
          <li>
            <button
              onClick={submit}
              className="w-full px-4 py-2 text-left text-xs font-medium text-ripe-green hover:bg-ripe-green-light"
            >
              See all results for &ldquo;{q.trim()}&rdquo;
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
