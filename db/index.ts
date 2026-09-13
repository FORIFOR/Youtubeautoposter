import { env } from "cloudflare:workers";
export function database(): D1Database {
  if (!env.DB) throw new Error("database_unavailable");
  return env.DB;
}
