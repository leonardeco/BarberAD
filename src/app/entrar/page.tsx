"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "./actions";
import { Field, buttonClass, inputClass } from "@/components/ui";

export default function SignInPage() {
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm text-[#CBD5E1]">BarberAD</p>
      <h1 className="mt-2 text-3xl font-semibold">Entra a tu barbería</h1>
      <form action={action} className="mt-8 flex flex-col gap-4">
        <Field label="Correo">
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña">
          <input className={inputClass} name="password" type="password" autoComplete="current-password" required />
        </Field>
        {state?.message ? <p className="text-sm text-[#FECACA]">{state.message}</p> : null}
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
    </main>
  );
}
