export function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const state = stepNum === currentStep ? "current" : stepNum < currentStep ? "done" : "upcoming";
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                state === "done"
                  ? "bg-ripe-green text-white"
                  : state === "current"
                  ? "border-2 border-ripe-green text-ripe-green"
                  : "border border-border text-muted"
              }`}
            >
              {state === "done" ? "✓" : stepNum}
            </span>
            <span className={state === "upcoming" ? "text-muted" : "font-medium"}>{step}</span>
            {stepNum !== steps.length && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
