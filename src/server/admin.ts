import { appDb } from "./db";
import { ShopError } from "./errors";
import { isAdminEmail, issueOwnerResetCode } from "./codes";
import { createOwnerAccount } from "./auth";
import { randomBytes } from "node:crypto";
import { cleanName } from "./validation";
import { currentSessionHash } from "./session";
import type { ShopContext } from "./types";

export type AdminState = "no" | "needs-code" | "ok";

export async function userEmail(userId: string) {
  const rows = await appDb()<{ app_email_for_user: string | null }[]>`select app_email_for_user(${userId}::uuid)`;
  return rows[0]?.app_email_for_user ?? null;
}

// ¿Es administrador esta sesión? "no" si su correo no está en ADMIN_EMAILS; "needs-code" si falta el código.
export async function adminState(ctx: ShopContext): Promise<AdminState> {
  const hash = await currentSessionHash();
  if (!hash || !process.env.ADMIN_EMAILS) return "no";
  const email = await userEmail(ctx.userId);
  if (!email || !isAdminEmail(email)) return "no";
  const rows = await appDb()<{ app_session_is_admin: boolean }[]>`select app_session_is_admin(${hash})`;
  return rows[0]?.app_session_is_admin ? "ok" : "needs-code";
}

async function requireHash() {
  const hash = await currentSessionHash();
  if (!hash) throw new ShopError("Tu sesión venció.");
  return hash;
}

export type Bucket = { cuts: number; charged: number; tips: number; teamCommission: number };

export type Overview = {
  shops: { total: number; new7: number; new30: number; active7: number; active30: number; pro: number; proExpiring7: number };
  users: { total: number; barbers: number; google: number };
  sales: { today: Bucket; last7: Bucket; last30: Bucket };
  appointments: { total30: number; done30: number; noShow30: number; cancelled30: number; cancelledByClient30: number; online30: number };
  billing: { approved: number; pending: number; revenueTotal: number; revenue30: number };
  funnel: { registered: number; withServices: number; withTeam: number; withBooking: number; withCheckout: number };
  series: { day: string; signups: number; cuts: number; charged: number; bookings: number }[];
};

export async function adminOverview() {
  const hash = await requireHash();
  const rows = await appDb()<{ app_admin_overview: Overview }[]>`select app_admin_overview(${hash})`;
  return rows[0].app_admin_overview;
}

export type AdminShop = {
  shopId: string;
  name: string;
  slug: string;
  phone: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  pro: boolean;
  planUntil: string | null;
  barbers: number;
  cuts30: number;
  charged30: number;
  online30: number;
  lastActivity: string | null;
  grants: number;
  grantedMonths: number;
};

export async function adminShops(query: string) {
  const hash = await requireHash();
  const [shops, grants] = await Promise.all([
    appDb()<Omit<AdminShop, "grants" | "grantedMonths">[]>`
      select shop_id as "shopId", name, slug, phone, to_char(created_at at time zone 'America/Bogota', 'YYYY-MM-DD') as "createdAt",
             owner_name as "ownerName", owner_email as "ownerEmail", pro, to_char(plan_until at time zone 'America/Bogota', 'YYYY-MM-DD') as "planUntil",
             barbers, cuts30, charged30, online30,
             to_char(last_activity at time zone 'America/Bogota', 'YYYY-MM-DD') as "lastActivity"
      from app_admin_shops(${hash}, ${query.trim().slice(0, 60)})
    `,
    appDb()<{ shop_id: string; grants: number; months: number }[]>`select * from app_admin_grants(${hash})`,
  ]);
  const byShop = new Map(grants.map((row) => [row.shop_id, row]));
  return shops.map((shop) => ({ ...shop, grants: byShop.get(shop.shopId)?.grants ?? 0, grantedMonths: byShop.get(shop.shopId)?.months ?? 0 }));
}

export const COURTESY_MONTHS = [1, 3, 6, 12] as const;

function checkMonths(months: number) {
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new ShopError("Los meses de cortesía van de 1 a 24.");
  return months;
}

async function grant(shopId: string, months: number, note: string, adminUserId: string) {
  const hash = await requireHash();
  const rows = await appDb()<{ app_admin_grant_pro: Date }[]>`
    select app_admin_grant_pro(${hash}, ${shopId}::uuid, ${months}, ${note.trim().slice(0, 200)}, ${adminUserId}::uuid)
  `;
  return rows[0].app_admin_grant_pro;
}

// Regala meses de plan Pro a una barbería que ya existe. Se suman al tiempo que le quede.
export async function grantPro(ctx: ShopContext, shopId: string, months: number, note: string) {
  if ((await adminState(ctx)) !== "ok") throw new ShopError("Verifica tu código de administrador primero.");
  const until = await grant(shopId, checkMonths(months), note, ctx.userId);
  return until.toISOString().slice(0, 10);
}

// Crea la barbería y la cuenta del dueño, con Pro de cortesía. El dueño entra con un código de 4 números
// (el mismo de "Recuperar contraseña") para crear su propia contraseña.
export async function createCourtesyShop(
  ctx: ShopContext,
  input: { ownerName: string; shopName: string; email: string; phone: string; months: number; note: string },
) {
  if ((await adminState(ctx)) !== "ok") throw new ShopError("Verifica tu código de administrador primero.");
  const months = checkMonths(input.months);
  cleanName(input.ownerName, "el nombre del dueño");
  const owner = await createOwnerAccount({
    ownerName: input.ownerName,
    shopName: input.shopName,
    email: input.email,
    phone: input.phone,
    takesAppointments: true,
    // Contraseña al azar que nadie conoce: el dueño crea la suya con el código.
    password: randomBytes(32).toString("base64url"),
  });
  const until = await grant(owner.shopId, months, input.note || "Cuenta de cortesía", ctx.userId);
  const code = await issueOwnerResetCode(owner.userId);
  return { email: input.email.trim().toLowerCase(), code, until: until.toISOString().slice(0, 10) };
}

export async function adminOwnerOf(shopId: string) {
  const hash = await requireHash();
  const rows = await appDb()<{ user_id: string; email: string }[]>`select * from app_admin_owner_of(${hash}, ${shopId}::uuid)`;
  return rows[0] ?? null;
}
