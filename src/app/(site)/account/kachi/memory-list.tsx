"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TypeToConfirm } from "@/components/ui/type-to-confirm";
import type { KachiMemoryNote } from "@/lib/kachi-types";
import { deleteMemory, editMemory, forgetEverything } from "./actions";

type Kind = KachiMemoryNote["kind"];

/** The kinds, in the order shown, with how each reads as a heading and a choice. */
const KINDS: { kind: Kind; title: string; choice: string }[] = [
  { kind: "ALLERGY", title: "Allergies", choice: "Allergy" },
  { kind: "DISLIKE", title: "Doesn't eat or like", choice: "Don't eat" },
  { kind: "LIKE", title: "Loves", choice: "Love" },
  { kind: "HOUSEHOLD", title: "Household", choice: "Household" },
  { kind: "ROUTINE", title: "Routines", choice: "Routine" },
  { kind: "OTHER", title: "Other notes", choice: "Other" },
];

const field =
  "h-11 w-full rounded-xl border border-hairline bg-surface px-3.5 text-[16px] outline-none transition-[border-color,box-shadow] focus:border-carbon focus:shadow-[0_0_0_3px_rgb(0_0_0/0.08)]";

export function MemoryList({ memories }: { memories: KachiMemoryNote[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (memories.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-surface px-5 py-8 text-center ring-1 ring-hairline">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-lavender/40">
          <Icon name="spark" size={20} weight="bold" />
        </span>
        <p className="mt-3 text-[17px] font-semibold">Nothing yet</p>
        <p className="mx-auto mt-1 max-w-xs text-[15px] text-muted">Tell Kachi about allergies, foods you skip or who you cook for, and she&rsquo;ll keep it in mind.</p>
        <Link href="/assistant" className="mt-4 inline-flex h-10 items-center rounded-full bg-carbon px-4 text-[15px] font-semibold text-white">
          Talk to Kachi
        </Link>
      </div>
    );
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "That didn't work. Try again."));
      if (r.ok) after?.();
    });

  return (
    <>
      {error && <p className="mt-4 rounded-xl bg-ember/10 px-3.5 py-2.5 text-[15px] text-ember">{error}</p>}
      {KINDS.map(({ kind, title }) => {
        const group = memories.filter((m) => m.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} className="mt-6">
            <h2 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold tracking-[0.02em] text-muted uppercase">
              {kind === "ALLERGY" && <Icon name="warning" size={13} weight="bold" className="text-ember" />}
              {title}
            </h2>
            <ul className="mt-2 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
              {group.map((m) =>
                editing === m.id ? (
                  <EditRow key={m.id} memory={m} pending={pending} onCancel={() => setEditing(null)} onSave={(k, t) => run(() => editMemory(m.id, k, t), () => setEditing(null))} />
                ) : (
                  <li key={m.id} className="flex items-center gap-2 py-1 pr-1.5 pl-4">
                    <span className="min-w-0 flex-1 py-2.5 text-[16px] leading-snug">{m.text}</span>
                    <button onClick={() => setEditing(m.id)} aria-label={`Edit "${m.text}"`} className="flex size-10 items-center justify-center rounded-full text-carbon/60 hover:bg-black/[0.04]">
                      <Icon name="edit" size={17} />
                    </button>
                    <button
                      onClick={() => run(() => deleteMemory(m.id))}
                      disabled={pending}
                      aria-label={`Delete "${m.text}"`}
                      className="flex size-10 items-center justify-center rounded-full text-carbon/60 hover:bg-black/[0.04] disabled:opacity-40"
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}

      <div className="mt-8 rounded-2xl bg-surface ring-1 ring-hairline">
        {clearing ? (
          <div className="p-4 text-[15px]">
            <p className="mb-3">Kachi will forget all {memories.length} notes. Your chats and food settings stay as they are.</p>
            <TypeToConfirm phrase="Forget everything">
              {(ready) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" loading={pending} disabled={!ready} onClick={() => run(forgetEverything, () => setClearing(false))}>
                    Forget everything
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setClearing(false)}>
                    Keep them
                  </Button>
                </div>
              )}
            </TypeToConfirm>
          </div>
        ) : (
          <button onClick={() => setClearing(true)} className="h-12 w-full px-4 text-left text-[16px] font-medium text-ember">
            Forget everything
          </button>
        )}
      </div>
    </>
  );
}

function EditRow({ memory, pending, onSave, onCancel }: { memory: KachiMemoryNote; pending: boolean; onSave: (kind: Kind, text: string) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<Kind>(memory.kind);
  const [text, setText] = useState(memory.text);
  return (
    <li className="p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(kind, text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} autoFocus aria-label="Note" className={field} />
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              onClick={() => setKind(k.kind)}
              className={`h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${kind === k.kind ? "bg-carbon text-white" : "bg-soft-mist text-carbon"}`}
            >
              {k.choice}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" type="submit" loading={pending}>
            Save
          </Button>
          <Button size="sm" type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </li>
  );
}
