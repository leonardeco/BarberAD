"use client";

import { useActionState } from "react";
import { createServiceAction, updateServiceAction } from "./actions";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";

type Service = { id: string; name: string; durationMin: number; listPrice: number };

export function ServiceForm({ service }: { service?: Service }) {
  const [state, action, pending] = useActionState(service ? updateServiceAction : createServiceAction, null);
  return (
    <form
      action={action}
      className={service ? "mt-4 flex flex-col gap-4" : `${cardClass} flex flex-col gap-4 p-4`}
    >
      {service ? <input name="serviceId" type="hidden" value={service.id} /> : null}
      <Field label="Nombre">
        <input className={inputClass} defaultValue={service?.name} name="name" placeholder="Ej.: Fade" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración (min)">
          <input
            className={inputClass}
            defaultValue={service?.durationMin}
            inputMode="numeric"
            name="durationMin"
            placeholder="30"
            required
          />
        </Field>
        <Field label="Precio de lista">
          <input
            className={`${inputClass} tabular-nums`}
            defaultValue={service?.listPrice}
            inputMode="numeric"
            name="listPrice"
            placeholder="20000"
            required
          />
        </Field>
      </div>
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : service ? "Guardar cambios" : "Agregar servicio"}
      </button>
    </form>
  );
}
