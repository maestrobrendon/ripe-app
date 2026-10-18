"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SiteSettings, SettingKey } from "@/lib/site-settings-schema";
import { useAdminAction } from "../step-up";
import { Alert, Button, Card, Field, Input } from "../../_ui/kit";
import { saveSetting } from "./actions";

/** One card per setting: edit, save (with step-up), and see whether it's still the default. */
export function SettingsView({ settings, defaults, changed, canManage }: { settings: SiteSettings; defaults: SiteSettings; changed: Record<string, string>; canManage: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SettingCard
        k="announcement"
        title="Announcement bar"
        hint="The line above the site for visitors who aren't signed in. Up to 140 characters."
        changed={changed.announcement}
        canManage={canManage}
        read={(f) => ({ text: String(f.get("text") ?? "") })}
      >
        <Field label="Message" htmlFor="s-text">
          <Input id="s-text" name="text" required minLength={3} maxLength={140} defaultValue={settings.announcement.text} disabled={!canManage} />
        </Field>
      </SettingCard>

      <SettingCard
        k="support"
        title="Support contacts"
        hint="Used across the site, in emails and by Kachi when someone needs a person."
        changed={changed.support}
        canManage={canManage}
        warn={settings.support.whatsapp === defaults.support.whatsapp ? "The WhatsApp number is still the placeholder. Customers who tap it reach no one." : undefined}
        read={(f) => ({ whatsapp: String(f.get("whatsapp") ?? "").replace(/\D/g, ""), email: String(f.get("email") ?? "") })}
      >
        <Field label="WhatsApp number" htmlFor="s-wa" hint="With the country code, e.g. 2348031234567">
          <Input id="s-wa" name="whatsapp" required inputMode="tel" maxLength={20} defaultValue={settings.support.whatsapp} disabled={!canManage} />
        </Field>
        <Field label="Email" htmlFor="s-email">
          <Input id="s-email" name="email" type="email" required maxLength={254} defaultValue={settings.support.email} disabled={!canManage} />
        </Field>
      </SettingCard>

      <SettingCard
        k="delivery"
        title="Free delivery"
        hint="Cart value at or above which delivery is free for everyone. Member Plus always gets it free; area fees are under Delivery areas."
        changed={changed.delivery}
        canManage={canManage}
        read={(f) => ({ freeThreshold: Math.round(Number(f.get("freeThreshold"))) })}
      >
        <Field label="Free above (₦)" htmlFor="s-free">
          <Input id="s-free" name="freeThreshold" type="number" min={0} max={10000000} required defaultValue={settings.delivery.freeThreshold} disabled={!canManage} />
        </Field>
      </SettingCard>

      <SettingCard
        k="transfer"
        title="Bank transfer"
        hint="Customers who choose bank transfer at checkout pay into this account, with their order number as the reference. Mark those orders paid once the money arrives. Leave it empty to offer pay on delivery only."
        changed={changed.transfer}
        canManage={canManage}
        warn={!settings.transfer.accountNumber ? "No account yet, so checkout offers pay on delivery only." : undefined}
        read={(f) => ({ bankName: String(f.get("bankName") ?? ""), accountName: String(f.get("accountName") ?? ""), accountNumber: String(f.get("accountNumber") ?? "").replace(/\D/g, "") })}
      >
        <Field label="Bank" htmlFor="s-bank">
          <Input id="s-bank" name="bankName" maxLength={60} defaultValue={settings.transfer.bankName} disabled={!canManage} />
        </Field>
        <Field label="Account name" htmlFor="s-acct-name">
          <Input id="s-acct-name" name="accountName" maxLength={80} defaultValue={settings.transfer.accountName} disabled={!canManage} />
        </Field>
        <Field label="Account number" htmlFor="s-acct-no" hint="10 digits">
          <Input id="s-acct-no" name="accountNumber" inputMode="numeric" maxLength={10} defaultValue={settings.transfer.accountNumber} disabled={!canManage} />
        </Field>
      </SettingCard>
    </div>
  );
}

function SettingCard(props: {
  k: SettingKey;
  title: string;
  hint: string;
  changed?: string;
  canManage: boolean;
  warn?: string;
  read: (f: FormData) => unknown;
  children: ReactNode;
}) {
  const run = useAdminAction();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  return (
    <Card title={props.title} actions={<span className="text-[12px] text-carbon/45">{props.changed ? `Changed ${props.changed}` : "Default"}</span>}>
      <p className="-mt-2 mb-4 text-[12px] text-carbon/55">{props.hint}</p>
      {props.warn && (
        <div className="mb-4">
          <Alert tone="warn">{props.warn}</Alert>
        </div>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = props.read(new FormData(e.currentTarget));
          start(async () => {
            setNotice(null);
            const r = await run(() => saveSetting({ key: props.k, value }));
            if (r.ok) {
              setNotice({ tone: "success", text: "Saved. The site uses it now." });
              router.refresh();
            } else if (r.code !== "AUTH" && r.code !== "STEP_UP") setNotice({ tone: "error", text: r.error });
          });
        }}
      >
        {props.children}
        {props.canManage && (
          <Button size="sm" disabled={pending}>
            Save
          </Button>
        )}
      </form>
      {notice && (
        <div className="mt-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
    </Card>
  );
}
