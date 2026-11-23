"use client";

import { useActionState } from "react";
import { saveTemplatesAction } from "./actions";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";
import type { Templates } from "@/server/reminders";

const fields: { name: keyof Templates; label: string; hint: string }[] = [
  { name: "reminder", label: "Recordatorio de la cita", hint: "Usa {nombre}, {fecha}, {hora}, {servicio}, {barbero}, {barberia} y {cancelar}." },
  { name: "thanks", label: "Después de la cita", hint: "Usa {nombre}, {barberia} y {enlace} (tu enlace de reservas)." },
  { name: "comeback", label: "Hace rato no viene", hint: "Usa {nombre}, {barberia} y {enlace}." },
];

export function TemplatesForm({ templates }: { templates: Templates }) {
  const [state, action, pending] = useActionState(saveTemplatesAction, null);
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4 p-4`}>
      {fields.map((field) => (
        <Field key={field.name} hint={field.hint} label={field.label}>
          <textarea
            className={`${inputClass} h-auto min-h-24 py-3 text-sm`}
            defaultValue={templates[field.name]}
            maxLength={600}
            name={field.name}
            required
          />
        </Field>
      ))}
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar mensajes"}
      </button>
    </form>
  );
}
