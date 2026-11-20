"use client";

import { useActionState } from "react";
import { voidCheckoutAction } from "./actions";
import { Notice, inputClass, quietButtonClass } from "@/components/ui";

export function VoidForm({ checkoutId }: { checkoutId: string }) {
  const [state, action, pending] = useActionState(voidCheckoutAction, null);
  return (
    <details className="group mt-2">
      <summary className="flex min-h-10 cursor-pointer list-none items-center text-xs text-[#94A3B8]">
        <span className="group-open:hidden">¿Se cobró mal? Anular</span>
        <span className="hidden group-open:inline">Cerrar</span>
      </summary>
      <form action={action} className="mt-1 flex flex-col gap-2">
        <input name="checkoutId" type="hidden" value={checkoutId} />
        <input
          aria-label="Motivo de la anulación"
          className={`${inputClass} h-11 text-sm`}
          maxLength={120}
          name="reason"
          placeholder="Ej.: se marcó tarjeta y fue efectivo"
          required
        />
        <p className="text-xs text-[#94A3B8]">El cobro no se borra: queda anulado con el motivo y deja de contar. Después lo cobras bien.</p>
        {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
        <button className={`${quietButtonClass} h-11`} disabled={pending} type="submit">
          {pending ? "Anulando…" : "Anular este cobro"}
        </button>
      </form>
    </details>
  );
}
