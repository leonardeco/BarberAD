import { appDb } from "./db";

export type AttemptKind = "login" | "reset" | "book";

// Reglas: cuántos intentos se permiten por clave (correo o teléfono) y por IP dentro de la ventana.
export const limits: Record<AttemptKind, { minutes: number; perKey: number; perIp: number }> = {
  login: { minutes: 15, perKey: 5, perIp: 30 },
  reset: { minutes: 60, perKey: 3, perIp: 10 },
  book: { minutes: 60, perKey: 5, perIp: 15 },
};

export async function isBlocked(kind: AttemptKind, key: string, ip: string) {
  const rule = limits[kind];
  const rows = await appDb()<{ blocked: boolean }[]>`
    select app_attempts_blocked(${kind}, ${key}, ${ip}, ${rule.minutes}, ${rule.perKey}, ${rule.perIp}) as blocked
  `;
  return rows[0]?.blocked ?? false;
}

export async function recordAttempt(kind: AttemptKind, key: string, ip: string) {
  await appDb()`select app_attempt_record(${kind}, ${key}, ${ip})`;
}

export async function clearAttempts(kind: AttemptKind, key: string) {
  await appDb()`select app_attempts_clear(${kind}, ${key})`;
}
