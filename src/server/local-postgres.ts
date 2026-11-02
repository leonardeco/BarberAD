import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import EmbeddedPostgres from "embedded-postgres";
import { loadEnv, required } from "./env";
import { adminUrl, pgPort } from "./database-url";

loadEnv();

const dataDir = path.join(process.cwd(), "data", "db");
let cluster: EmbeddedPostgres | null = null;
let starting: Promise<void> | null = null;

async function canConnect(url: string) {
  const sql = postgres(url, { max: 1, connect_timeout: 2 });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function ensureLocalPostgres() {
  if (await canConnect(adminUrl())) return;
  if (!starting) starting = boot();
  await starting;
}

async function boot() {
  cluster = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: pgPort(),
    user: "postgres",
    password: required("PG_SUPER_PASSWORD"),
    persistent: true,
    onLog: () => undefined,
    onError: (message) => console.error(message),
  });
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    await cluster.initialise();
  }
  try {
    await cluster.start();
  } catch (error) {
    if (!(await canConnect(adminUrl()))) throw error;
  }
}

export async function createDatabase(name: string) {
  if (name !== "barberad" && name !== "barberad_test") {
    throw new Error("Nombre de base no permitido.");
  }
  const sql = postgres(adminUrl(), { max: 1 });
  try {
    const found = await sql`select 1 from pg_database where datname = ${name}`;
    if (found.length === 0) {
      await sql.unsafe(`create database ${name}`);
    }
  } finally {
    await sql.end();
  }
}
