"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestResetAction } from "./actions";
import { AuthFrame } from "@/components/auth-frame";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";

export default function RequestResetPage() {
  const [state, action, pending] = useActionState(requestResetAction, null);
  return (
    <AuthFrame title="Recupera tu contraseña" detail="Te enviamos un enlace para crear una nueva.">
      {state?.ok ? (
        <div className="mt-8">
          <Notice tone="ok">{state.message}</Notice>
        </div>
      ) : (
        <form action={action} className="mt-8 flex flex-col gap-4">
          <Field label="Correo">
            <input autoComplete="email" className={inputClass} name="email" required type="email" />
          </Field>
          {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
          <button className={buttonClass} disabled={pending} type="submit">
            {pending ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-[#CBD5E1]">
        Si eres barbero, el dueño también puede ponerte una contraseña nueva desde Equipo.{" "}
        <Link className="text-[#D97706]" href="/entrar">
          Volver a entrar
        </Link>
      </p>
    </AuthFrame>
  );
}
