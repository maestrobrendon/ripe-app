import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// Shared label chrome for the account page's form fields, so every
// input/select/textarea lines up the same way instead of each call site
// hand-rolling its own <label>/<span> wrapper.
function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-muted">{children}</span>;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function TextField({ label, className, ...props }: TextFieldProps) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        className={`w-full rounded-input border border-border px-3 py-2 text-sm ${className ?? ""}`}
        {...props}
      />
    </label>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };

export function TextAreaField({ label, className, ...props }: TextAreaFieldProps) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        className={`w-full rounded-input border border-border px-3 py-2 text-sm ${className ?? ""}`}
        {...props}
      />
    </label>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string };

export function SelectField({ label, className, children, ...props }: SelectFieldProps) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        className={`w-full rounded-input border border-border px-3 py-2 text-sm ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
