"use client";

import { useActionState, useState, useTransition } from "react";
import { sendAdminCodeAction, verifyAdminCodeAction, type AdminCodeState } from "../actions";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";

export function VerifyForm() {
  const [sent, setSent] = useState<AdminCodeState>(null);
  const [sending, startSending] = useTransition();
  const [state, action, pending] = useActionState(verifyAdminCodeAction, null);
  return (
    <div className={`${cardClass} flex flex-col gap-4 p-5`}>
      {sent?.sent ? (
        <Notice tone="ok">Te enviamos un código a {sent.sent}. Vale 10 minutos.</Notice>
      ) : (
        <p className="text-sm text-[#CBD5E1]">Te enviaremos el código al correo de recuperación del administrador.</p>
      )}
      {sent?.message ? <Notice tone="error">{sent.message}</Notice> : null}
      <button
        className={buttonClass}
        disabled={sending}
        onClick={() => startSending(async () => setSent(await sendAdminCodeAction()))}
        type="button"
      >
        {sending ? "Enviando…" : sent?.sent ? "Enviar otro código" : "Enviarme el código"}
      </button>
      <form action={action} className="flex flex-col gap-3 border-t border-white/5 pt-4">
        <Field label="Código">
          <input
            autoComplete="one-time-code"
            className={`${inputClass} h-14 text-center text-2xl font-semibold tracking-[0.5em] tabular-nums`}
            inputMode="numeric"
            maxLength={4}
            name="code"
            pattern="\d{4}"
            placeholder="••••"
            required
          />
        </Field>
        {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Verificando…" : "Entrar al panel"}
        </button>
      </form>
    </div>
  );
}
