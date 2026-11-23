import { randomInt } from "node:crypto";
import { appDb } from "./db";
import { ShopError } from "./errors";
import { hashPassword } from "./password";
import { sendCodeEmail } from "./mail";
import { clearAttempts, isBlocked, recordAttempt } from "./throttle";
import { tokenHash } from "./token";
import { checkPassword } from "./validation";

export const CODE_MINUTES = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// ---------- Quién es administrador ----------
// Los correos salen de variables de entorno, no del código: el repositorio es público.

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(normalizeEmail(email));
}

// Aquí llegan los códigos del administrador: los suyos y los de su propia recuperación.
export function adminRecoveryEmail() {
  return process.env.ADMIN_RECOVERY_EMAIL?.trim().toLowerCase() || null;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

// ---------- Códigos de 4 dígitos ----------

function newCode() {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

function codeHash(userId: string, purpose: "reset" | "admin", code: string) {
  return tokenHash(`code:${purpose}:${userId}:${code}`);
}

async function userByEmail(email: string) {
  const rows = await appDb()<{ user_id: string }[]>`select user_id from app_find_user_by_email(${normalizeEmail(email)})`;
  return rows[0]?.user_id ?? null;
}

async function issue(userId: string, purpose: "reset" | "admin", issuedBy: "self" | "admin") {
  const code = newCode();
  await appDb()`select app_issue_code(${userId}::uuid, ${purpose}, ${codeHash(userId, purpose, code)}, ${CODE_MINUTES}, ${issuedBy})`;
  return code;
}

// Recuperar contraseña: el código llega al correo de la cuenta. Si es la cuenta del administrador,
// llega al correo de recuperación del administrador. Sin importar si la cuenta existe, la respuesta es la misma.
export async function requestResetCode(email: string, ip: string) {
  const key = normalizeEmail(email);
  if (await isBlocked("reset", key, ip)) return;
  await recordAttempt("reset", key, ip);
  const userId = await userByEmail(key);
  if (!userId) return;
  const destination = isAdminEmail(key) ? (adminRecoveryEmail() ?? key) : key;
  const code = await issue(userId, "reset", "self");
  await sendCodeEmail(destination, code, "reset");
}

const messages: Record<string, string> = {
  wrong: "Ese código no es correcto.",
  locked: "Demasiados intentos con ese código. Pide uno nuevo.",
  expired: "El código venció. Pide uno nuevo.",
  none: "No hay un código activo. Pide uno nuevo.",
};

export async function resetWithCode(email: string, code: string, password: string, ip: string) {
  checkPassword(password);
  const key = normalizeEmail(email);
  if (!/^\d{4}$/.test(code.trim())) throw new ShopError("El código tiene 4 números.");
  if (await isBlocked("code", key, ip)) throw new ShopError("Demasiados intentos. Espera 15 minutos.");
  const userId = await userByEmail(key);
  if (!userId) {
    await recordAttempt("code", key, ip);
    throw new ShopError(messages.none);
  }
  const rows = await appDb()<{ app_reset_with_code: string }[]>`
    select app_reset_with_code(${userId}::uuid, ${codeHash(userId, "reset", code.trim())}, ${await hashPassword(password)})
  `;
  const result = rows[0]?.app_reset_with_code ?? "none";
  if (result !== "ok") {
    await recordAttempt("code", key, ip);
    throw new ShopError(messages[result] ?? messages.none);
  }
  await clearAttempts("code", key);
}

// El administrador le da a un dueño su código de recuperación (soporte). El código se le muestra al administrador.
export async function issueOwnerResetCode(userId: string) {
  return issue(userId, "reset", "admin");
}

// ---------- Panel de administrador: segundo paso con código ----------

export async function sendAdminCode(userId: string, email: string) {
  if (!isAdminEmail(email)) throw new ShopError("Esta cuenta no es de administrador.");
  const destination = adminRecoveryEmail();
  if (!destination) throw new ShopError("Falta configurar ADMIN_RECOVERY_EMAIL, el correo donde llega el código.");
  if (await isBlocked("reset", `admin:${userId}`, "admin")) {
    throw new ShopError("Ya pediste varios códigos. Espera un rato.");
  }
  await recordAttempt("reset", `admin:${userId}`, "admin");
  const code = await issue(userId, "admin", "self");
  await sendCodeEmail(destination, code, "admin");
  return maskEmail(destination);
}

export async function verifyAdminCode(sessionHash: string, userId: string, code: string, ip: string) {
  if (!/^\d{4}$/.test(code.trim())) throw new ShopError("El código tiene 4 números.");
  const key = `admin:${userId}`;
  if (await isBlocked("code", key, ip)) throw new ShopError("Demasiados intentos. Espera 15 minutos.");
  const rows = await appDb()<{ app_admin_verify: string }[]>`
    select app_admin_verify(${sessionHash}, ${userId}::uuid, ${codeHash(userId, "admin", code.trim())}, 8)
  `;
  const result = rows[0]?.app_admin_verify ?? "none";
  if (result !== "ok") {
    await recordAttempt("code", key, ip);
    throw new ShopError(messages[result] ?? messages.none);
  }
  await clearAttempts("code", key);
}
