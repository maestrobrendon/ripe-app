"use client";

import { useState, useTransition } from "react";
import { useAdminAction } from "../step-up";
import { Badge, Button } from "../../_ui/kit";
import { verifyChainAction } from "./actions";

export function VerifyChain() {
  const run = useAdminAction();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ tone: "good" | "bad" | "neutral"; text: string } | null>(null);

  return (
    <div className="flex items-center gap-3">
      {result && <Badge tone={result.tone}>{result.text}</Badge>}
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await run(() => verifyChainAction());
            if (!r.ok) setResult({ tone: "neutral", text: r.error });
            else if (r.data.intact) setResult({ tone: "good", text: `Intact: ${r.data.checked} events` });
            else setResult({ tone: "bad", text: `Broken at #${r.data.brokenAtSeq ?? "?"}` });
          })
        }
      >
        {pending ? "Checking…" : "Verify the chain"}
      </Button>
    </div>
  );
}
