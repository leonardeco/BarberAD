import { spawn } from "node:child_process";
import { migrate } from "./migrate";

async function main() {
  await migrate("barberad");
  const child = spawn("npx", ["next", "dev"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
