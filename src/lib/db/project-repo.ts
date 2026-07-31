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
