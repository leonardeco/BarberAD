"use client";

import { useActionState } from "react";
import { createAppointmentAction } from "./actions";
import { Field, Notice, buttonClass, cardClass, inputClass } from "@/components/ui";

type Option = { id: string; name: string };

export function NewAppointment({
  day,
  members,
  services,
  defaultMemberId,
}: {
  day: string;
  members: Option[];
  services: (Option & { durationMin: number })[];
  defaultMemberId: string;
}) {
  const [state, action, pending] = useActionState(createAppointmentAction, null);
  return (
    <details className={`${cardClass} group mt-6 p-4`}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold">
        Agendar una cita
        <span className="text-sm font-normal text-[#D97706] group-open:hidden">Abrir</span>
        <span className="hidden text-sm font-normal text-[#D97706] group-open:inline">Cerrar</span>
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día">
            <input className={inputClass} defaultValue={day} name="day" required type="date" />
          </Field>
          <Field label="Hora">
            <input className={inputClass} name="time" required step={300} type="time" />
          </Field>
        </div>
        <Field label="Servicio">
          <select className={inputClass} name="serviceId" required>
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.durationMin} min
              </option>
            ))}
          </select>
        </Field>
        {members.length > 1 ? (
          <Field label="Barbero">
            <select className={inputClass} defaultValue={defaultMemberId} name="memberId" required>
              {members.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input name="memberId" type="hidden" value={members[0]?.id ?? ""} />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <input className={inputClass} maxLength={80} name="clientName" required />
          </Field>
          <Field label="WhatsApp">
            <input className={inputClass} inputMode="tel" maxLength={20} name="phone" placeholder="300 123 4567" required />
          </Field>
        </div>
        {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Guardando…" : "Agendar"}
        </button>
      </form>
    </details>
  );
}
