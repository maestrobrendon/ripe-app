/*
 * Who may do what in the admin. One typed matrix, enforced on the server by
 * requireStaff(permission); the UI only uses it to hide what you can't use.
 *
 * Kept free of server-only imports so client navigation can read it too.
 * Role names mirror the StaffRole enum in prisma/schema.prisma.
 */

export const ROLES = [
  "OWNER",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "INVENTORY",
  "FULFILMENT",
  "DISPATCH",
  "CONTENT_EDITOR",
  "CUSTOMER_SUPPORT",
  "FINANCE",
  "ANALYST",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  OPERATIONS_MANAGER: "Operations manager",
  INVENTORY: "Inventory",
  FULFILMENT: "Fulfilment",
  DISPATCH: "Dispatch",
  CONTENT_EDITOR: "Content editor",
  CUSTOMER_SUPPORT: "Customer support",
  FINANCE: "Finance",
  ANALYST: "Analyst",
};

export const PERMISSIONS = [
  "dashboard.view",
  // Orders
  "orders.view",
  "orders.update_status",
  "orders.cancel",
  "orders.refund",
  "orders.notes",
  "orders.export",
  // Fulfilment and delivery
  "fulfilment.view",
  "fulfilment.pack",
  "delivery.view",
  "delivery.manage_runs",
  "delivery.update_status",
  "riders.manage",
  // Stock
  "inventory.view",
  "inventory.adjust",
  "inventory.receive",
  "inventory.import",
  "suppliers.manage",
  // Catalogue and content
  "catalogue.view",
  "catalogue.edit",
  "catalogue.availability",
  "catalogue.price",
  "catalogue.publish",
  "recipes.view",
  "recipes.edit",
  "recipes.publish",
  "content.manage",
  // Customers and money
  "customers.view",
  "customers.reveal_pii",
  "customers.notes",
  "customers.manage",
  "customers.plan",
  "customers.export",
  "customers.erase",
  "subscriptions.view",
  "subscriptions.manage",
  // Operations settings
  "zones.view",
  "zones.manage",
  "settings.view",
  "settings.manage",
  // Insight
  "insights.view",
  "insights.kachi_review",
  "reports.view",
  "reports.export",
  // Staff and security
  "staff.view",
  "staff.invite",
  "staff.manage_roles",
  "staff.suspend",
  "security.audit_view",
  "security.sessions_manage",
  "security.settings",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissions that need a fresh second factor (within STEP_UP_SECONDS) on top
 * of a valid session: anything that moves money, exposes or removes personal
 * data in bulk, or changes who can do what.
 */
export const STEP_UP: ReadonlySet<Permission> = new Set<Permission>([
  "orders.refund",
  "orders.export",
  "inventory.import",
  "catalogue.price",
  "customers.reveal_pii",
  "customers.plan",
  "customers.export",
  "customers.erase",
  "subscriptions.manage",
  "settings.manage",
  "reports.export",
  "staff.invite",
  "staff.manage_roles",
  "staff.suspend",
  "security.sessions_manage",
  "security.settings",
]);
export const STEP_UP_SECONDS = 10 * 60;

const ALL = new Set<Permission>(PERMISSIONS);
const without = (...ps: Permission[]) => new Set([...ALL].filter((p) => !ps.includes(p)));

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: ALL,
  ADMIN: without("staff.manage_roles", "security.settings", "security.audit_view", "customers.erase"),
  OPERATIONS_MANAGER: new Set<Permission>([
    "dashboard.view",
    "orders.view", "orders.update_status", "orders.cancel", "orders.notes",
    "fulfilment.view", "fulfilment.pack",
    "delivery.view", "delivery.manage_runs", "delivery.update_status", "riders.manage",
    "inventory.view", "inventory.adjust", "inventory.receive", "suppliers.manage",
    "catalogue.view", "catalogue.availability",
    "customers.view",
    "zones.view", "zones.manage",
    "insights.view", "reports.view",
  ]),
  INVENTORY: new Set<Permission>([
    "dashboard.view",
    "inventory.view", "inventory.adjust", "inventory.receive", "inventory.import", "suppliers.manage",
    "catalogue.view", "catalogue.availability",
    "fulfilment.view", "orders.view",
  ]),
  FULFILMENT: new Set<Permission>(["dashboard.view", "fulfilment.view", "fulfilment.pack", "orders.view", "inventory.view"]),
  DISPATCH: new Set<Permission>(["dashboard.view", "delivery.view", "delivery.manage_runs", "delivery.update_status", "riders.manage", "orders.view"]),
  CONTENT_EDITOR: new Set<Permission>([
    "dashboard.view",
    "catalogue.view", "catalogue.edit", "catalogue.availability", "catalogue.publish",
    "recipes.view", "recipes.edit", "recipes.publish",
    "content.manage", "settings.view",
  ]),
  CUSTOMER_SUPPORT: new Set<Permission>([
    "dashboard.view",
    "customers.view", "customers.reveal_pii", "customers.notes", "customers.manage",
    "orders.view", "orders.notes",
    "subscriptions.view", "catalogue.view", "recipes.view",
  ]),
  FINANCE: new Set<Permission>([
    "dashboard.view",
    "orders.view", "orders.refund", "orders.export",
    "customers.view", "customers.plan",
    "subscriptions.view", "subscriptions.manage",
    "reports.view", "reports.export", "insights.view",
  ]),
  ANALYST: new Set<Permission>(["dashboard.view", "reports.view", "insights.view"]),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/**
 * Which roles `actor` may hand out (invite as, or change someone to). Never a
 * role with a permission the actor lacks, Owner and Admin only by an Owner,
 * and nobody without staff.invite / staff.manage_roles gets to grant at all.
 */
export function assignableRoles(actor: Role): Role[] {
  if (!can(actor, "staff.invite") && !can(actor, "staff.manage_roles")) return [];
  return ROLES.filter((r) => {
    if ((r === "OWNER" || r === "ADMIN") && actor !== "OWNER") return false;
    return [...ROLE_PERMISSIONS[r]].every((p) => can(actor, p));
  });
}
