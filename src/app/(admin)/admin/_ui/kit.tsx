import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/*
 * The admin's small UI kit: dense, calm, one accent (mint) and one alarm
 * (ember). Server-safe (no hooks), so pages and client components share it.
 */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" };

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-[14px]",
        variant === "primary" && "bg-carbon text-paper-white hover:bg-carbon/85",
        variant === "secondary" && "bg-paper-white text-carbon shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] hover:bg-soft-mist/60",
        variant === "danger" && "bg-ember text-paper-white hover:bg-ember/90",
        variant === "ghost" && "text-carbon/70 hover:bg-soft-mist/70 hover:text-carbon",
        className,
      )}
    />
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        "h-11 w-full rounded-xl bg-paper-white px-3.5 text-[15px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none placeholder:text-carbon/35 focus:shadow-[inset_0_0_0_2px_var(--color-carbon)]",
        className,
      )}
    />
  );
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-carbon/80">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-carbon/55">{hint}</p>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl bg-paper-white p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-carbon/60">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
        tone === "error" && "bg-ember/10 text-[#9a2c00]",
        tone === "success" && "bg-mint-pop/25 text-[#0b5a35]",
        tone === "warn" && "bg-[#fff4cc] text-[#6b5000]",
        tone === "info" && "bg-soft-mist/70 text-carbon/80",
      )}
    >
      {children}
    </p>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold",
        tone === "neutral" && "bg-soft-mist/80 text-carbon/75",
        tone === "good" && "bg-mint-pop/30 text-[#0b5a35]",
        tone === "bad" && "bg-ember/12 text-[#9a2c00]",
        tone === "warn" && "bg-[#fff1b8] text-[#6b5000]",
      )}
    >
      {children}
    </span>
  );
}

/** The admin's mark: the site's "B", with a lock-blue underline so it's never mistaken for the shop. */
export function AdminMark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <span className="logo-wordmark grid h-8 w-8 place-items-center rounded-lg bg-carbon text-[18px] leading-none text-paper-white">B</span>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">
        Basket <span className="text-carbon/45">Admin</span>
      </span>
    </span>
  );
}
