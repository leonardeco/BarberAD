import { appDb } from "./db";
import { ShopError, messageFromDatabase } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import type { ShopContext } from "./types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requirePassword(password: string) {
  if (password.length < 8) {
    throw new ShopError("La contraseña debe tener al menos 8 caracteres.");
  }
}

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
}) {
  requirePassword(input.password);
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new ShopError("Escribe un correo válido.");
  try {
    const rows = await appDb()<
      { user_id: string; shop_id: string; member_id: string }[]
    >`select * from app_register_owner(${email}, ${await hashPassword(input.password)}, ${input.ownerName}, ${input.shopName})`;
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
  if (!Number.isInteger(input.commissionPercent) || input.commissionPercent < 0 || input.commissionPercent > 100) {
    throw new ShopError("La comisión debe estar entre 0 y 100.");
  }
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new ShopError("Escribe un correo válido.");
  try {
    await appDb()`
      select app_add_barber(
        ${ctx.userId}::uuid,
        ${ctx.shopId}::uuid,
        ${email},
        ${await hashPassword(input.password)},
        ${input.displayName},
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

export async function authenticate(email: string, password: string) {
  const rows = await appDb()<{ user_id: string; password_hash: string }[]>`
    select * from app_find_user_by_email(${normalizeEmail(email)})
  `;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new ShopError("Correo o contraseña incorrectos.");
  }
  const member = await membershipFor(user.user_id);
  if (!member) throw new ShopError("Tu acceso a la barbería está inactivo.");
  return toContext(user.user_id, member);
}
