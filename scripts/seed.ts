/**
 * Knowledge Base Seed Script
 *
 * 读取 knowledge-docs/ 目录中的所有 .md 文件，
 * 生成 embedding 并写入 knowledge_document 表。
 *
 * 使用方式：
 *   npx tsx scripts/seed.ts
 *
 * Task 2.7：仅建管道，knowledge-docs/ 为空时不执行任何写入。
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, extname } from "path";
import { db, knowledgeDocument } from "../src/lib/db";
import { getEmbeddingProvider } from "../src/lib/knowledge/embeddings";
import { generateId } from "../src/lib/utils/id";

const DOCS_DIR = resolve(process.cwd(), "knowledge-docs");

async function main() {
  console.log("[seed] 开始知识库播种...");

  // 检查目录是否存在
  if (!existsSync(DOCS_DIR)) {
    console.log("[seed] knowledge-docs/ 目录不存在，跳过播种");
    process.exit(0);
  }

  // 读取所有 .md 文件
  const files = readdirSync(DOCS_DIR).filter(
    (f) => extname(f) === ".md" || extname(f) === ".txt"
  );

  if (files.length === 0) {
    console.log("[seed] knowledge-docs/ 为空，跳过播种");
    process.exit(0);
  }

  console.log(`[seed] 找到 ${files.length} 个文档文件`);

  const provider = getEmbeddingProvider();

  for (const file of files) {
    const filePath = resolve(DOCS_DIR, file);
    const raw = readFileSync(filePath, "utf8");

    // 跳过空文件
    if (!raw.trim()) {
      console.log(`[seed] 跳过空文件: ${file}`);
      continue;
    }

    const title = file.replace(/\.(md|txt)$/, "");
    console.log(`[seed] 处理: ${title}`);

    // 生成 embedding
    const embedding = await provider.embed(raw.slice(0, 8000));

    if (embedding.length === 0) {
      console.log(`[seed] ⚠ embedding 生成失败: ${title}，跳过`);
      continue;
    }

    // 写入数据库
    try {
      await db.insert(knowledgeDocument).values({
        id: generateId(),
        title,
        content: raw,
        sourceType: "knowledge_doc",
        embedding: embedding as any, // jsonb 列存储 number[]
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[seed] ✅ ${title}（${embedding.length} 维向量）`);
    } catch (e: any) {
      console.error(`[seed] ❌ ${title} 写入失败: ${e.message}`);
    }
  }

  console.log("[seed] 播种完成");
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed] 播种失败:", e);
  process.exit(1);
});
