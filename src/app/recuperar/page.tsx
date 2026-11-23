"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmResetCodeAction, requestResetAction } from "./actions";
import { AuthFrame } from "@/components/auth-frame";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";

export default function RequestResetPage() {
  const [asked, ask, asking] = useActionState(requestResetAction, null);
  const [done, confirm, confirming] = useActionState(confirmResetCodeAction, null);
  const email = done?.email ?? asked?.email;

  return (
    <AuthFrame
      title="Recupera tu contraseña"
      detail={asked?.ok && !done?.ok ? "Escribe el código de 4 números y tu contraseña nueva." : "Te enviamos un código de 4 números a tu correo."}
    >
      {done?.ok ? (
        <div className="mt-8 flex flex-col gap-4">
          <Notice tone="ok">{done.message}</Notice>
          <Link className={buttonClass} href="/entrar">
            Entrar
          </Link>
        </div>
      ) : asked?.ok && email ? (
        <form action={confirm} className="mt-8 flex flex-col gap-4">
          <input name="email" type="hidden" value={email} />
          <Notice tone="ok">{asked.message}</Notice>
          <Field label="Código">
            <input
              autoComplete="one-time-code"
              autoFocus
              className={`${inputClass} h-14 text-center text-2xl font-semibold tracking-[0.5em] tabular-nums`}
              inputMode="numeric"
              maxLength={4}
              name="code"
              pattern="\d{4}"
              placeholder="••••"
              required
            />
          </Field>
          <Field hint="Mínimo 8 caracteres." label="Contraseña nueva">
            <input autoComplete="new-password" className={inputClass} minLength={8} name="password" required type="password" />
          </Field>
          <Field label="Repítela">
            <input autoComplete="new-password" className={inputClass} minLength={8} name="confirm" required type="password" />
          </Field>
          {done?.message ? <Notice tone="error">{done.message}</Notice> : null}
          <button className={buttonClass} disabled={confirming} type="submit">
            {confirming ? "Guardando…" : "Cambiar contraseña"}
          </button>
          <p className="text-center text-sm text-[#94A3B8]">
            ¿No llegó? Revisa el spam o{" "}
            <Link className="text-[#D97706]" href="/recuperar" onClick={() => window.location.reload()}>
              pide otro código
            </Link>
            .
          </p>
        </form>
      ) : (
        <form action={ask} className="mt-8 flex flex-col gap-4">
          <Field label="Correo">
            <input autoComplete="email" className={inputClass} name="email" required type="email" />
          </Field>
          {asked?.message && !asked.ok ? <Notice tone="error">{asked.message}</Notice> : null}
          <button className={buttonClass} disabled={asking} type="submit">
            {asking ? "Enviando…" : "Enviar código"}
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
