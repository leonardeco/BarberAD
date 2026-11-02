import { loadEnv, required } from "./env";

loadEnv();

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
  const password = encodeURIComponent(required("PG_SUPER_PASSWORD"));
  return `postgres://postgres:${password}@127.0.0.1:${pgPort()}/${database}`;
}

export function appUrl(database = databaseName()) {
  const password = encodeURIComponent(required("PG_APP_PASSWORD"));
  return `postgres://barberad_app:${password}@127.0.0.1:${pgPort()}/${database}`;
}
