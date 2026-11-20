import { loadEnv, required } from "./env";

loadEnv();

// En producción la base vive afuera (Neon, Supabase, RDS…): DATABASE_ADMIN_URL es el dueño de la base,
// con el que se migra, y la app entra con el rol barberad_app, que no puede saltarse la seguridad por filas.
// En local, sin esas variables, todo apunta al Postgres embebido.
export function remoteAdminUrl() {
  return process.env.DATABASE_ADMIN_URL?.trim() || null;
}

export function isRemoteDatabase() {
  return Boolean(remoteAdminUrl() || process.env.DATABASE_URL?.trim());
}

export function pgPort() {
  return Number(process.env.PG_PORT ?? "5433");
}

export function databaseName() {
  const name = process.env.PG_DATABASE ?? "barberad";
  if (name !== "barberad" && name !== "barberad_test") {
    throw new Error("La base local solo puede ser barberad o barberad_test.");
  }
  return name;
}

export function adminUrl(database = "postgres") {
  const remote = remoteAdminUrl();
  if (remote) return remote;
  const password = encodeURIComponent(required("PG_SUPER_PASSWORD"));
  return `postgres://postgres:${password}@127.0.0.1:${pgPort()}/${database}`;
}

export function appUrl(database = databaseName()) {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) return explicit;
  const remote = remoteAdminUrl();
  if (remote) {
    const url = new URL(remote);
    url.username = "barberad_app";
    url.password = encodeURIComponent(required("PG_APP_PASSWORD"));
    return url.toString();
  }
  const password = encodeURIComponent(required("PG_APP_PASSWORD"));
  return `postgres://barberad_app:${password}@127.0.0.1:${pgPort()}/${database}`;
}

// Con un pooler en modo transacción (p. ej. el host "-pooler" de Neon) no sirven las sentencias preparadas.
export function connectionOptions(url: string) {
  const pooled = process.env.PG_POOLED === "1" || /-pooler\./.test(new URL(url).hostname);
  return {
    max: Number(process.env.PG_MAX ?? (isRemoteDatabase() ? 3 : 10)),
    prepare: !pooled,
    idle_timeout: isRemoteDatabase() ? 20 : undefined,
  };
}
