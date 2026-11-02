import postgres from "postgres";
import { appUrl } from "./database-url";
import type { ShopContext } from "./types";

let connection: ReturnType<typeof postgres> | null = null;
let connectionUrl = "";

export function appDb() {
  const url = appUrl();
  if (!connection || connectionUrl !== url) {
    if (connection) void connection.end({ timeout: 1 });
    connection = postgres(url, { max: 10 });
    connectionUrl = url;
  }
  return connection;
}

export type ShopTx = postgres.TransactionSql;

export async function withShop<T>(ctx: ShopContext, run: (tx: ShopTx) => Promise<T>) {
  return appDb().begin(async (tx) => {
    await tx`select set_config('app.shop_id', ${ctx.shopId}, true)`;
    await tx`select set_config('app.user_id', ${ctx.userId}, true)`;
    await tx`select set_config('app.member_id', ${ctx.memberId}, true)`;
    await tx`select set_config('app.role', ${ctx.role}, true)`;
    return run(tx);
  });
}
