"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "./actions";
import { AuthFrame } from "@/components/auth-frame";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";

export default function SignInPage() {
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <AuthFrame title="Entra a tu barbería" detail="Con el correo que te dio el dueño o con el tuyo.">
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Field label="Correo">
          <input className={inputClass} defaultValue={state?.email} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña">
          <input className={inputClass} name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Link className="-mt-1 self-end text-sm text-[#D97706]" href="/recuperar">
          ¿Olvidaste tu contraseña?
        </Link>
        {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[#CBD5E1]">
        ¿Aún no tienes barbería?{" "}
        <Link className="text-[#D97706]" href="/registro">
          Regístrala
        </Link>
      </p>
    </AuthFrame>
  );
}
