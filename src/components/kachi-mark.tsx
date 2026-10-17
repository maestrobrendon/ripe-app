/** Kachi's mark: a black four-point spark on a mint disc. Size it with className. */
export function KachiMark({ className = "" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-mint-pop ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]">
        <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z" fill="#000" />
      </svg>
    </span>
  );
}
