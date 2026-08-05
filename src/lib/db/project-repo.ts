import { db, project } from "./index";
import { eq, desc } from "drizzle-orm";
import { generateId } from "../utils/id";

export type ProjectRow = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

export async function createProject(name: string, category?: string) {
  const id = generateId();
  const now = new Date();
  await db.insert(project).values({
    id,
    name,
    category: category || "",
    createdAt: now,
    updatedAt: now,
  });
  return getProjectById(id);
}

export async function getProjectById(id: string) {
  const rows = await db.select().from(project).where(eq(project.id, id)).limit(1);
  return rows[0] || null;
}

export async function listProjects(limit = 20) {
  return db.select().from(project).orderBy(desc(project.updatedAt)).limit(limit);
}

/** 读取 Project.context（JSON 自由格式） */
export async function getProjectContext(id: string): Promise<Record<string, any> | null> {
  const p = await getProjectById(id);
  if (!p) return null;
  return (p.context as Record<string, any>) ?? null;
}

/** 更新 Project.context（部分合并） */
export async function updateProjectContext(
  id: string,
  patch: Record<string, any>
): Promise<void> {
  const p = await getProjectById(id);
  if (!p) throw new Error(`Project ${id} not found`);
  const existing = (p.context as Record<string, any>) ?? {};
  const merged = { ...existing, ...patch };
  await db
    .update(project)
    .set({ context: merged, updatedAt: new Date() })
    .where(eq(project.id, id));
}
