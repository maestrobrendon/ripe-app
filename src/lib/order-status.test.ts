import { describe, expect, it } from "vitest";
import { can, ROLES, type Permission } from "@/lib/admin/permissions";
import { canTransition, customerStatusLabel, customerStep, nextStatuses, ORDER_STATUSES, transitionPermissions } from "./order-status";

const roleCan = (role: (typeof ROLES)[number]) => (p: Permission) => can(role, p);

describe("order lifecycle", () => {
  it("follows the happy path one step at a time", () => {
    const path = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(nextStatuses(path[i])).toContain(path[i + 1]);
  });

  it("never skips steps or goes back from delivered", () => {
    expect(transitionPermissions("RECEIVED", "DELIVERED")).toBeNull();
    expect(transitionPermissions("CONFIRMED", "OUT_FOR_DELIVERY")).toBeNull();
    expect(nextStatuses("DELIVERED")).toEqual([]);
    expect(nextStatuses("CANCELLED")).toEqual([]);
    expect(nextStatuses("REFUNDED")).toEqual([]);
  });

  it("can't cancel once the van has left", () => {
    expect(transitionPermissions("OUT_FOR_DELIVERY", "CANCELLED")).toBeNull();
  });

  it("never reaches REFUNDED as a plain status change", () => {
    for (const from of ORDER_STATUSES) expect(nextStatuses(from)).not.toContain("REFUNDED");
  });

  it("lets each role make only its own moves", () => {
    expect(canTransition("PICKING", "PACKED", roleCan("FULFILMENT"))).toBe(true);
    expect(canTransition("PACKED", "OUT_FOR_DELIVERY", roleCan("FULFILMENT"))).toBe(false);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED", roleCan("DISPATCH"))).toBe(true);
    expect(canTransition("RECEIVED", "CONFIRMED", roleCan("DISPATCH"))).toBe(false);
    expect(canTransition("RECEIVED", "CANCELLED", roleCan("FULFILMENT"))).toBe(false);
    expect(canTransition("RECEIVED", "CANCELLED", roleCan("OPERATIONS_MANAGER"))).toBe(true);
    for (const from of ORDER_STATUSES) for (const to of ORDER_STATUSES) {
      expect(canTransition(from, to, roleCan("ANALYST"))).toBe(false);
      expect(canTransition(from, to, roleCan("CONTENT_EDITOR"))).toBe(false);
    }
  });

  it("folds staff steps into the customer's four", () => {
    expect(customerStep("CONFIRMED")).toBe(0);
    expect(customerStep("PACKED")).toBe(1);
    expect(customerStep("DELIVERED")).toBe(3);
    expect(customerStep("CANCELLED")).toBeNull();
    expect(customerStatusLabel("PICKING")).toBe("Being packed");
    expect(customerStatusLabel("FAILED_DELIVERY")).toBe("Delivery missed");
  });
});
