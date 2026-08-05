"use client";

import { useEffect, useCallback } from "react";

interface PasteHandlerProps {
  /** 项目 ID（用于上传路由） */
  projectId: string;
  /** 是否启用粘贴上传 */
  enabled: boolean;
  /** 上传成功回调 */
  onImageUploaded: (url: string, fileName: string) => void;
  /** 上传失败回调 */
  onError?: (error: string) => void;
}

/**
 * 监听 Ctrl+V 粘贴事件，自动上传剪贴板中的图片。
 *
 * 使用场景：S1（上传品牌素材）、S7（视觉参考/mood board）。
 * 其他阶段通过 enabled=false 关闭。
 */
export default function PasteHandler({
  projectId,
  enabled,
  onImageUploaded,
  onError,
}: PasteHandlerProps) {
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!enabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        // 只处理图片
        if (!item.type.startsWith("image/")) continue;

        const blob = item.getAsFile();
        if (!blob) continue;

        // 阻止默认粘贴行为（图片将由上传流程处理）
        e.preventDefault();

        try {
          const formData = new FormData();
          formData.append("file", blob, `paste-${Date.now()}.png`);
          formData.append("projectId", projectId);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            onImageUploaded(data.url, data.fileName ?? "image.png");
          } else {
            const err = await res.json();
            onError?.(err.error ?? "上传失败");
          }
        } catch (e: any) {
          onError?.(e.message ?? "上传失败");
        }

        // 只处理第一张图片
        break;
      }
    },
    [enabled, projectId, onImageUploaded, onError]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // 无 UI——纯事件监听
  return null;
}
