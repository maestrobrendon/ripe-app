"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "../actions";
import { Alert, Button, Field, Input } from "../../_ui/kit";

export function SignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus spellCheck={false} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
