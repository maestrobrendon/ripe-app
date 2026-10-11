"use client";

import { useActionState } from "react";
import { acceptInviteAction, type FormState } from "../../actions";
import { Alert, Button, Field, Input } from "../../../_ui/kit";

export function AcceptInviteForm({ token, name, minLength }: { token: string; name: string; minLength: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInviteAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} autoComplete="name" required />
      </Field>
      <Field label="Password" htmlFor="password" hint={`At least ${minLength} characters. A short sentence is easy to remember and hard to guess.`}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={minLength} maxLength={128} required />
      </Field>
      <Field label="Password again" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={minLength} maxLength={128} required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
