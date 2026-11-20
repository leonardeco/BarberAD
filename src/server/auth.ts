import { slugify } from "./agenda";
import { appDb } from "./db";
import { clearAttempts, isBlocked, recordAttempt } from "./throttle";
import { ShopError, messageFromDatabase } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import type { ShopContext } from "./types";
import { checkCommission, checkPassword, cleanEmail, cleanName } from "./validation";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const requirePassword = checkPassword;

type MembershipRow = {
  member_id: string;
  shop_id: string;
  role: "owner" | "barber";
  display_name: string;
  commission_percent: number;
  shop_name: string;
  currency: string;
  timezone: string;
};

function toContext(userId: string, row: MembershipRow): ShopContext {
  return {
    userId,
    shopId: row.shop_id,
    memberId: row.member_id,
    role: row.role,
    displayName: row.display_name,
    commissionPercent: row.commission_percent,
    shopName: row.shop_name,
    currency: row.currency,
    timezone: row.timezone,
  };
}

async function membershipFor(userId: string) {
  const rows = await appDb()<MembershipRow[]>`
    select * from app_membership_for_user(${userId}::uuid)
  `;
  return rows[0] ?? null;
}

export async function createOwnerAccount(input: {
  email: string;
  password: string;
  ownerName: string;
  shopName: string;
  takesAppointments?: boolean;
}) {
  requirePassword(input.password);
  const email = cleanEmail(input.email);
  const ownerName = cleanName(input.ownerName, "tu nombre");
  const shopName = cleanName(input.shopName, "el nombre de la barbería");
  try {
    const rows = await appDb()<
      { user_id: string; shop_id: string; member_id: string }[]
    >`select * from app_register_owner(
      ${email}, ${await hashPassword(input.password)}, ${ownerName}, ${shopName},
      ${slugify(shopName)}, ${input.takesAppointments ?? false}
    )`;
    const row = rows[0];
    if (!row) throw new ShopError("No se pudo crear la barbería.");
    const member = await membershipFor(row.user_id);
    if (!member) throw new ShopError("No se pudo abrir la sesión de la barbería.");
    return toContext(row.user_id, member);
  } catch (error) {
    if (error instanceof ShopError) throw error;
    const message = messageFromDatabase(error);
    if (message) throw new ShopError(message);
    throw error;
  }
}

export async function addBarberAccount(
  ctx: ShopContext,
  input: { email: string; password: string; displayName: string; commissionPercent: number },
) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede dar de alta barberos.");
  requirePassword(input.password);
  checkCommission(input.commissionPercent);
  const email = cleanEmail(input.email);
  const displayName = cleanName(input.displayName, "el nombre del barbero");
  try {
    await appDb()`
      select app_add_barber(
        ${ctx.userId}::uuid,
        ${ctx.shopId}::uuid,
        ${email},
        ${await hashPassword(input.password)},
        ${displayName},
        ${input.commissionPercent}
      )
    `;
  } catch (error) {
    if (error instanceof ShopError) throw error;
    const message = messageFromDatabase(error);
    if (message) throw new ShopError(message);
    throw error;
  }
}

export async function contextForUser(userId: string) {
  const member = await membershipFor(userId);
  if (!member) return null;
  return toContext(userId, member);
}

export async function createSession(userId: string, hash: string) {
  await appDb()`select app_create_session(${userId}::uuid, ${hash})`;
}

export async function readSessionUser(hash: string) {
  const rows = await appDb()<{ app_read_session: string | null }[]>`
    select app_read_session(${hash})
  `;
  return rows[0]?.app_read_session ?? null;
}

export async function deleteSession(hash: string) {
  await appDb()`select app_delete_session(${hash})`;
}

export async function changePassword(
  ctx: ShopContext,
  input: { current: string; next: string; keepSessionHash: string },
) {
  requirePassword(input.next);
  const rows = await appDb()<{ app_password_hash_for_user: string | null }[]>`
    select app_password_hash_for_user(${ctx.userId}::uuid)
  `;
  const stored = rows[0]?.app_password_hash_for_user;
  if (!stored || !(await verifyPassword(input.current, stored))) {
    throw new ShopError("La contraseña actual no coincide.");
  }
  await appDb()`
    select app_change_password(${ctx.userId}::uuid, ${await hashPassword(input.next)}, ${input.keepSessionHash})
  `;
}

export async function createPasswordReset(email: string, hash: string) {
  const rows = await appDb()<{ app_create_password_reset: boolean }[]>`
    select app_create_password_reset(${normalizeEmail(email)}, ${hash})
  `;
  return rows[0]?.app_create_password_reset ?? false;
}

export async function resetTokenIsValid(hash: string) {
  const rows = await appDb()<{ app_reset_token_is_valid: boolean }[]>`
    select app_reset_token_is_valid(${hash})
  `;
  return rows[0]?.app_reset_token_is_valid ?? false;
}

export async function consumePasswordReset(hash: string, password: string) {
  requirePassword(password);
  const rows = await appDb()<{ app_consume_password_reset: boolean }[]>`
    select app_consume_password_reset(${hash}, ${await hashPassword(password)})
  `;
  if (!rows[0]?.app_consume_password_reset) {
    throw new ShopError("El enlace venció o ya se usó. Pide uno nuevo.");
  }
}

export async function resetMemberPassword(ctx: ShopContext, memberId: string, password: string) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede cambiar contraseñas del equipo.");
  requirePassword(password);
  try {
    await appDb()`
      select app_reset_member_password(
        ${ctx.userId}::uuid,
        ${ctx.shopId}::uuid,
        ${memberId}::uuid,
        ${await hashPassword(password)}
      )
    `;
  } catch (error) {
    const message = messageFromDatabase(error);
    if (message) throw new ShopError(message);
    throw error;
  }
}

export async function memberEmails(ctx: ShopContext) {
  if (ctx.role !== "owner") return new Map<string, string>();
  const rows = await appDb()<{ member_id: string; email: string }[]>`
    select * from app_member_emails(${ctx.userId}::uuid, ${ctx.shopId}::uuid)
  `;
  return new Map(rows.map((row) => [row.member_id, row.email]));
}

// Si el correo no existe, igual se hace el trabajo de comparar una contraseña,
// para que la demora no delate qué correos tienen cuenta.
let decoyHash: Promise<string> | null = null;

export async function authenticate(email: string, password: string, ip = "local") {
  const key = normalizeEmail(email);
  if (await isBlocked("login", key, ip)) {
    throw new ShopError("Demasiados intentos fallidos. Espera 15 minutos o recupera tu contraseña.");
  }
  const rows = await appDb()<{ user_id: string; password_hash: string }[]>`
    select * from app_find_user_by_email(${key})
  `;
  const user = rows[0];
  if (!user) {
    decoyHash ??= hashPassword("barberad-decoy");
    await verifyPassword(password.slice(0, 200), await decoyHash);
    await recordAttempt("login", key, ip);
    throw new ShopError("Correo o contraseña incorrectos.");
  }
  if (!(await verifyPassword(password.slice(0, 200), user.password_hash))) {
    await recordAttempt("login", key, ip);
    throw new ShopError("Correo o contraseña incorrectos.");
  }
  await clearAttempts("login", key);
  const member = await membershipFor(user.user_id);
  if (!member) throw new ShopError("Tu acceso a la barbería está inactivo.");
  return toContext(user.user_id, member);
}
