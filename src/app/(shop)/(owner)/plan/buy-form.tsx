"use client";

import { useActionState } from "react";
import { buyProAction } from "./actions";
import { Notice, buttonClass, cardClass } from "@/components/ui";

type Option = { months: number; label: string; discount: number; total: number; perMonth: string; totalLabel: string };

export function BuyForm({ options, enabled }: { options: Option[]; enabled: boolean }) {
  const [state, action, pending] = useActionState(buyProAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      {options.map((option, index) => (
        <label key={option.months} className={`${cardClass} flex cursor-pointer items-center gap-3 p-4 has-[:checked]:border-[#D97706]`}>
          <input className="h-5 w-5 accent-[#D97706]" defaultChecked={index === 0} name="months" type="radio" value={option.months} />
          <span className="flex-1">
            <span className="block font-medium">
              {option.label}
              {option.discount ? <span className="ml-2 rounded-full bg-[#14532D]/60 px-2 py-0.5 text-xs text-[#BBF7D0]">−{option.discount}%</span> : null}
            </span>
            <span className="block text-sm text-[#94A3B8]">{option.perMonth} al mes</span>
          </span>
          <span className="font-semibold tabular-nums">{option.totalLabel}</span>
        </label>
      ))}
      {state?.message ? <Notice tone="error">{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending || !enabled} type="submit">
        {pending ? "Abriendo Wompi…" : "Pagar con Wompi"}
      </button>
      {!enabled ? (
        <p className="text-center text-sm text-[#94A3B8]">Los pagos en línea todavía no están activados en esta instalación.</p>
      ) : (
        <p className="text-center text-xs text-[#94A3B8]">Tarjeta, PSE, Nequi o Bancolombia. El plan se activa apenas Wompi confirma el pago.</p>
      )}
    </form>
  );
}
