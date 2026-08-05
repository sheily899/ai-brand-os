"use client";

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import type { StageStatus } from "@/lib/workflow/workflow";

interface InputAreaProps {
  onSend: (message: string, searchEnabled?: boolean) => void;
  onConverge?: () => void;
  disabled: boolean;
  stageStatus: StageStatus;
  isStreaming: boolean;
  converging?: boolean;
  stageNumber?: number;
  projectId?: string;
  /** 待插入输入框的文本（外部触发，如粘贴图片后预填） */
  pendingInsert?: string | null;
  /** pendingInsert 消费后回调 */
  onPendingInsertConsumed?: () => void;
}

function canSendMessage(status: StageStatus): boolean {
  return status === "active" || status === "draft" || status === "waiting_confirm" || status === "completed";
}

/** 图片上传：所有可对话的阶段都可用（不再限制 S1/S7） */
function canUpload(status: StageStatus): boolean {
  return status === "active" || status === "draft" || status === "waiting_confirm";
}

export default function InputArea({
  onSend,
  onConverge,
  disabled,
  stageStatus,
  isStreaming,
  converging = false,
  stageNumber = 1,
  projectId,
  pendingInsert,
  onPendingInsertConsumed,
}: InputAreaProps) {
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const canSend = canSendMessage(stageStatus) && !disabled && !isStreaming;
  const allowUpload = canUpload(stageStatus);
  /** 搜索开关仅在 active / draft / waiting_confirm 状态下可用 */
  const canToggleSearch = !disabled && !isStreaming && (
    stageStatus === "active" || stageStatus === "draft" || stageStatus === "waiting_confirm"
  );

  // 消费外部注入的待插入文本（图片粘贴后预填入输入框）
  useEffect(() => {
    if (pendingInsert) {
      setInput((prev) => prev ? `${prev} ${pendingInsert}` : pendingInsert);
      onPendingInsertConsumed?.();
      // 聚焦输入框让用户继续输入
      setTimeout(() => {
        textareaRef.current?.focus();
        handleInput();
      }, 50);
    }
  }, [pendingInsert]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !canSend) return;
    onSend(trimmed, searchEnabled);
    setInput("");
    setSearchEnabled(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSendLink = () => {
    const url = linkUrl.trim();
    if (!url || !canSend) return;
    // 带上上下文，AI 才知道要分析这个链接
    onSend(`请帮我查看并分析这个链接的内容：\n${url}`, searchEnabled);
    setLinkUrl("");
    setShowLinkInput(false);
    setSearchEnabled(false);
  };

  const handleLinkKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendLink();
    }
    if (e.key === "Escape") {
      setShowLinkInput(false);
      setLinkUrl("");
    }
  };

  // 打开链接输入框时自动聚焦
  const openLinkInput = () => {
    setShowLinkInput(true);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!projectId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.textContent) {
          // 文本类文件（.md / .txt）：直接插入文本内容
          setInput((prev) => prev ? `${prev}\n\n${data.textContent}` : data.textContent);
        } else {
          // 图片文件：插入 markdown 图片语法
          const md = `![${data.fileName ?? file.name}](${data.url})`;
          setInput((prev) => prev ? `${prev} ${md}` : md);
        }
        // 聚焦输入框
        setTimeout(() => {
          textareaRef.current?.focus();
          handleInput();
        }, 50);
      }
    } catch (e: any) {
      console.error("上传失败:", e.message);
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const statusHint = (() => {
    switch (stageStatus) {
      case "invalidated":
        return "此阶段需要重新运行才能继续对话";
      case "blocked":
        return "此阶段需要修复问题后才能继续";
      case "failed":
        return "此阶段未通过审核";
      default:
        return null;
    }
  })();

  return (
    <div className="shrink-0">
      {statusHint && (
        <p className="text-xs text-amber-600 mb-2 text-center">{statusHint}</p>
      )}
      {uploading && (
        <p className="text-xs text-stone-400 mb-1 text-center">正在上传…</p>
      )}

      {/* 隐藏的文件上传 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.md,.txt,.markdown,.docx,.doc,.pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* 链接输入弹窗 */}
      {showLinkInput && (
        <div className="mb-2 flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          <input
            ref={linkInputRef}
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="粘贴链接 URL，按 Enter 发送…"
            className="flex-1 text-sm bg-transparent border-none focus:ring-0 placeholder-stone-400 px-1 py-0.5"
          />
          <button
            onClick={handleSendLink}
            disabled={!linkUrl.trim()}
            className="text-xs px-2 py-1 rounded bg-[#37352f] text-white hover:bg-[#2b2a25] disabled:opacity-30 transition-colors"
          >
            发送
          </button>
          <button
            onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}
            className="text-stone-400 hover:text-stone-600 p-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 输入框容器——工具托盘 */}
      <div className="border border-stone-200 rounded-lg p-2 bg-white">
        {/* 文本域 */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          disabled={!canSend}
          rows={1}
          placeholder={canSend ? "输入消息... (Enter 发送，Shift+Enter 换行)" : "当前阶段不可发送消息"}
          className="w-full resize-none border-none focus:ring-0 text-sm placeholder-stone-400
            disabled:text-stone-400 min-h-[36px] max-h-[120px] bg-transparent px-1 py-1"
        />

        {/* 操作托盘 */}
        <div className="flex items-center justify-between mt-1 pt-1 border-t border-stone-100">
          {/* 左侧：附件 + 链接 + 搜索 */}
          <div className="flex items-center gap-1">
            {/* 附件按钮（上传图片） */}
            <button
              type="button"
              disabled={disabled || !allowUpload}
              onClick={() => allowUpload && fileInputRef.current?.click()}
              className={`p-1.5 rounded transition-colors ${
                allowUpload
                  ? "text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
                  : "text-stone-300 cursor-not-allowed"
              }`}
              title="上传文件（图片/文档/PDF/MD）"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* 链接按钮 */}
            <button
              type="button"
              disabled={disabled || !canSend}
              onClick={openLinkInput}
              className={`p-1.5 rounded transition-colors ${
                canSend
                  ? "text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
                  : "text-stone-300 cursor-not-allowed"
              }`}
              title="粘贴链接"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </button>

            {/* 搜索开关按钮 */}
            <button
              type="button"
              disabled={!canToggleSearch}
              onClick={() => setSearchEnabled(!searchEnabled)}
              className={`p-1.5 rounded transition-colors ${
                searchEnabled
                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                  : canToggleSearch
                    ? "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                    : "text-stone-300 cursor-not-allowed"
              }`}
              title={searchEnabled ? "联网搜索已开启，下条消息将附带搜索" : "开启联网搜索"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* 右侧：触发收束 + 发送 */}
          <div className="flex items-center gap-1.5">
            {onConverge && (
              <button
                type="button"
                onClick={onConverge}
                disabled={converging || isStreaming}
                className="px-2 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded
                  hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed
                  transition-colors"
                title="确认阶段完成，触发收束"
              >
                {converging ? "收束中…" : "触发收束"}
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend || !input.trim()}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed
                ${input.trim() && canSend
                  ? "bg-[#37352f] text-white hover:bg-[#2b2a25]"
                  : "text-stone-400 bg-stone-100"
                }`}
            >
              {isStreaming ? "…" : "发送"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
