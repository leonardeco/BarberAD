"use client";

import { useActionState, useState } from "react";
import { payBarberAction } from "./actions";
import { Notice, buttonClass, quietButtonClass } from "@/components/ui";

export function PayButton({ memberId, label, disabled }: { memberId: string; label: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(payBarberAction, null);
  const [asking, setAsking] = useState(false);
  if (state?.ok) return <Notice tone="ok">{state.message}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input name="memberId" type="hidden" value={memberId} />
      {asking ? (
        <>
          <p className="text-sm text-[#CBD5E1]">¿Ya le pagaste {label}? Queda registrado y no se puede deshacer.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={quietButtonClass} onClick={() => setAsking(false)} type="button">
              Todavía no
            </button>
            <button className={buttonClass} disabled={pending} type="submit">
              {pending ? "Guardando…" : "Sí, pagado"}
            </button>
          </div>
        </>
      ) : (
        <button className={buttonClass} disabled={disabled} onClick={() => setAsking(true)} type="button">
          Marcar como pagado
        </button>
      )}
      {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
    </form>
  );
}
