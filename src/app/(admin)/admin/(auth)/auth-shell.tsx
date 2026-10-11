import type { ReactNode } from "react";
import { AdminMark } from "../_ui/kit";

/** The narrow, centred frame every sign-in step shares. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <AdminMark className="mb-8" />
        <div className="rounded-2xl bg-paper-white p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_48px_-32px_rgb(0_0_0/0.35)] sm:p-7">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-carbon/60">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-[12px] text-carbon/45">Authorised staff only. Every action is recorded.</p>
      </div>
    </main>
  );
}
