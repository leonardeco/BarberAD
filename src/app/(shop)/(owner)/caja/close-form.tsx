"use client";

import { useActionState, useState } from "react";
import { closeDrawerAction } from "./actions";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";
import { formatCop } from "@/server/money";

export function CloseForm({ expectedCash }: { expectedCash: number }) {
  const [state, action, pending] = useActionState(closeDrawerAction, null);
  const [counted, setCounted] = useState("");
  const difference = counted === "" ? null : Number(counted) - expectedCash;

  return (
    <form action={action} className={`${cardClass} mt-6 flex flex-col gap-4 p-4`}>
      <div>
        <h2 className="font-semibold">Cerrar la caja de hoy</h2>
        <p className="text-sm text-[#94A3B8]">Cuenta el efectivo de la gaveta. Una vez cerrada, hoy no se cobra más.</p>
      </div>
      <Field label="Efectivo contado">
        <input
          className={`${inputClass} h-14 text-xl font-semibold tabular-nums`}
          inputMode="numeric"
          name="countedCash"
          onChange={(event) => setCounted(event.target.value.replace(/\D/g, ""))}
          required
          value={counted}
        />
      </Field>
      {difference !== null ? (
        <p
          className={`text-sm ${
            difference === 0 ? "text-[#BBF7D0]" : difference > 0 ? "text-[#FBBF24]" : "text-[#FECACA]"
          }`}
        >
          {difference === 0
            ? "Cuadra exacto con lo esperado."
            : difference > 0
              ? `Sobran ${formatCop(difference)}.`
              : `Faltan ${formatCop(-difference)}.`}
        </p>
      ) : null}
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Cerrando…" : "Cerrar caja"}
      </button>
    </form>
  );
}
