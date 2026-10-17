"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/guard";
import type { Availability } from "@/generated/prisma/enums";
import { ProductImage } from "@/components/product-image";
import { useAdminAction } from "../step-up";
import { Alert, Button, Card, Field, Input, cx } from "../../_ui/kit";
import { createProduct, saveProductDetails, setAvailability, setPrices, setProductImage, signProductUpload } from "./actions";
import type { DetailsDraft } from "./details";
import { AVAILABILITY_HINT, AVAILABILITY_LABEL, CATEGORY_LABEL } from "./labels";

type Notice = { tone: "error" | "success"; text: string } | null;
const selectClass = "h-11 w-full rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]";
const areaClass = "w-full rounded-xl bg-paper-white p-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]";

function useRun() {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const go = <T,>(fn: () => Promise<ActionResult<T>>, ok: string, then?: (d: T) => void) =>
    start(async () => {
      setNotice(null);
      const r = await run(fn);
      if (r.ok) {
        setNotice({ tone: "success", text: ok });
        then?.(r.data);
        router.refresh();
      } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
    });
  const banner = notice && (
    <div className="mt-3">
      <Alert tone={notice.tone}>{notice.text}</Alert>
    </div>
  );
  return { go, pending, banner, setNotice };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const num = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

/* --------------------------------- details -------------------------------- */

export function DetailsForm(props: {
  mode: "create" | "edit";
  id?: string;
  version?: number;
  initial: DetailsDraft;
  options: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const { go, pending, banner } = useRun();
  const router = useRouter();
  const [d, setD] = useState<DetailsDraft>(props.initial);
  const [prices, setPricesDraft] = useState({ standard: "", member: "" });
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");
  const set = <K extends keyof DetailsDraft>(k: K, v: DetailsDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const ro = !props.canEdit;

  const submit = () => {
    if (props.mode === "create") {
      go(
        () => createProduct({ details: d, standardPrice: Number(prices.standard), memberPrice: Number(prices.member) }),
        "Product created. It's hidden until you put it on sale.",
        (r) => router.push(`/catalogue/${r.id}`),
      );
    } else {
      go(() => saveProductDetails({ id: props.id!, version: props.version!, details: d }), "Saved.");
    }
  };

  const text = (k: keyof DetailsDraft, label: string, hint?: string, long = false, max = 2000) => (
    <Field label={label} htmlFor={`f-${k}`} hint={hint}>
      {long ? (
        <textarea id={`f-${k}`} rows={3} maxLength={max} disabled={ro} className={areaClass} value={(d[k] as string | null) ?? ""} onChange={(e) => set(k, (e.target.value || null) as never)} />
      ) : (
        <Input id={`f-${k}`} maxLength={max} disabled={ro} value={(d[k] as string | null) ?? ""} onChange={(e) => set(k, e.target.value as never)} />
      )}
    </Field>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="f-name">
            <Input
              id="f-name"
              required
              maxLength={80}
              disabled={ro}
              value={d.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Web address" htmlFor="f-slug" hint={`/products/${d.slug || "…"}`}>
            <Input
              id="f-slug"
              required
              maxLength={80}
              disabled={ro}
              value={d.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
            />
          </Field>
          <Field label="Category" htmlFor="f-category">
            <select id="f-category" className={selectClass} disabled={ro} value={d.category} onChange={(e) => set("category", e.target.value as DetailsDraft["category"])}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price label" htmlFor="f-unit" hint={'Shown after the price, e.g. "per pineapple", "per 500g"'}>
            <Input id="f-unit" required maxLength={40} disabled={ro} value={d.unit} onChange={(e) => set("unit", e.target.value)} />
          </Field>
          <Field label="Sold as" htmlFor="f-soldAs">
            <select
              id="f-soldAs"
              className={selectClass}
              disabled={ro}
              value={d.soldAs}
              onChange={(e) => {
                const v = e.target.value as DetailsDraft["soldAs"];
                setD((x) => ({ ...x, soldAs: v, orderUnit: v === "WEIGHT" ? "WEIGHT" : x.orderUnit === "WEIGHT" ? "PIECE" : x.orderUnit }));
              }}
            >
              <option value="SINGLE">Single items</option>
              <option value="SET">Sets (e.g. a pair)</option>
              <option value="WEIGHT">By weight</option>
            </select>
          </Field>
          {d.soldAs === "SET" && (
            <Field label="Items in a set" htmlFor="f-setSize">
              <Input id="f-setSize" type="number" min={2} max={100} disabled={ro} value={d.setSize ?? ""} onChange={(e) => set("setSize", num(e.target.value))} />
            </Field>
          )}
          {d.soldAs === "WEIGHT" && (
            <Field label="Price is for (grams)" htmlFor="f-ref" hint="e.g. 500 if the price is per 500g">
              <Input id="f-ref" type="number" min={1} max={50000} disabled={ro} value={d.referenceWeightG ?? ""} onChange={(e) => set("referenceWeightG", num(e.target.value))} />
            </Field>
          )}
          <Field label={`Smallest order${d.soldAs === "WEIGHT" ? " (grams)" : ""}`} htmlFor="f-min">
            <Input id="f-min" type="number" min={1} disabled={ro} value={d.minOrderQty} onChange={(e) => set("minOrderQty", num(e.target.value) ?? 1)} />
          </Field>
          <Field label={`Steps of${d.soldAs === "WEIGHT" ? " (grams)" : ""}`} htmlFor="f-step">
            <Input id="f-step" type="number" min={1} disabled={ro} value={d.stepQty} onChange={(e) => set("stepQty", num(e.target.value) ?? 1)} />
          </Field>
          <Field label="Emoji (shown when there's no photo)" htmlFor="f-emoji">
            <Input id="f-emoji" maxLength={8} disabled={ro} value={d.imageEmoji} onChange={(e) => set("imageEmoji", e.target.value)} />
          </Field>
          <Field label="Colour (for the rainbow filters)" htmlFor="f-color">
            <select id="f-color" className={selectClass} disabled={ro} value={d.color ?? ""} onChange={(e) => set("color", (e.target.value || null) as DetailsDraft["color"])}>
              <option value="">None</option>
              {["RED", "ORANGE", "YELLOW", "GREEN", "PURPLE", "WHITE_BROWN"].map((c) => (
                <option key={c} value={c}>
                  {c === "WHITE_BROWN" ? "White or brown" : c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          {text("source", "Source (internal)", "Where it usually comes from. Not shown in the main pitch.", false, 80)}
          <Field label="Tags" htmlFor="f-tags" hint="Comma separated, e.g. smoothie, high-fibre">
            <Input
              id="f-tags"
              disabled={ro}
              defaultValue={d.tags.join(", ")}
              onBlur={(e) =>
                set(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
                    .filter(Boolean),
                )
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-[14px] sm:col-span-2">
            <input type="checkbox" disabled={ro} checked={d.featured} onChange={(e) => set("featured", e.target.checked)} />
            Featured (shown in picks and seasonal rows)
          </label>
        </div>
      </Card>

      {props.mode === "create" && (
        <Card title="Prices">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Standard price (₦)" htmlFor="f-std">
              <Input id="f-std" type="number" min={1} required value={prices.standard} onChange={(e) => setPricesDraft((p) => ({ ...p, standard: e.target.value }))} />
            </Field>
            <Field label="Member price (₦)" htmlFor="f-mem">
              <Input id="f-mem" type="number" min={1} required value={prices.member} onChange={(e) => setPricesDraft((p) => ({ ...p, member: e.target.value }))} />
            </Field>
          </div>
        </Card>
      )}

      <Card title="Shop copy">
        <div className="space-y-4">
          {text("description", "One-line summary", "Under the buy box. Facts, not adjectives.", false, 300)}
          {text("blurb", "Short paragraph", undefined, true, 1200)}
          {text("sourcingLine", "Quality line", "One line about how it's chosen. No farm or state names.", false, 200)}
          {text("educationCopy", "Why you'll love it", undefined, true)}
          {text("benefitsCopy", "What it's good for", "Food, not medical claims.", true)}
          {text("howToEnjoyCopy", "How to enjoy it", undefined, true)}
          {text("storageTips", "Storage", undefined, true)}
        </div>
      </Card>

      <Card title="Complete your basket">
        <p className="mb-2 text-[12px] text-carbon/55">Up to 12 products suggested alongside this one. Leave empty to suggest others from the same category. Hold Ctrl (or ⌘) to pick several.</p>
        <select
          multiple
          size={8}
          aria-label="Related products"
          disabled={ro}
          className={cx(areaClass, "h-auto")}
          value={d.relatedProductIds}
          onChange={(e) => set("relatedProductIds", [...e.target.selectedOptions].map((o) => o.value).slice(0, 12))}
        >
          {props.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Card>

      {props.canEdit && (
        <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl bg-paper-white/95 p-3 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur">
          <Button type="submit" disabled={pending}>
            {props.mode === "create" ? "Create product" : "Save changes"}
          </Button>
          <div className="flex-1">{banner}</div>
        </div>
      )}
    </form>
  );
}

/* ---------------------------------- photo --------------------------------- */

export function PhotoCard({ id, publicId, emoji, name, canEdit }: { id: string; publicId: string | null; emoji: string; name: string; canEdit: boolean }) {
  const { go, pending, banner, setNotice } = useRun();
  const run = useAdminAction();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setNotice(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setNotice({ tone: "error", text: "Use a JPG, PNG or WebP photo." });
    if (file.size > 8 * 1024 * 1024) return setNotice({ tone: "error", text: "That photo is over 8 MB. Export a smaller one." });
    setUploading(true);
    try {
      const signed = await run(() => signProductUpload(id));
      if (!signed.ok) {
        if (signed.code !== "AUTH" && signed.code !== "STEP_UP") setNotice({ tone: "error", text: signed.error });
        return;
      }
      const body = new FormData();
      for (const [k, v] of Object.entries(signed.data.fields)) body.append(k, v);
      body.append("file", file);
      const res = await fetch(signed.data.url, { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { public_id?: string; error?: { message?: string } } | null;
      if (!res.ok || !json?.public_id) return setNotice({ tone: "error", text: json?.error?.message ?? "The upload didn't go through. Try again." });
      const saved = await run(() => setProductImage({ id, publicId: json.public_id! }));
      if (saved.ok) {
        setNotice({ tone: "success", text: "Photo updated." });
        router.refresh();
      } else if (saved.code !== "AUTH" && saved.code !== "STEP_UP") setNotice({ tone: "error", text: saved.error });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card title="Photo">
      <ProductImage publicId={publicId} alt={name} emoji={emoji} className="aspect-square w-full" rounded="rounded-xl" emojiClassName="text-7xl" sizes="320px" />
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className={cx("inline-flex h-9 cursor-pointer items-center rounded-xl px-3 text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] hover:bg-soft-mist/60", (uploading || pending) && "pointer-events-none opacity-50")}>
            {uploading ? "Uploading…" : publicId ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
          </label>
          {publicId && (
            <Button size="sm" variant="ghost" disabled={pending || uploading} onClick={() => go(() => setProductImage({ id, publicId: null }), "Photo removed. The emoji shows instead.")}>
              Remove
            </Button>
          )}
        </div>
      )}
      <p className="mt-2 text-[12px] text-carbon/50">Square, well lit, on a plain background. JPG, PNG or WebP, up to 8 MB.</p>
      {banner}
    </Card>
  );
}

/* ------------------------------- availability ----------------------------- */

export function AvailabilityCard({ id, current, canChange, canPublish }: { id: string; current: Availability; canChange: boolean; canPublish: boolean }) {
  const { go, pending, banner } = useRun();
  const options = (Object.keys(AVAILABILITY_LABEL) as Availability[]).filter((a) => canPublish || (a !== "HIDDEN" && current !== "HIDDEN") || a === current);
  return (
    <Card title="Availability">
      <ul className="space-y-1.5">
        {options.map((a) => (
          <li key={a}>
            <button
              type="button"
              disabled={!canChange || pending || a === current}
              onClick={() => go(() => setAvailability({ id, availability: a }), `Now ${AVAILABILITY_LABEL[a].toLowerCase()}.`)}
              className={cx(
                "w-full rounded-xl px-3 py-2 text-left text-[13px] transition-colors",
                a === current ? "bg-carbon text-paper-white" : "shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] hover:bg-soft-mist/60 disabled:hover:bg-transparent",
              )}
            >
              <span className="font-semibold">{AVAILABILITY_LABEL[a]}</span>
              <span className={cx("block text-[12px]", a === current ? "text-paper-white/70" : "text-carbon/55")}>{AVAILABILITY_HINT[a]}</span>
            </button>
          </li>
        ))}
      </ul>
      {!canPublish && current === "HIDDEN" && <p className="mt-2 text-[12px] text-carbon/55">Putting a hidden product on sale needs a role that can publish.</p>}
      {banner}
    </Card>
  );
}

/* ---------------------------------- prices -------------------------------- */

export function PricesCard(props: {
  id: string;
  version: number;
  standardPrice: number;
  memberPrice: number;
  costPrice: number | null;
  canChange: boolean;
  history: { id: string; text: string; meta: string }[];
}) {
  const { go, pending, banner } = useRun();
  const [editing, setEditing] = useState(false);
  const margin = props.costPrice ? Math.round((1 - props.costPrice / props.memberPrice) * 100) : null;
  return (
    <Card title="Prices">
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            go(
              () =>
                setPrices({
                  id: props.id,
                  version: props.version,
                  standardPrice: Number(f.get("standard")),
                  memberPrice: Number(f.get("member")),
                  costPrice: num(String(f.get("cost") ?? "")),
                  reason: String(f.get("reason") ?? ""),
                }),
              "Prices updated. The shop shows them now.",
              () => setEditing(false),
            );
          }}
        >
          <PriceInput name="standard" label="Standard (₦)" value={props.standardPrice} />
          <PriceInput name="member" label="Member (₦)" value={props.memberPrice} />
          <PriceInput name="cost" label="Our cost (₦, optional)" value={props.costPrice} />
          <Field label="Why?" htmlFor="price-reason">
            <Input id="price-reason" name="reason" required maxLength={200} placeholder="e.g. Market price up this week" />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending}>
              Save prices
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-y-1.5 text-[13px]">
            <Row label="Standard">₦{props.standardPrice.toLocaleString("en-NG")}</Row>
            <Row label="Member">₦{props.memberPrice.toLocaleString("en-NG")}</Row>
            <Row label="Our cost">{props.costPrice ? `₦${props.costPrice.toLocaleString("en-NG")}` : "—"}</Row>
            {margin !== null && <Row label="Member margin">{margin}%</Row>}
          </dl>
          {props.canChange && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setEditing(true)}>
              Change prices
            </Button>
          )}
        </>
      )}
      {props.history.length > 0 && (
        <details className="mt-4 border-t border-black/6 pt-3">
          <summary className="cursor-pointer text-[13px] font-semibold">History</summary>
          <ul className="mt-2 space-y-2 text-[12px]">
            {props.history.map((h) => (
              <li key={h.id}>
                <p>{h.text}</p>
                <p className="text-carbon/50">{h.meta}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {banner}
    </Card>
  );
}

function PriceInput({ name, label, value }: { name: string; label: string; value: number | null }) {
  return (
    <Field label={label} htmlFor={`price-${name}`}>
      <Input id={`price-${name}`} name={name} type="number" min={name === "cost" ? 0 : 1} required={name !== "cost"} defaultValue={value ?? ""} />
    </Field>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-carbon/50">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{children}</dd>
    </>
  );
}
