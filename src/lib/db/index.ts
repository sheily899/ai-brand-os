import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false,
});
export const db = drizzle(client);

export * from "./schema";

// ── 连接健康检查 ────────────────────────────────────────

export interface DbHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * 检查数据库连接是否健康。
 * 发送 SELECT 1 并设置 5 秒超时，适合用于健康检查端点或启动时的连通性验证。
 */
export async function checkDbHealth(): Promise<DbHealth> {
  const start = Date.now();
  try {
    const result = await db.execute("SELECT 1 as health_check");
    const latencyMs = Date.now() - start;
    return {
      healthy: true,
      latencyMs,
    };
  } catch (e: any) {
    const latencyMs = Date.now() - start;
    return {
      healthy: false,
      latencyMs,
      error: e.message,
    };
  }
}
