import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { required } from "./env";
import { adminUrl, connectionOptions, remoteAdminUrl } from "./database-url";

function quoteLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function ensureRole(sql: ReturnType<typeof postgres>) {
  const password = quoteLiteral(required("PG_APP_PASSWORD"));
  await sql.unsafe(`
    do $$
    begin
      if not exists (select from pg_roles where rolname = 'barberad_app') then
        create role barberad_app login password ${password} nosuperuser nobypassrls nocreatedb;
      else
        alter role barberad_app with login password ${password} nosuperuser nobypassrls;
      end if;
    end
    $$;
  `);
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function migrate(database: "barberad" | "barberad_test", options?: { fresh?: boolean }) {
  const remote = remoteAdminUrl();
  if (remote) {
    if (options?.fresh) throw new Error("No se borra una base remota desde aquí.");
  } else {
    // El Postgres embebido solo hace falta en local; en producción ni se carga.
    const { createDatabase, ensureLocalPostgres } = await import("./local-postgres");
    await ensureLocalPostgres();
    await createDatabase(database);
  }
  const url = adminUrl(database);
  const dbName = remote ? decodeURIComponent(new URL(remote).pathname.slice(1)) : database;
  const sql = postgres(url, { max: 1, prepare: connectionOptions(url).prepare, onnotice: () => undefined });
  try {
    await ensureRole(sql);
    if (options?.fresh) {
      await sql.unsafe("drop schema if exists public cascade; create schema public;");
    }
    await sql.unsafe("create table if not exists schema_migrations (id text primary key)");
    const dir = path.join(process.cwd(), "db", "migrations");
    const files = fs.readdirSync(dir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
    for (const name of files) {
      const id = name.slice(0, 4);
      const done = await sql`select 1 from schema_migrations where id = ${id}`;
      if (done.length > 0) continue;
      console.info(`[BarberAD] Aplicando ${name}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(fs.readFileSync(path.join(dir, name), "utf8"));
        await tx`insert into schema_migrations (id) values (${id})`;
      });
    }
    await sql.unsafe(`grant connect on database ${quoteIdent(dbName)} to barberad_app`);
    await sql.unsafe("grant usage on schema public to barberad_app");
  } finally {
    await sql.end({ timeout: 2 });
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  migrate("barberad").catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
