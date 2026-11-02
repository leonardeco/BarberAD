import fs from "node:fs";
import path from "node:path";

function applyFile(name: string, override: boolean) {
  const file = path.join(process.cwd(), name);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

export function loadEnv() {
  applyFile(".env.example", false);
  applyFile(".env.local", true);
}

export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en el entorno local.`);
  return value;
}
