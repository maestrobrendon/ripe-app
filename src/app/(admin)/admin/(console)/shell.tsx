"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signOutAction } from "../(auth)/actions";
import { AdminMark, Badge, cx } from "../_ui/kit";
import { Icon } from "../_ui/icons";
import type { NavItem } from "./nav";

/**
 * The admin frame: sidebar (collapsible on phones), top bar, ⌘K palette, and
 * an idle warning. The server already ends idle sessions; the warning just
 * means nobody loses a half-typed form to a silent timeout.
 */
export function Shell({ items, name, roleLabel, idleMs, children }: { items: NavItem[]; name: string; roleLabel: string; idleMs: number; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const groups = useMemo(() => [...new Set(items.map((i) => i.group))], [items]);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = (
    <nav aria-label="Admin" className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-carbon/40 uppercase">{g}</p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.group === g)
              .map((i) =>
                i.ready ? (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active(i.href) ? "page" : undefined}
                      className={cx(
                        "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                        active(i.href) ? "bg-mint-pop/90 font-semibold text-carbon shadow-[0_1px_0_rgb(0_0_0/0.04)]" : "text-carbon/65 hover:bg-[#f1f3ef] hover:text-carbon",
                      )}
                    >
                      <Icon name={i.icon} className="h-[18px] w-[18px] shrink-0" />
                      {i.label}
                    </Link>
                  </li>
                ) : (
                  <li key={i.href} className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] text-carbon/35" title={`Arrives in ${i.phase}`}>
                    <Icon name={i.icon} className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1">{i.label}</span>
                    <span className="text-[10px] font-semibold">{i.phase}</span>
                  </li>
                ),
              )}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-svh bg-[#f4f5f1] lg:grid lg:grid-cols-[256px_1fr] print:block print:bg-transparent">
      <aside className="hidden print:hidden! lg:block">
        <div className="sticky top-0 flex h-svh flex-col overflow-y-auto border-r border-black/5 bg-paper-white px-3.5 py-5">
          <AdminMark className="mb-8 px-2" />
          {nav}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex print:hidden h-16 items-center gap-3 border-b border-black/5 bg-[#f4f5f1]/85 px-4 backdrop-blur sm:px-8">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-soft-mist/70 lg:hidden" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
            </svg>
          </button>
          <AdminMark className="lg:hidden" />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-10 w-full max-w-sm items-center gap-2.5 rounded-full bg-paper-white px-4 text-[13px] text-carbon/45 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] hover:text-carbon/70 sm:flex"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.2 13.2 3.3 3.3" />
            </svg>
            <span className="flex-1 text-left">Jump to a page…</span>
            <kbd className="rounded-md bg-[#f1f3ef] px-1.5 py-0.5 text-[11px] font-semibold text-carbon/55">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lavender text-[13px] font-semibold text-carbon" aria-hidden>
              {name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="hidden sm:block">
              <p className="text-[13px] leading-tight font-semibold">{name}</p>
              <p className="text-[12px] leading-tight text-carbon/55">{roleLabel}</p>
            </div>
            <form action={signOutAction}>
              <button type="submit" className="h-10 rounded-full bg-paper-white px-4 text-[13px] font-semibold text-carbon/70 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] hover:text-carbon">
                Sign out
              </button>
            </form>
          </div>
        </header>

        {menuOpen && <div className="border-b border-black/5 bg-paper-white px-3 py-4 lg:hidden">{nav}</div>}

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8 print:max-w-none print:p-0">{children}</main>
      </div>

      {paletteOpen && <Palette items={items.filter((i) => i.ready)} onClose={() => setPaletteOpen(false)} />}
      <IdleWarning idleMs={idleMs} />
    </div>
  );
}

function Palette({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const list = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-50 bg-carbon/30 px-4 pt-[15vh]" onClick={onClose}>
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl bg-paper-white shadow-2xl" role="dialog" aria-label="Jump to" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") setIndex((i) => Math.min(i + 1, list.length - 1));
            if (e.key === "ArrowUp") setIndex((i) => Math.max(i - 1, 0));
            if (e.key === "Enter" && list[index]) go(list[index].href);
          }}
          placeholder="Go to a page…"
          className="h-12 w-full border-b border-black/6 px-4 text-[15px] outline-none"
        />
        <ul className="max-h-72 overflow-y-auto p-2">
          {list.map((i, n) => (
            <li key={i.href}>
              <button
                type="button"
                onClick={() => go(i.href)}
                className={cx("flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[14px]", n === index && "bg-soft-mist/70")}
              >
                {i.label}
                <Badge>{i.group}</Badge>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-4 text-[13px] text-carbon/50">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}

/** Two minutes before the server's idle limit, say so; past it, go to sign-in. */
function IdleWarning({ idleMs }: { idleMs: number }) {
  const last = useRef(0);
  const [warn, setWarn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    last.current = Date.now();
    const bump = () => {
      last.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    let lastPing = Date.now();
    const t = window.setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle > idleMs) return router.replace("/login");
      setWarn(idle > idleMs - 2 * 60 * 1000);
      // Typing in a long form makes no requests, so the server would see an
      // idle session. While someone is genuinely active, check in every five
      // minutes; that request is what keeps the server-side session alive.
      if (idle < 60_000 && Date.now() - lastPing > 5 * 60_000) {
        lastPing = Date.now();
        router.refresh();
      }
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(t);
    };
  }, [idleMs, router]);

  if (!warn) return null;
  return (
    <div role="alert" className="fixed right-4 bottom-4 z-50 max-w-xs rounded-xl bg-carbon px-4 py-3 text-[13px] text-paper-white shadow-xl">
      You&apos;ll be signed out soon for inactivity.{" "}
      <button type="button" className="font-semibold text-mint-pop underline" onClick={() => router.refresh()}>
        Stay signed in
      </button>
    </div>
  );
}
