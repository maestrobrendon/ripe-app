import type { Permission } from "@/lib/admin/permissions";

/*
 * Every place in the admin, in sidebar order. `ready: false` marks modules
 * still being built (shown greyed with their phase, so the map of the admin
 * is visible from day one). Items are filtered by permission on the server
 * before they reach the browser.
 */

export type NavItem = { href: string; label: string; permission: Permission | null; group: string; ready: boolean; phase?: string };

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", permission: "dashboard.view", group: "Run the day", ready: true },
  { href: "/orders", label: "Orders", permission: "orders.view", group: "Run the day", ready: true },
  { href: "/fulfilment", label: "Fulfilment", permission: "fulfilment.view", group: "Run the day", ready: false, phase: "Phase 4" },
  { href: "/delivery", label: "Delivery", permission: "delivery.view", group: "Run the day", ready: false, phase: "Phase 4" },
  { href: "/inventory", label: "Inventory", permission: "inventory.view", group: "Stock and menu", ready: false, phase: "Phase 3" },
  { href: "/catalogue", label: "Products", permission: "catalogue.view", group: "Stock and menu", ready: false, phase: "Phase 3" },
  { href: "/recipes", label: "Recipes", permission: "recipes.view", group: "Stock and menu", ready: false, phase: "Phase 5" },
  { href: "/customers", label: "Customers", permission: "customers.view", group: "People", ready: true },
  { href: "/subscriptions", label: "Memberships", permission: "subscriptions.view", group: "People", ready: true },
  { href: "/zones", label: "Delivery areas", permission: "zones.view", group: "Settings", ready: false, phase: "Phase 4" },
  { href: "/settings", label: "Site settings", permission: "settings.view", group: "Settings", ready: false, phase: "Phase 5" },
  { href: "/insights", label: "Insights", permission: "insights.view", group: "Settings", ready: false, phase: "Phase 6" },
  { href: "/staff", label: "Staff", permission: "staff.view", group: "Security", ready: true },
  { href: "/audit", label: "Audit log", permission: "security.audit_view", group: "Security", ready: true },
  { href: "/security", label: "My security", permission: null, group: "Security", ready: true },
];
