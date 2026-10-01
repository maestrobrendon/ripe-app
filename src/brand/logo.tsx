import { brand } from "./brand.config";

/** <Logo /> — the one place the wordmark is drawn. */
export function Logo({ className, title = brand.name }: { className?: string; title?: string }) {
  return (
    <span role="img" aria-label={title} className={className ?? "logo-wordmark text-xl"}>
      {brand.name}
    </span>
  );
}
