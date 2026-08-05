"use client";

import { renderMarkdownBlocks } from "@/lib/utils/markdown";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export default function MessageBubble({
  role,
  content,
  timestamp,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`
          max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed tracking-tight
          ${
            isUser
              ? "bg-[#37352f] text-white"
              : "bg-[#f1f1ef] text-[#37352f]"
          }
        `}
      >
        {/* Markdown 渲染——支持表格、标题、有序/无序列表、代码块、引用 */}
        <div
          className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-current prose-table:text-sm"
          dangerouslySetInnerHTML={{
            __html: renderMarkdownBlocks(content),
          }}
        />
        {timestamp && (
          <div
            className={`text-[10px] mt-1 ${
              isUser ? "text-stone-400" : "text-stone-400"
            }`}
          >
            {new Date(timestamp).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </div>
  );
}
