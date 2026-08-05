"use client";

import { useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import InputArea from "./InputArea";
import { renderMarkdownBlocks } from "@/lib/utils/markdown";
import type { StageStatus } from "@/lib/workflow/workflow";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ChatAreaProps {
  stageNumber: number;
  stageName: string;
  stageStatus: StageStatus;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  onSend: (message: string, searchEnabled?: boolean) => void;
  onConverge?: () => void;
  converging?: boolean;
  projectId?: string;
  /** 待插入输入框的文本（图片粘贴后不自动发送，而是预填入输入框） */
  pendingInsert?: string | null;
  /** pendingInsert 消费后的回调 */
  onPendingInsertConsumed?: () => void;
}

export default function ChatArea({
  stageNumber,
  stageName,
  stageStatus,
  messages,
  isStreaming,
  streamingContent,
  onSend,
  onConverge,
  converging = false,
  projectId,
  pendingInsert,
  onPendingInsertConsumed,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white">
      {/* 当前阶段指示 */}
      <div className="px-5 py-3 border-b border-stone-100 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-stone-400 tabular-nums">
            S{stageNumber}
          </span>
          <h2 className="text-sm font-semibold text-[#37352f]">
            {stageName}
          </h2>
        </div>
      </div>

      {/* 对话区 */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-stone-500">AI 品牌策略师已就绪</p>
              <p className="text-xs text-stone-300 mt-1">
                发送第一条消息开始 S{stageNumber} 的咨询
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-5 py-4 space-y-1">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}

            {/* 流式接收中的临时气泡 */}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed tracking-tight bg-[#f1f1ef] text-[#37352f]">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownBlocks(streamingContent),
                    }}
                  />
                  <span className="inline-block w-1.5 h-4 bg-stone-400 animate-pulse ml-0.5 align-middle" />
                </div>
              </div>
            )}

            {/* 等待第一个 token */}
            {isStreaming && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-[#f1f1ef] rounded-lg px-4 py-2.5">
                  <span className="inline-block w-1.5 h-4 bg-stone-400 animate-pulse" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="max-w-5xl mx-auto w-full px-5 pb-4 shrink-0">
        <InputArea
          onSend={onSend}
          onConverge={onConverge}
          disabled={false}
          stageStatus={stageStatus}
          isStreaming={isStreaming}
          converging={converging}
          stageNumber={stageNumber}
          projectId={projectId}
          pendingInsert={pendingInsert}
          onPendingInsertConsumed={onPendingInsertConsumed}
        />
      </div>
    </div>
  );
}
