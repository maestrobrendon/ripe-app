"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { useAdminAction } from "../step-up";
import { Alert, Badge, Button, Card, Field, Input } from "../../_ui/kit";
import { saveZone, setDaysForAllAreas } from "../delivery/actions";

type Zone = {
  id: string;
  name: string;
  area: string;
  isServed: boolean;
  deliveryDays: DeliveryDay[];
  deliveryFee: number;
  cutoffHour: number;
  sortOrder: number;
  customers: number;
  orders: number;
};
// Any day of the week; the customer site follows whatever is ticked here.
const DAYS: DeliveryDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const dayShort = (d: DeliveryDay) => d.charAt(0) + d.slice(1, 3).toLowerCase();
const hourLabel = (h: number) => (h === 0 ? "midnight" : h === 12 ? "noon" : h < 12 ? `${h}am` : `${h - 12}pm`);

export function ZonesView({ canManage, zones, waitlist }: { canManage: boolean; zones: Zone[]; waitlist: { area: string; count: number }[] }) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Zone | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {canManage && (
          <Card title="Delivery days for every area">
            <p className="-mt-2 mb-3 text-[12px] text-carbon/55">
              Sets the same days on every area you deliver to. Sign-up, Home and checkout follow at once. Customers on a day you drop move to the area&apos;s first day.
            </p>
            <form
              className="flex flex-wrap items-center gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const deliveryDays = DAYS.filter((d) => f.get(`all-${d}`) === "on");
                start(async () => {
                  setNotice(null);
                  const r = await run(() => setDaysForAllAreas({ deliveryDays }));
                  if (r.ok) {
                    setNotice({ tone: "success", text: "Every area now delivers on those days." });
                    router.refresh();
                  } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
                });
              }}
            >
              {DAYS.map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-[13px]">
                  <input type="checkbox" name={`all-${d}`} defaultChecked={zones.filter((z) => z.isServed).every((z) => z.deliveryDays.includes(d))} /> {dayShort(d)}
                </label>
              ))}
              <Button size="sm" disabled={pending}>
                Apply to every area
              </Button>
            </form>
          </Card>
        )}
        <Card className="p-0! overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Area</th>
                  <th className="px-3 py-2.5 font-semibold">Days</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Fee</th>
                  <th className="px-3 py-2.5 font-semibold">Orders close</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Customers</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td className="px-5 py-2.5">
                      <p className="font-semibold">
                        {z.name} {!z.isServed && <Badge>Not yet</Badge>}
                      </p>
                      <p className="max-w-64 truncate text-carbon/50">{z.area}</p>
                    </td>
                    <td className="px-3 py-2.5">{z.deliveryDays.map(dayShort).join(", ") || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">₦{z.deliveryFee.toLocaleString("en-NG")}</td>
                    <td className="px-3 py-2.5">{hourLabel(z.cutoffHour)} the day before</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{z.customers}</td>
                    <td className="px-5 py-2.5 text-right">
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(z)}>
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        {editing && (
          <Card title={`Edit ${editing.name}`}>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                start(async () => {
                  setNotice(null);
                  const r = await run(() =>
                    saveZone({
                      id: editing.id,
                      name: String(f.get("name") ?? ""),
                      area: String(f.get("area") ?? ""),
                      isServed: f.get("isServed") === "on",
                      deliveryDays: DAYS.filter((d) => f.get(`day-${d}`) === "on"),
                      deliveryFee: Math.round(Number(f.get("fee"))),
                      cutoffHour: Math.round(Number(f.get("cutoff"))),
                      sortOrder: Math.round(Number(f.get("sortOrder"))),
                    }),
                  );
                  if (r.ok) {
                    setNotice({ tone: "success", text: `${editing.name} saved. Checkout uses it now.` });
                    setEditing(null);
                    router.refresh();
                  } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
                });
              }}
            >
              <Field label="Name" htmlFor="z-name">
                <Input id="z-name" name="name" required maxLength={60} defaultValue={editing.name} />
              </Field>
              <Field label="Neighbourhoods covered" htmlFor="z-area">
                <Input id="z-area" name="area" required maxLength={200} defaultValue={editing.area} />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-carbon/80">Delivery days</legend>
                <div className="flex gap-3">
                  {DAYS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-[13px]">
                      <input type="checkbox" name={`day-${d}`} defaultChecked={editing.deliveryDays.includes(d)} /> {dayShort(d)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Delivery fee (₦)" htmlFor="z-fee">
                  <Input id="z-fee" name="fee" type="number" min={0} max={100000} required defaultValue={editing.deliveryFee} />
                </Field>
                <Field label="Orders close at (hour)" htmlFor="z-cutoff" hint="0 to 23, the day before">
                  <Input id="z-cutoff" name="cutoff" type="number" min={0} max={23} required defaultValue={editing.cutoffHour} />
                </Field>
              </div>
              <Field label="Position in lists" htmlFor="z-sort">
                <Input id="z-sort" name="sortOrder" type="number" min={0} max={1000} defaultValue={editing.sortOrder} />
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="isServed" defaultChecked={editing.isServed} /> We deliver here now
              </label>
              <div className="flex gap-2">
                <Button size="sm" disabled={pending}>
                  Save area
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card title="Asked for, not served yet">
          {waitlist.length === 0 ? (
            <p className="text-[13px] text-carbon/50">No waitlist requests yet.</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {waitlist.map((w) => (
                <li key={w.area} className="flex justify-between">
                  <span>{w.area}</span>
                  <b className="tabular-nums">{w.count}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
