"use client";

import { useActionState } from "react";
import { closeDrawerAction } from "./actions";
import { Field, buttonClass, inputClass } from "@/components/ui";

export function CloseForm() {
  const [state, action, pending] = useActionState(closeDrawerAction, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <Field label="Efectivo contado">
        <input className={inputClass} name="countedCash" inputMode="numeric" required />
      </Field>
      {state?.message ? (
        <p className={`text-sm ${state.message.startsWith("Caja cerrada") ? "text-[#CBD5E1]" : "text-[#FECACA]"}`}>
          {state.message}
        </p>
      ) : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Cerrando…" : "Cerrar caja"}
      </button>
    </form>
  );
}
