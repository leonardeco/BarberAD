"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "../actions";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <Notice tone="ok">{state.message}</Notice>
        <Link className={buttonClass} href="/entrar">
          Entrar
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input name="token" type="hidden" value={token} />
      <Field hint="Mínimo 8 caracteres." label="Contraseña nueva">
        <input autoComplete="new-password" className={inputClass} minLength={8} name="password" required type="password" />
      </Field>
      <Field label="Repítela">
        <input autoComplete="new-password" className={inputClass} minLength={8} name="confirm" required type="password" />
      </Field>
      {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
