"use client";

import { useActionState } from "react";
import { ownerResetCodeAction } from "./actions";
import { Notice, quietButtonClass } from "@/components/ui";

export function OwnerCode({ shopId }: { shopId: string }) {
  const [state, action, pending] = useActionState(ownerResetCodeAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input name="shopId" type="hidden" value={shopId} />
      {state?.ok ? (
        <div className="rounded-xl bg-[#14532D]/40 px-4 py-3 text-center">
          <p className="text-3xl font-semibold tracking-[0.4em] tabular-nums text-[#BBF7D0]">{state.code}</p>
          <p className="mt-1 text-xs text-[#BBF7D0]">{state.message} El dueño lo escribe en Recuperar contraseña con su correo.</p>
        </div>
      ) : (
        <>
          {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
          <button className={`${quietButtonClass} h-10 text-xs`} disabled={pending} type="submit">
            {pending ? "Generando…" : "Dar código de recuperación al dueño"}
          </button>
        </>
      )}
    </form>
  );
}
