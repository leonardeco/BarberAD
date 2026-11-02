import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { required } from "./env";
import { adminUrl } from "./database-url";
import { createDatabase, ensureLocalPostgres } from "./local-postgres";

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

export async function migrate(database: "barberad" | "barberad_test", options?: { fresh?: boolean }) {
  await ensureLocalPostgres();
  await createDatabase(database);
  const sql = postgres(adminUrl(database), { max: 1, onnotice: () => undefined });
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
      await sql.begin(async (tx) => {
        await tx.unsafe(fs.readFileSync(path.join(dir, name), "utf8"));
        await tx`insert into schema_migrations (id) values (${id})`;
      });
    }
    await sql.unsafe(`grant connect on database ${database} to barberad_app`);
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
