"use client";

import { useActionState } from "react";
import { saveNotesAction } from "./actions";
import { Notice, inputClass, quietButtonClass } from "@/components/ui";

export function NotesForm({ clientId, notes }: { clientId: string; notes: string }) {
  const [state, action, pending] = useActionState(saveNotesAction, null);
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <input name="clientId" type="hidden" value={clientId} />
      <textarea
        aria-label="Notas del cliente"
        className={`${inputClass} h-auto min-h-20 py-3`}
        defaultValue={notes}
        maxLength={500}
        name="notes"
        placeholder="Ej.: fade 1.5, sin línea, alergia a la cera"
      />
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={quietButtonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar notas"}
      </button>
    </form>
  );
}
