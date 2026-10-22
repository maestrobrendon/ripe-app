import { describe, expect, it } from "vitest";
import { assignableRoles, can, PERMISSIONS, ROLE_PERMISSIONS, ROLES, STEP_UP } from "./permissions";

describe("permission matrix", () => {
  it("gives the Owner everything", () => {
    for (const p of PERMISSIONS) expect(can("OWNER", p)).toBe(true);
  });

  it("only uses known permissions", () => {
    const known = new Set<string>(PERMISSIONS);
    for (const r of ROLES) for (const p of ROLE_PERMISSIONS[r]) expect(known.has(p)).toBe(true);
    for (const p of STEP_UP) expect(known.has(p)).toBe(true);
  });

  it("keeps the most sensitive powers with the Owner", () => {
    for (const r of ROLES.filter((x) => x !== "OWNER")) {
      expect(can(r, "staff.manage_roles")).toBe(false);
      expect(can(r, "security.settings")).toBe(false);
      expect(can(r, "customers.erase")).toBe(false);
    }
  });

  it("never lets a role grant more than it holds (no escalation)", () => {
    for (const actor of ROLES) {
      for (const target of assignableRoles(actor)) {
        for (const p of ROLE_PERMISSIONS[target]) expect(can(actor, p)).toBe(true);
      }
    }
  });

  it("lets only an Owner create Owners or Admins", () => {
    expect(assignableRoles("OWNER")).toContain("OWNER");
    expect(assignableRoles("OWNER")).toContain("ADMIN");
    for (const actor of ROLES.filter((x) => x !== "OWNER")) {
      expect(assignableRoles(actor)).not.toContain("OWNER");
      expect(assignableRoles(actor)).not.toContain("ADMIN");
    }
  });

  it("gives roles without staff powers nothing to assign", () => {
    for (const r of ["FULFILMENT", "DISPATCH", "ANALYST", "CONTENT_EDITOR", "CUSTOMER_SUPPORT", "FINANCE", "INVENTORY", "OPERATIONS_MANAGER"] as const) {
      expect(assignableRoles(r)).toEqual([]);
    }
  });

  it("keeps analysts away from personal data and changes", () => {
    for (const p of ROLE_PERMISSIONS.ANALYST) expect(p.endsWith(".view")).toBe(true);
    expect(can("ANALYST", "customers.view")).toBe(false);
    expect(can("ANALYST", "orders.view")).toBe(false);
  });

  it("keeps prices away from content editors and fulfilment", () => {
    expect(can("CONTENT_EDITOR", "catalogue.price")).toBe(false);
    expect(can("FULFILMENT", "orders.cancel")).toBe(false);
    expect(can("DISPATCH", "inventory.adjust")).toBe(false);
  });
});
