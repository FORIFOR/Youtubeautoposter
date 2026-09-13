import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
let config;
try { config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8")); } catch { throw new Error("先に npm run build を実行してください。"); }
await mkdir(".wrangler", { recursive: true });
const local = { name: "growth-studio-migrations", compatibility_date: "2026-05-15", d1_databases: config.d1_databases.map(db => ({ ...db, migrations_dir: resolve("drizzle") })) };
await writeFile(".wrangler/migrations.json", JSON.stringify(local));
const result = spawnSync(process.execPath, ["--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", "d1", "migrations", "apply", "DB", "--local", "--config", ".wrangler/migrations.json", "--persist-to", ".wrangler/state"], { stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" } });
process.exitCode = result.status ?? 1;
