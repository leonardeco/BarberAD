"use client";

import { useActionState } from "react";
import { addBarberAction } from "./actions";
import { Field, buttonClass, inputClass } from "@/components/ui";

export function BarberForm() {
  const [state, action, pending] = useActionState(addBarberAction, null);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl bg-[#1E293B] p-4">
      <Field label="Nombre">
        <input className={inputClass} name="displayName" required />
      </Field>
      <Field label="Correo">
        <input className={inputClass} name="email" type="email" required />
      </Field>
      <Field label="Contraseña inicial">
        <input className={inputClass} name="password" type="password" minLength={8} required />
      </Field>
      <Field label="Comisión (%)">
        <input className={inputClass} name="commissionPercent" inputMode="numeric" required />
      </Field>
      {state?.message ? (
        <p className={`text-sm ${state.message.startsWith("Barbero creado") ? "text-[#CBD5E1]" : "text-[#FECACA]"}`}>
          {state.message}
        </p>
      ) : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Agregar barbero"}
      </button>
    </form>
  );
}
