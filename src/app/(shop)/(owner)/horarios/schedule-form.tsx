"use client";

import { useActionState } from "react";
import { saveScheduleAction } from "./actions";
import { Notice, buttonClass, cardClass, inputClass } from "@/components/ui";
import type { MemberSchedule } from "@/server/agenda";

const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function hm(minutes: number) {
  if (minutes >= 1440) return "00:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function ScheduleForm({ member }: { member: MemberSchedule }) {
  const [state, action, pending] = useActionState(saveScheduleAction, null);
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4 p-4`}>
      <input name="memberId" type="hidden" value={member.id} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{member.name}</h2>
          <p className="text-sm text-[#94A3B8]">{member.role === "owner" ? "Dueño" : "Barbero"}</p>
        </div>
        <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm">
          <input className="h-5 w-5 accent-[#D97706]" defaultChecked={member.takesAppointments} name="takesAppointments" type="checkbox" />
          Recibe citas
        </label>
      </div>
      <ul className="flex flex-col gap-2">
        {weekdays.map((label, index) => {
          const weekday = index + 1;
          const day = member.days.find((item) => item.weekday === weekday);
          return (
            <li key={weekday} className="grid grid-cols-[7.5rem_1fr_1fr] items-center gap-2">
              <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm">
                <input className="h-5 w-5 accent-[#D97706]" defaultChecked={Boolean(day)} name={`d${weekday}_on`} type="checkbox" />
                {label}
              </label>
              <input
                aria-label={`${label}, entrada`}
                className={`${inputClass} px-2`}
                defaultValue={hm(day?.start ?? 9 * 60)}
                name={`d${weekday}_start`}
                step={900}
                type="time"
              />
              <input
                aria-label={`${label}, salida`}
                className={`${inputClass} px-2`}
                defaultValue={hm(day?.end ?? 19 * 60)}
                name={`d${weekday}_end`}
                step={900}
                type="time"
              />
            </li>
          );
        })}
      </ul>
      {state?.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar horario"}
      </button>
    </form>
  );
}
