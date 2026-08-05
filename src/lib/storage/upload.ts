/**
 * 文件上传工具——MVP 使用本地文件系统存储
 *
 * 未来可切换到 Supabase Storage。
 */

import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { generateId } from "@/lib/utils/id";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB（Word/PDF 通常较大）
const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const TEXT_EXTENSIONS = new Set([".md", ".txt", ".markdown"]);
const DOC_EXTENSIONS = new Set([".docx", ".doc"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  fileName?: string;
  fileSize?: number;
  /** 文本类文件的内容（.md / .txt） */
  textContent?: string;
}

/**
 * 上传文件到本地存储。
 * 支持图片（PNG/JPEG/GIF/WebP/SVG）、文本文件（.md / .txt）、Word（.docx）和 PDF。
 *
 * @param file - 文件 Buffer
 * @param originalName - 原始文件名
 * @param mimeType - MIME 类型
 * @param projectId - 项目 ID（用于目录隔离）
 */
export async function uploadFile(
  file: Buffer,
  originalName: string,
  mimeType: string,
  projectId: string
): Promise<UploadResult> {
  const ext = extname(originalName).toLowerCase();

  // 1. 校验文件类型：图片、文本文件、Word、PDF
  const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
  const isText = TEXT_EXTENSIONS.has(ext);
  const isDoc = DOC_EXTENSIONS.has(ext);
  const isPdf = PDF_EXTENSIONS.has(ext);

  if (!isImage && !isText && !isDoc && !isPdf) {
    return {
      success: false,
      error: `不支持的文件类型: ${mimeType || "未知"}（${ext}）。支持: PNG, JPEG, GIF, WebP, SVG, MD, TXT, DOCX, PDF`,
    };
  }

  // 2. 校验文件大小
  if (file.length > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `文件大小 ${(file.length / 1024 / 1024).toFixed(1)}MB 超过限制（最大 10MB）`,
    };
  }

  // 3. 生成唯一文件名（保留原始扩展名）
  let safeExt = ext;
  if (!safeExt) {
    safeExt = isImage ? ".png" : isDoc ? ".docx" : isPdf ? ".pdf" : ".txt";
  }
  const fileName = `${generateId()}${safeExt}`;

  // 4. 确保目录存在
  const projectDir = join(UPLOAD_DIR, projectId);
  try {
    await mkdir(projectDir, { recursive: true });
  } catch {
    // 目录已存在
  }

  // 5. 写入文件
  const filePath = join(projectDir, fileName);
  await writeFile(filePath, file);

  // 6. 文本提取：根据文件类型选择解析方式
  let textContent: string | undefined;
  if (isText || TEXT_EXTENSIONS.has(ext)) {
    // Markdown / TXT：直接 UTF-8 解码
    try {
      textContent = file.toString("utf-8");
    } catch {
      // 编码错误，作为二进制处理
    }
  } else if (isDoc || DOC_EXTENSIONS.has(ext)) {
    // Word 文档：使用 mammoth 提取文本
    try {
      const result = await mammoth.extractRawText({ buffer: file });
      textContent = result.value;
      if (result.messages.length > 0) {
        console.warn("[upload] mammoth 警告:", result.messages);
      }
    } catch (e: any) {
      console.error("[upload] Word 解析失败:", e.message);
      // 不阻塞上传，文件仍然保存
    }
  } else if (isPdf || PDF_EXTENSIONS.has(ext)) {
    // PDF：使用 pdf-parse 提取文本
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: file });
      const result = await parser.getText();
      textContent = result.text;
    } catch (e: any) {
      console.error("[upload] PDF 解析失败:", e.message);
      // 不阻塞上传，文件仍然保存
    } finally {
      await parser?.destroy();
    }
  }

  // 7. 返回公开 URL
  const url = `/uploads/${projectId}/${fileName}`;

  return {
    success: true,
    url,
    fileName,
    fileSize: file.length,
    textContent,
  };
}
