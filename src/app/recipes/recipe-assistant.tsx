"use client";

import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { PlanView } from "./produce-planner";
import type { ProducePlan } from "@/lib/produce-planner";

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "assistant-plan"; plan: ProducePlan };

type AssistantReply =
  | { type: "clarify"; question: string }
  | { type: "plan"; intro: string; response: { plan: ProducePlan | null } | { redirect: string } }
  | { type: "fallback"; message: string };

const OPENING =
  "Tell me what you have, or what you're cooking for. I'm [ASSISTANT_LABEL], and I only know about food and recipes here.";

export function RecipeAssistant({
  defaultServings,
  servingsKnown,
}: {
  defaultServings: number;
  servingsKnown: boolean;
}) {
  const cart = useCart();
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", text: OPENING }]);
  const [input, setInput] = useState("");
  const [servings, setServings] = useState<number | null>(servingsKnown ? defaultServings : null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const applyReply = (reply: AssistantReply, messageIfClarifying: string) => {
    if (reply.type === "clarify") {
      setPendingMessage(messageIfClarifying);
      setTurns((t) => [...t, { role: "assistant", text: reply.question }]);
      return;
    }
    setPendingMessage(null);
    if (reply.type === "fallback") {
      setTurns((t) => [...t, { role: "assistant", text: reply.message }]);
      return;
    }
    // reply.type === "plan"
    const response = reply.response;
    if ("redirect" in response) {
      setTurns((t) => [...t, { role: "assistant", text: response.redirect }]);
    } else if (response.plan) {
      const plan = response.plan;
      setTurns((t) => [
        ...t,
        { role: "assistant", text: reply.intro },
        { role: "assistant-plan", plan },
      ]);
    }
  };

  const ask = async (message: string, servingsForCall: number | null) => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, servings: servingsForCall }),
      });
      const reply = (await res.json()) as AssistantReply;
      applyReply(reply, message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text }]);

    if (pendingMessage) {
      // This turn is the answer to a clarifying question, most likely servings.
      const n = parseInt(text.replace(/\D/g, ""), 10);
      const resolved = Number.isFinite(n) && n >= 1 && n <= 20 ? n : servings ?? 3;
      setServings(resolved);
      await ask(pendingMessage, resolved);
      return;
    }

    await ask(text, servings);
  };

  return (
    <div className="rounded-card-lg border border-border bg-surface p-5 sm:p-8">
      <h3 className="text-heading">Ask [ASSISTANT_LABEL]</h3>
      <p className="mt-1 text-muted">Food and recipes only, built from what we stock.</p>

      <div className="mt-5 space-y-3">
        {turns.map((turn, i) => {
          if (turn.role === "assistant-plan") {
            return (
              <div key={i} className="rounded-card border border-border p-4">
                <PlanView plan={turn.plan} onRefresh={() => cart.refresh()} />
              </div>
            );
          }
          return (
            <div
              key={i}
              className={
                turn.role === "user"
                  ? "ml-auto max-w-[85%] rounded-card bg-carbon px-4 py-2.5 text-sm text-white"
                  : "max-w-[85%] rounded-card border border-border bg-sky-wash/60 px-4 py-2.5 text-sm text-carbon"
              }
            >
              {turn.text}
            </div>
          );
        })}
        {loading && <p className="text-sm text-muted">Thinking…</p>}
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pendingMessage ? "e.g. 2" : "A watermelon, a pepper base, lighter dinners"}
          className="flex-1 rounded-full border border-border px-5 py-3 text-base"
        />
        <Button type="submit" disabled={loading || !input.trim()} size="md" className="shrink-0">
          Send
        </Button>
      </form>
    </div>
  );
}
