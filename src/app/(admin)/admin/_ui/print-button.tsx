"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-9 rounded-xl bg-carbon px-4 text-[13px] font-semibold text-paper-white print:hidden">
      Print
    </button>
  );
}
