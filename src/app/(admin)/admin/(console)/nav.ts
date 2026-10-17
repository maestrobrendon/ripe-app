import type { Permission } from "@/lib/admin/permissions";
import type { IconName } from "../_ui/icons";

/*
 * Every place in the admin, in sidebar order. `ready: false` marks modules
 * still being built (shown greyed with their phase, so the map of the admin
 * is visible from day one). Items are filtered by permission on the server
 * before they reach the browser.
 */

export type NavItem = { href: string; label: string; icon: IconName; permission: Permission | null; group: string; ready: boolean; phase?: string };

export const NAV: NavItem[] = [
  { href: "/", icon: "home", label: "Overview", permission: "dashboard.view", group: "Run the day", ready: true },
  { href: "/orders", icon: "orders", label: "Orders", permission: "orders.view", group: "Run the day", ready: true },
  { href: "/fulfilment", icon: "box", label: "Fulfilment", permission: "fulfilment.view", group: "Run the day", ready: true },
  { href: "/delivery", icon: "truck", label: "Delivery", permission: "delivery.view", group: "Run the day", ready: true },
  { href: "/inventory", icon: "stock", label: "Inventory", permission: "inventory.view", group: "Stock and menu", ready: true },
  { href: "/catalogue", icon: "tag", label: "Products", permission: "catalogue.view", group: "Stock and menu", ready: true },
  { href: "/recipes", icon: "book", label: "Recipes", permission: "recipes.view", group: "Stock and menu", ready: true },
  { href: "/customers", icon: "users", label: "Customers", permission: "customers.view", group: "People", ready: true },
  { href: "/subscriptions", icon: "badge", label: "Memberships", permission: "subscriptions.view", group: "People", ready: true },
  { href: "/zones", icon: "map", label: "Delivery areas", permission: "zones.view", group: "Settings", ready: true },
  { href: "/settings", icon: "settings", label: "Site settings", permission: "settings.view", group: "Settings", ready: true },
  { href: "/insights", icon: "chart", label: "Insights", permission: "insights.view", group: "Settings", ready: true },
  { href: "/staff", icon: "shield", label: "Staff", permission: "staff.view", group: "Security", ready: true },
  { href: "/audit", icon: "log", label: "Audit log", permission: "security.audit_view", group: "Security", ready: true },
  { href: "/security", icon: "lock", label: "My security", permission: null, group: "Security", ready: true },
];
