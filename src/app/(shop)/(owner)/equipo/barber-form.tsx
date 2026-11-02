"use client";

import { useActionState } from "react";
import { addBarberAction } from "./actions";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";

export function BarberForm() {
  const [state, action, pending] = useActionState(addBarberAction, null);
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4 p-4`}>
      <h2 className="font-semibold">Agregar barbero</h2>
      <Field label="Nombre">
        <input className={inputClass} name="displayName" required />
      </Field>
      <Field label="Correo">
        <input className={inputClass} name="email" type="email" required />
      </Field>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Contraseña inicial" hint="Mínimo 8 caracteres.">
          <input className={inputClass} name="password" type="password" minLength={8} required />
        </Field>
        <Field label="Comisión (%)">
          <input className={`${inputClass} tabular-nums`} name="commissionPercent" inputMode="numeric" placeholder="50" required />
        </Field>
      </div>
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Agregar barbero"}
      </button>
    </form>
  );
}
