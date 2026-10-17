import type { ReactNode } from "react";

/*
 * Line icons for the admin (20px grid, 1.7 stroke, currentColor). Inline SVG,
 * so they need no font, no request and nothing from outside the admin CSP.
 */

export type IconName =
  | "home"
  | "orders"
  | "box"
  | "truck"
  | "stock"
  | "tag"
  | "book"
  | "users"
  | "badge"
  | "map"
  | "settings"
  | "chart"
  | "shield"
  | "log"
  | "lock"
  | "cash"
  | "cart"
  | "spark"
  | "alert"
  | "calendar"
  | "plus"
  | "arrow"
  | "chat"
  | "leaf";

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M3.5 9.2 10 4l6.5 5.2V16a1 1 0 0 1-1 1h-3.3v-4.5H7.8V17H4.5a1 1 0 0 1-1-1V9.2Z" />,
  orders: (
    <>
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7 7h6M7 10h6M7 13h3.5" />
    </>
  ),
  box: (
    <>
      <path d="m10 2.8 6.5 3.4v7.6L10 17.2l-6.5-3.4V6.2L10 2.8Z" />
      <path d="M3.8 6.4 10 9.6l6.2-3.2M10 9.6v7.4" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 5.5h9v8h-9zM11.5 8.5h3.2l2.8 3v2h-6" />
      <circle cx="6" cy="14.5" r="1.6" />
      <circle cx="14.5" cy="14.5" r="1.6" />
    </>
  ),
  stock: (
    <>
      <path d="M3 16.5h14" />
      <rect x="4" y="9.5" width="3" height="7" rx="0.8" />
      <rect x="8.5" y="5.5" width="3" height="11" rx="0.8" />
      <rect x="13" y="11.5" width="3" height="5" rx="0.8" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 4.5v5l7 7a1.4 1.4 0 0 0 2 0l3.5-3.5a1.4 1.4 0 0 0 0-2l-7-7h-5a.5.5 0 0 0-.5.5Z" />
      <circle cx="7" cy="7" r="1.1" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v11.5H5.5A1.5 1.5 0 0 0 4 16V4.5Z" />
      <path d="M4 16a1.5 1.5 0 0 0 1.5 1.5H16v-3M8 7h5" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="7" r="2.8" />
      <path d="M2.5 16.5c.5-2.8 2.5-4.3 5-4.3s4.5 1.5 5 4.3" />
      <path d="M13 4.6a2.6 2.6 0 0 1 0 5M14.5 12.4c1.6.5 2.7 1.9 3 4.1" />
    </>
  ),
  badge: (
    <>
      <circle cx="10" cy="8" r="4.5" />
      <path d="m7.3 11.6-1.1 5.2L10 15l3.8 1.8-1.1-5.2" />
    </>
  ),
  map: (
    <>
      <path d="M10 17s5.5-4.6 5.5-9a5.5 5.5 0 0 0-11 0c0 4.4 5.5 9 5.5 9Z" />
      <circle cx="10" cy="8" r="2" />
    </>
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 2.8v2M10 15.2v2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M2.8 10h2M15.2 10h2M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" />
    </>
  ),
  chart: (
    <>
      <path d="M3 16.5h14M4 13l3.8-4 3 2.6L16 5.5" />
      <path d="M12.5 5.5H16V9" />
    </>
  ),
  shield: <path d="M10 2.8 16 5v4.6c0 3.6-2.5 6.3-6 7.6-3.5-1.3-6-4-6-7.6V5l6-2.2Z" />,
  log: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.2l2.8 1.8" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="8.5" width="12" height="8.5" rx="2" />
      <path d="M6.8 8.5V6.3a3.2 3.2 0 0 1 6.4 0v2.2" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="5" width="15" height="10" rx="2" />
      <circle cx="10" cy="10" r="2.2" />
      <path d="M5.5 8v4M14.5 8v4" />
    </>
  ),
  cart: (
    <>
      <path d="M2.5 3.5h2l1.8 9h9l1.7-6.5H5.4" />
      <circle cx="7.5" cy="16" r="1.2" />
      <circle cx="14" cy="16" r="1.2" />
    </>
  ),
  spark: <path d="M10 2.5c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z" />,
  alert: (
    <>
      <path d="M10 3.2 17.5 16.5h-15L10 3.2Z" />
      <path d="M10 8.2v3.6M10 14v.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" />
    </>
  ),
  plus: <path d="M10 4v12M4 10h12" />,
  arrow: <path d="M6 14 14 6M7.5 6H14v6.5" />,
  chat: <path d="M4 4.5h12a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9l-3.8 3v-3H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />,
  leaf: (
    <>
      <path d="M4 16c0-7 4-11 12-12-.3 8-4.3 12-11 12" />
      <path d="M4 16c2.5-3.5 5-5.6 8-7" />
    </>
  ),
};

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
