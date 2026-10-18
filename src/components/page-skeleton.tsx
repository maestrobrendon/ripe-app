/** Grey shapes in the page's layout while it loads, so nothing jumps when it arrives. */
export function PageSkeleton({ kind }: { kind: "home" | "list" | "form" }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 sm:px-6 sm:pt-6 lg:max-w-5xl" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-56 rounded-xl" />
      {kind === "home" && (
        <>
          <div className="skeleton mt-4 h-28 rounded-2xl" />
          <div className="skeleton mt-6 h-5 w-32 rounded-lg" />
          <div className="mt-3 grid gap-px overflow-hidden rounded-2xl">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
          <div className="mt-8 flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-56 w-40 shrink-0 rounded-2xl" />
            ))}
          </div>
        </>
      )}
      {kind === "list" && (
        <div className="mt-6 grid gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      )}
      {kind === "form" && (
        <div className="mt-6 grid gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  );
}
