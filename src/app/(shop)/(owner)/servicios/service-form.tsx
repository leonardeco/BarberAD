"use client";

import { useActionState } from "react";
import { createServiceAction } from "./actions";
import { Field, buttonClass, inputClass } from "@/components/ui";

export function ServiceForm() {
  const [state, action, pending] = useActionState(createServiceAction, null);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl bg-[#1E293B] p-4">
      <Field label="Nombre">
        <input className={inputClass} name="name" required />
      </Field>
      <Field label="Duración en minutos">
        <input className={inputClass} name="durationMin" inputMode="numeric" required />
      </Field>
      <Field label="Precio de lista">
        <input className={inputClass} name="listPrice" inputMode="numeric" required />
      </Field>
      {state?.message ? <p className="text-sm text-[#FECACA]">{state.message}</p> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Agregar servicio"}
      </button>
    </form>
  );
}
