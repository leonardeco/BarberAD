"use client";

import { useActionState } from "react";
import { resetPasswordAction, updateCommissionAction } from "./actions";
import { Field, Notice, inputClass, quietButtonClass } from "@/components/ui";

export function MemberTools({ memberId, commissionPercent }: { memberId: string; commissionPercent: number }) {
  const [commission, commissionAction, savingCommission] = useActionState(updateCommissionAction, null);
  const [password, passwordAction, savingPassword] = useActionState(resetPasswordAction, null);
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <form action={commissionAction} className="flex flex-col gap-2">
        <input name="memberId" type="hidden" value={memberId} />
        <Field label="Comisión (%)">
          <input
            className={`${inputClass} tabular-nums`}
            defaultValue={commissionPercent}
            inputMode="numeric"
            name="commissionPercent"
            required
          />
        </Field>
        {commission?.message ? <Notice tone={commission.ok ? "ok" : "error"}>{commission.message}</Notice> : null}
        <button className={quietButtonClass} disabled={savingCommission} type="submit">
          {savingCommission ? "Guardando…" : "Guardar comisión"}
        </button>
      </form>
      <form action={passwordAction} className="flex flex-col gap-2">
        <input name="memberId" type="hidden" value={memberId} />
        <Field label="Contraseña nueva" hint="Si la olvidó. Mínimo 8 caracteres.">
          <input autoComplete="new-password" className={inputClass} minLength={8} name="password" required type="password" />
        </Field>
        {password?.message ? <Notice tone={password.ok ? "ok" : "error"}>{password.message}</Notice> : null}
        <button className={quietButtonClass} disabled={savingPassword} type="submit">
          {savingPassword ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
