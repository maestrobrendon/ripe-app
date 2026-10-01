"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icon";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  labelExtra?: React.ReactNode;
};

/**
 * A password input with a show/hide toggle. Server-component pages (login,
 * reset-password) render this client component as a leaf, so the page itself
 * doesn't need "use client" just to hold this one piece of state.
 */
export function PasswordField({ label, labelExtra, id, className, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1 flex items-center justify-between text-sm font-medium">
        {label}
        {labelExtra}
      </span>
      <span className="relative block">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className={`w-full rounded-input border border-border px-3 py-2 pr-10 text-sm ${className ?? ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="tap-target absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-foreground"
        >
          <Icon name={visible ? "hide" : "show"} size={18} />
        </button>
      </span>
    </label>
  );
}
