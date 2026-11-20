import { addDays, isDay } from "./agenda";

export type PeriodKey = "hoy" | "ayer" | "semana" | "mes" | "mes-pasado" | "rango";

export function resolvePeriod(today: string, params: { p?: string; desde?: string; hasta?: string }) {
  const key = (params.p ?? "hoy") as PeriodKey;
  const date = new Date(`${today}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // lunes = 0
  const monthStart = `${today.slice(0, 8)}01`;
  if (key === "ayer") return { key, from: addDays(today, -1), to: addDays(today, -1) };
  if (key === "semana") return { key, from: addDays(today, -weekday), to: today };
  if (key === "mes") return { key, from: monthStart, to: today };
  if (key === "mes-pasado") {
    const lastDay = addDays(monthStart, -1);
    return { key, from: `${lastDay.slice(0, 8)}01`, to: lastDay };
  }
  if (key === "rango" && params.desde && params.hasta && isDay(params.desde) && isDay(params.hasta) && params.desde <= params.hasta) {
    return { key, from: params.desde, to: params.hasta };
  }
  return { key: "hoy" as PeriodKey, from: today, to: today };
}

export const periodLabels: { key: PeriodKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "mes-pasado", label: "Mes pasado" },
];
