"use client";

import Image from "next/image";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/admin/guard";
import { MENU_GOALS } from "@/lib/menu-types";
import { useAdminAction } from "../step-up";
import { Alert, Badge, Button, Card, Field, Input, cx } from "../../_ui/kit";
import { createRecipe, recipeImageUrl, saveRecipe, setRecipeVisibility, signRecipeUpload } from "./actions";
import type { RecipeDraft } from "./recipe-draft";

type Notice = { tone: "error" | "success"; text: string } | null;
type Amount = [number, string] | null;
const selectClass = "h-11 w-full rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]";
const small = "h-9! text-[13px]!";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

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
  return { go, pending, notice, setNotice, run };
}

export function RecipeEditor(props: {
  mode: "create" | "edit";
  id?: string;
  version?: number;
  initial: RecipeDraft;
  products: { slug: string; name: string }[];
  canEdit: boolean;
}) {
  const { go, pending, notice, setNotice, run } = useRun();
  const router = useRouter();
  const [d, setD] = useState<RecipeDraft>(props.initial);
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const ro = !props.canEdit;
  const nameOf = new Map(props.products.map((p) => [p.slug, p.name]));

  const upload = async (file: File) => {
    setNotice(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setNotice({ tone: "error", text: "Use a JPG, PNG or WebP photo." });
    if (file.size > 8 * 1024 * 1024) return setNotice({ tone: "error", text: "That photo is over 8 MB." });
    setUploading(true);
    try {
      const signed = await run(() => signRecipeUpload(d.slug || d.title || "recipe"));
      if (!signed.ok) return signed.code !== "AUTH" && signed.code !== "STEP_UP" && setNotice({ tone: "error", text: signed.error });
      const body = new FormData();
      for (const [k, v] of Object.entries(signed.data.fields)) body.append(k, v);
      body.append("file", file);
      const res = await fetch(signed.data.url, { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { public_id?: string; error?: { message?: string } } | null;
      if (!res.ok || !json?.public_id) return setNotice({ tone: "error", text: json?.error?.message ?? "The upload didn't go through." });
      const url = await run(() => recipeImageUrl(json.public_id!));
      if (url.ok) {
        set("image", url.data.url);
        setNotice({ tone: "success", text: "Photo uploaded. Save the recipe to keep it." });
      } else if (url.code !== "AUTH" && url.code !== "STEP_UP") setNotice({ tone: "error", text: url.error });
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    const recipe = { ...d, steps: d.steps.map((s) => s.trim()).filter(Boolean), tools: d.tools.filter(Boolean) };
    if (props.mode === "create") go(() => createRecipe(recipe), "Recipe created as a draft.", (r) => router.push(`/recipes/${r.id}`));
    else go(() => saveRecipe({ id: props.id!, version: props.version!, recipe }), "Saved.");
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Card title="The dish">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="r-title">
            <Input
              id="r-title"
              required
              maxLength={80}
              disabled={ro}
              value={d.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Web address" htmlFor="r-slug" hint={`/recipes/${d.slug || "…"}`}>
            <Input
              id="r-slug"
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
          <div className="sm:col-span-2">
            <Field label="Hook" htmlFor="r-summary" hint="One line: what makes it worth cooking.">
              <Input id="r-summary" required maxLength={200} disabled={ro} value={d.summary} onChange={(e) => set("summary", e.target.value)} />
            </Field>
          </div>
          <Field label="Goal" htmlFor="r-goal">
            <select id="r-goal" className={selectClass} disabled={ro} value={d.goal} onChange={(e) => set("goal", e.target.value)}>
              {MENU_GOALS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minutes" htmlFor="r-min">
              <Input id="r-min" type="number" min={1} max={600} disabled={ro} value={d.minutes} onChange={(e) => set("minutes", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Serves" htmlFor="r-serves">
              <Input id="r-serves" type="number" min={1} max={20} disabled={ro} value={d.serves} onChange={(e) => set("serves", Number(e.target.value) || 0)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Photo">
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-soft-mist">
            {d.image ? <Image src={d.image} alt={d.imageAlt ?? ""} fill sizes="220px" className="object-cover" /> : <span className="grid h-full place-items-center text-[13px] text-carbon/45">No photo yet</span>}
          </div>
          <div className="space-y-3">
            {!ro && (
              <label className={cx("inline-flex h-9 cursor-pointer items-center rounded-xl px-3 text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] hover:bg-soft-mist/60", uploading && "pointer-events-none opacity-50")}>
                {uploading ? "Uploading…" : d.image ? "Replace photo" : "Upload photo"}
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
            )}
            <Field label="What the photo shows" htmlFor="r-alt" hint="For screen readers, e.g. A bowl of spiced chicken over rice with tomato and lime.">
              <Input id="r-alt" maxLength={200} disabled={ro} value={d.imageAlt ?? ""} onChange={(e) => set("imageAlt", e.target.value || null)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title={`From Basket (${d.basket.length})`}>
        <p className="-mt-2 mb-3 text-[12px] text-carbon/55">Catalogue products, in the order the recipe uses them. Amounts are for {d.serves} and scale with the servings switch. Leave pantry basics (salt, oil, pepper) out.</p>
        <ul className="space-y-2">
          {d.basket.map((b, i) => (
            <li key={i} className="grid grid-cols-[1fr_90px_110px_36px] gap-2">
              <select
                aria-label="Product"
                className={cx(selectClass, "h-9 text-[13px]")}
                disabled={ro}
                value={b.slug}
                onChange={(e) => set("basket", d.basket.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)))}
              >
                {!nameOf.has(b.slug) && <option value={b.slug}>{b.slug || "Choose…"}</option>}
                {props.products.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
              <AmountInputs value={b.amount} disabled={ro} onChange={(a) => set("basket", d.basket.map((x, j) => (j === i ? { ...x, amount: a } : x)))} />
              <Remove disabled={ro} onClick={() => set("basket", d.basket.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        {!ro && (
          <Button type="button" size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => set("basket", [...d.basket, { slug: props.products[0]?.slug ?? "", amount: null }])}>
            + Add a product
          </Button>
        )}
      </Card>

      <Card title={`Grab it elsewhere (${d.elsewhere.length})`}>
        <p className="-mt-2 mb-3 text-[12px] text-carbon/55">What the cook picks up on their own: proteins, grains, dairy, sauces.</p>
        <ul className="space-y-2">
          {d.elsewhere.map((e, i) => (
            <li key={i} className="grid grid-cols-[1fr_90px_110px_36px] gap-2">
              <Input aria-label="Ingredient" className={small} maxLength={60} disabled={ro} value={e.label} onChange={(ev) => set("elsewhere", d.elsewhere.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} />
              <AmountInputs value={e.amount} disabled={ro} onChange={(a) => set("elsewhere", d.elsewhere.map((x, j) => (j === i ? { ...x, amount: a } : x)))} />
              <Remove disabled={ro} onClick={() => set("elsewhere", d.elsewhere.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        {!ro && (
          <Button type="button" size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => set("elsewhere", [...d.elsewhere, { label: "", amount: null }])}>
            + Add an ingredient
          </Button>
        )}
      </Card>

      <Card title={`Method (${d.steps.length} steps)`}>
        <ol className="space-y-2">
          {d.steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[28px_1fr_auto] items-start gap-2">
              <span className="pt-2 text-right font-mono text-[13px] text-carbon/45">{i + 1}</span>
              <textarea
                aria-label={`Step ${i + 1}`}
                rows={2}
                maxLength={600}
                disabled={ro}
                value={s}
                onChange={(e) => set("steps", d.steps.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-full rounded-xl bg-paper-white p-2.5 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]"
              />
              {!ro && (
                <span className="flex flex-col">
                  <button type="button" aria-label="Move up" disabled={i === 0} className="h-7 w-8 rounded hover:bg-soft-mist disabled:opacity-30" onClick={() => set("steps", swap(d.steps, i, i - 1))}>
                    ↑
                  </button>
                  <button type="button" aria-label="Remove step" className="h-7 w-8 rounded text-carbon/50 hover:bg-soft-mist" onClick={() => set("steps", d.steps.length > 1 ? d.steps.filter((_, j) => j !== i) : [""])}>
                    ×
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {!ro && (
          <Button type="button" size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => set("steps", [...d.steps, ""])}>
            + Add a step
          </Button>
        )}
        <div className="mt-4 border-t border-black/6 pt-4">
          <Field label="Tools" htmlFor="r-tools" hint="Comma separated, e.g. Large frying pan, Chopping board">
            <Input
              id="r-tools"
              disabled={ro}
              defaultValue={d.tools.join(", ")}
              onBlur={(e) =>
                set(
                  "tools",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>
        </div>
      </Card>

      {props.canEdit && (
        <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl bg-paper-white/95 p-3 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur">
          <Button type="submit" disabled={pending || uploading}>
            {props.mode === "create" ? "Create draft" : "Save recipe"}
          </Button>
          <div className="flex-1">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>
        </div>
      )}
    </form>
  );
}

function swap<T>(list: T[], i: number, j: number): T[] {
  if (j < 0 || j >= list.length) return list;
  const n = [...list];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

function AmountInputs({ value, disabled, onChange }: { value: Amount; disabled: boolean; onChange: (a: Amount) => void }) {
  const [qty, unit] = value ?? [null, ""];
  return (
    <>
      <Input
        aria-label="Amount"
        type="number"
        step="any"
        min={0}
        className={small}
        disabled={disabled}
        value={qty ?? ""}
        placeholder="2"
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(e.target.value === "" || !n ? null : [n, unit]);
        }}
      />
      <Input aria-label="Unit" className={small} maxLength={20} disabled={disabled} value={unit} placeholder="g, head…" onChange={(e) => onChange(qty ? [qty, e.target.value] : null)} />
    </>
  );
}

function Remove({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  if (disabled) return <span />;
  return (
    <button type="button" aria-label="Remove" onClick={onClick} className="h-9 w-9 rounded-lg text-carbon/50 hover:bg-soft-mist">
      ×
    </button>
  );
}

/** Publishing, menu placement and member gating. */
export function VisibilityCard(props: { id: string; status: "DRAFT" | "PUBLISHED"; onMenu: boolean; membersOnly: boolean; canPublish: boolean; previewHref: string; saved: number }) {
  const { go, pending, notice } = useRun();
  const row = (label: string, hint: string, on: boolean, change: () => void): ReactNode => (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div>
        <p className="text-[14px] font-semibold">{label}</p>
        <p className="text-[12px] text-carbon/55">{hint}</p>
      </div>
      <Button size="sm" variant={on ? "primary" : "secondary"} disabled={!props.canPublish || pending} onClick={change}>
        {on ? "On" : "Off"}
      </Button>
    </li>
  );
  return (
    <Card title="Who sees it" actions={props.status === "PUBLISHED" ? <a href={props.previewHref} target="_blank" rel="noreferrer" className="text-[13px] font-semibold underline">View</a> : <Badge tone="warn">Draft</Badge>}>
      <ul className="divide-y divide-black/5">
        {row("Published", props.saved ? `Customers can open it. ${props.saved} saved it.` : "Customers can open it.", props.status === "PUBLISHED", () =>
          go(() => setRecipeVisibility({ id: props.id, status: props.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), props.status === "PUBLISHED" ? "Back to draft." : "Published."),
        )}
        {row("On the menu", "Leads the homepage, sign-up and the recipe page.", props.onMenu, () =>
          go(() => setRecipeVisibility({ id: props.id, onMenu: !props.onMenu }), props.onMenu ? "Taken off the menu." : "On the menu."),
        )}
        {row("Members only", "Everyone sees the dish; members get the method.", props.membersOnly, () =>
          go(() => setRecipeVisibility({ id: props.id, membersOnly: !props.membersOnly }), props.membersOnly ? "Open to everyone." : "Members only now."),
        )}
      </ul>
      {!props.canPublish && <p className="mt-2 text-[12px] text-carbon/55">Your role can edit recipes but not publish them.</p>}
      {notice && (
        <div className="mt-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
    </Card>
  );
}
