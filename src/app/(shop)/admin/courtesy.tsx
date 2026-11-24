"use client";

import { useActionState } from "react";
import { createCourtesyShopAction, grantProAction } from "./actions";
import { Field, Notice, buttonClass, cardClass, inputClass, quietButtonClass } from "@/components/ui";

const months = [1, 3, 6, 12];

function MonthsSelect() {
  return (
    <select aria-label="Meses de cortesía" className={`${inputClass} h-11 text-sm`} defaultValue="1" name="months">
      {months.map((m) => (
        <option key={m} value={m}>
          {m === 1 ? "1 mes" : `${m} meses`}
        </option>
      ))}
    </select>
  );
}

export function GrantPro({ shopId }: { shopId: string }) {
  const [state, action, pending] = useActionState(grantProAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input name="shopId" type="hidden" value={shopId} />
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <MonthsSelect />
        <input aria-label="Motivo" className={`${inputClass} h-11 text-sm`} maxLength={200} name="note" placeholder="Motivo (opcional)" />
      </div>
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={`${quietButtonClass} h-10 text-xs`} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Regalar plan Pro"}
      </button>
    </form>
  );
}

export function CourtesyShop() {
  const [state, action, pending] = useActionState(createCourtesyShopAction, null);
  return (
    <details className={`${cardClass} group mt-8 p-4`} open={Boolean(state?.ok) || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold">
        Agregar una barbería de cortesía
        <span className="text-sm font-normal text-[#D97706] group-open:hidden">Abrir</span>
        <span className="hidden text-sm font-normal text-[#D97706] group-open:inline">Cerrar</span>
      </summary>
      {state?.ok && state.code ? (
        <div className="mt-3 flex flex-col gap-3">
          <Notice tone="ok">{state.message}</Notice>
          <div className="rounded-xl bg-[#14532D]/40 px-4 py-4 text-center">
            <p className="text-4xl font-semibold tracking-[0.4em] tabular-nums text-[#BBF7D0]">{state.code}</p>
            <p className="mt-2 text-sm text-[#BBF7D0]">
              Dale este código a {state.email}. Entra a la página, toca «¿Olvidaste tu contraseña?», escribe su correo, el código y
              la contraseña que quiera. Vale 10 minutos; si se vence, usa «Soporte» en su barbería para generar otro.
            </p>
          </div>
        </div>
      ) : (
        <form action={action} className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-[#CBD5E1]">
            Crea la cuenta del dueño y su barbería con el plan Pro regalado. Él crea su contraseña con un código que verás aquí.
          </p>
          <Field label="Nombre del dueño">
            <input className={inputClass} defaultValue={state?.values?.ownerName} maxLength={80} name="ownerName" required />
          </Field>
          <Field label="Nombre de la barbería">
            <input className={inputClass} defaultValue={state?.values?.shopName} maxLength={80} name="shopName" required />
          </Field>
          <Field label="Correo del dueño">
            <input className={inputClass} defaultValue={state?.values?.email} name="email" required type="email" />
          </Field>
          <Field label="WhatsApp de la barbería">
            <input className={inputClass} defaultValue={state?.values?.phone} inputMode="tel" maxLength={20} name="phone" placeholder="300 123 4567" type="tel" />
          </Field>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <Field label="Meses de Pro">
              <MonthsSelect />
            </Field>
            <Field label="Motivo (opcional)">
              <input className={inputClass} defaultValue={state?.values?.note} maxLength={200} name="note" placeholder="Ej.: piloto, amigo" />
            </Field>
          </div>
          {state?.message && !state.ok ? <Notice tone="error">{state.message}</Notice> : null}
          <button className={buttonClass} disabled={pending} type="submit">
            {pending ? "Creando…" : "Crear barbería de cortesía"}
          </button>
        </form>
      )}
    </details>
  );
}
