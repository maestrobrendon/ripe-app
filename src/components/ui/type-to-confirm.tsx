"use client";

import { useId, useState } from "react";

/**
 * For actions that can't be undone (cancelling an order, deleting an
 * account): the button only works once the exact phrase is typed, so it
 * can't be done by a stray tap. Case and spacing around it don't matter.
 */
export function TypeToConfirm({
  phrase,
  children,
}: {
  /** What they type, e.g. "Cancel order". */
  phrase: string;
  /** Renders the confirming button; `ready` is true once the phrase matches. */
  children: (ready: boolean) => React.ReactNode;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const ready = value.trim().toLowerCase() === phrase.toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] text-carbon/70">
        To confirm, type <b className="font-semibold text-carbon select-all">{phrase}</b>
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={phrase}
        className="mt-1.5 h-11 w-full rounded-xl bg-paper-white px-3.5 text-[15px] shadow-[0_0_0_1px_rgb(0_0_0/0.1)] outline-none focus:shadow-[0_0_0_2px_#000]"
      />
      <div className="mt-3">{children(ready)}</div>
    </div>
  );
}
