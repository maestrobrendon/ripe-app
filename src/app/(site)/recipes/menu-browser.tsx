"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { MENU_GOALS, type MenuGoal } from "@/app/(bare)/home-menu/recipes";
import { RecipeCard } from "./recipe-card";
import type { RecipeCardView } from "./recipe-data";

const TIMES = [
  { id: 15, label: "15 min or less" },
  { id: 30, label: "30 min or less" },
] as const;

const chip = (on: boolean) =>
  `inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold transition-colors ${
    on ? "bg-carbon text-paper-white" : "bg-[var(--hm-tint)] text-carbon/75 hover:text-carbon"
  }`;

/**
 * Browse the menu: search by dish or ingredient, narrow by goal and time.
 * Unfiltered, the first recipe leads as a large card, the way a magazine
 * opens; any filter turns it into a plain grid with a count. The goal lives
 * in ?for= so a recipe page's breadcrumb can link straight back to it.
 */
export function MenuBrowser({
  recipes,
  ingredientNames,
  initialGoal,
}: {
  recipes: RecipeCardView[];
  /** Per recipe slug, the names of everything in it, so search finds "mango" in a salad. */
  ingredientNames: Record<string, string[]>;
  initialGoal: MenuGoal | null;
}) {
  const [goal, setGoal] = useState<MenuGoal | null>(initialGoal);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    const url = new URL(window.location.href);
    if (goal) url.searchParams.set("for", goal);
    else url.searchParams.delete("for");
    window.history.replaceState(window.history.state, "", url);
  }, [goal]);

  const shown = recipes.filter(
    (r) =>
      (!goal || r.goal === goal) &&
      (!maxMinutes || r.minutes <= maxMinutes) &&
      (!q || [r.title, r.hook, ...(ingredientNames[r.slug] ?? [])].some((t) => t.toLowerCase().includes(q))),
  );
  const filtered = Boolean(goal || maxMinutes || q);
  const [lead, ...rest] = shown;

  return (
    <div>
      <div className="flex flex-col gap-4">
        <label className="relative block w-full sm:max-w-md">
          <span className="sr-only">Search recipes</span>
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--hm-ink-3)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.2 13.2L17 17" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a dish or an ingredient"
            className="h-12 w-full rounded-full bg-[var(--hm-tint)] pr-4 pl-12 text-[15px] outline-none placeholder:text-[var(--hm-ink-3)] focus:bg-paper-white focus:shadow-[0_0_0_2px_var(--color-carbon)]"
          />
        </label>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <button type="button" aria-pressed={!goal} onClick={() => setGoal(null)} className={chip(!goal)}>
            All
          </button>
          {MENU_GOALS.map((g) => (
            <button key={g.id} type="button" aria-pressed={goal === g.id} onClick={() => setGoal(goal === g.id ? null : g.id)} className={chip(goal === g.id)}>
              {g.label}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-[var(--hm-line)]" aria-hidden />
          {TIMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={maxMinutes === t.id}
              onClick={() => setMaxMinutes(maxMinutes === t.id ? null : t.id)}
              className={chip(maxMinutes === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-[14px] text-[var(--hm-ink-2)]" aria-live="polite">
        {filtered ? `${shown.length} of ${recipes.length} recipes` : `${recipes.length} recipes this week`}
      </p>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-[28px] bg-[var(--hm-tint)] px-6 py-16 text-center">
          <p className="text-[17px] font-semibold">Nothing matches that yet</p>
          <p className="mt-1.5 text-[15px] text-[var(--hm-ink-2)]">Try another word, or clear the filters.</p>
          <button
            type="button"
            onClick={() => {
              setGoal(null);
              setMaxMinutes(null);
              setQuery("");
            }}
            className="mt-5 inline-flex h-11 items-center rounded-full bg-carbon px-5 text-[14px] font-semibold text-paper-white"
          >
            Show every recipe
          </button>
        </div>
      ) : filtered ? (
        <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r, i) => (
            <li key={r.slug}>
              <RecipeCard recipe={r} priority={i < 3} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-2">
            <div className="lg:row-span-2">
              <RecipeCard recipe={lead} priority large />
            </div>
            {rest.slice(0, 2).map((r) => (
              <RecipeCard key={r.slug} recipe={r} priority />
            ))}
          </div>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.slice(2).map((r) => (
              <li key={r.slug}>
                <RecipeCard recipe={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
