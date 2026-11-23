import { appDb } from "./db";
import { ShopError } from "./errors";
import { isAdminEmail } from "./codes";
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
};

export async function adminShops(query: string) {
  const hash = await requireHash();
  return appDb()<AdminShop[]>`
    select shop_id as "shopId", name, slug, phone, to_char(created_at at time zone 'America/Bogota', 'YYYY-MM-DD') as "createdAt",
           owner_name as "ownerName", owner_email as "ownerEmail", pro, to_char(plan_until at time zone 'America/Bogota', 'YYYY-MM-DD') as "planUntil",
           barbers, cuts30, charged30, online30,
           to_char(last_activity at time zone 'America/Bogota', 'YYYY-MM-DD') as "lastActivity"
    from app_admin_shops(${hash}, ${query.trim().slice(0, 60)})
  `;
}

export async function adminOwnerOf(shopId: string) {
  const hash = await requireHash();
  const rows = await appDb()<{ user_id: string; email: string }[]>`select * from app_admin_owner_of(${hash}, ${shopId}::uuid)`;
  return rows[0] ?? null;
}
