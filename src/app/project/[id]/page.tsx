"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import TopBar from "@/components/workspace/TopBar";
import StageSidebar from "@/components/workspace/StageSidebar";
import ChatArea from "@/components/workspace/ChatArea";
import AuditPanel from "@/components/audit/AuditPanel";
import OptimizeCompleteCard from "@/components/audit/OptimizeCompleteCard";
import BacktrackDialog from "@/components/workspace/BacktrackDialog";
import PasteHandler from "@/components/upload/PasteHandler";
import { getStageName, STAGE_META } from "@/lib/stage-config";
import { getAllDownstream } from "@/lib/memory/dependency-graph";
import { displayFieldName } from "@/lib/audit/field-display";
import type { StageStatus } from "@/lib/workflow/workflow";
import type { AuditReport, GateDecision } from "@/lib/audit/audit-engine";

// ── 类型 ──────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface StageSummary {
  number: number;
  status: StageStatus;
  finalGateDecision?: string | null;
}

interface ProjectInfo {
  id: string;
  name: string;
  category?: string;
}

interface StageData {
  status: StageStatus;
  stageNumber: number;
  stageName: string;
  goal: string;
  messages: Message[];
  output: Record<string, any> | null;
  auditResult: AuditReport | null;
  searchContext?: string | null;
  progress: {
    roundCount: number;
    hasOutput: boolean;
    hasAudit: boolean;
    isComplete: boolean;
  };
  updatedAt?: string | null;
}

// ── 页面组件 ──────────────────────────────────────────

export default function WorkspacePage() {
  const params = useParams();
  const projectId = params.id as string;

  // 项目 + 阶段列表
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [stages, setStages] = useState<StageSummary[]>([]);
  const [allComplete, setAllComplete] = useState(false);

  // 当前激活阶段
  const [activeStage, setActiveStage] = useState(1);
  const [stageData, setStageData] = useState<StageData | null>(null);
  const [loading, setLoading] = useState(true);

  // SSE 流式状态
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Audit / Converge 状态
  const [converging, setConverging] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [gateDecision, setGateDecision] = useState<GateDecision | null>(null);
  const [optimizeComplete, setOptimizeComplete] = useState(false);
  const [optimizedOutput, setOptimizedOutput] = useState<Record<string, any> | null>(null);
  const [savedOutput, setSavedOutput] = useState<Record<string, any> | null>(null);

  // 回溯确认弹窗
  // 待插入输入框的图片 markdown（粘贴/上传后插入而非自动发送）
  const [pendingImageMd, setPendingImageMd] = useState<string | null>(null);

  const [backtrackDialog, setBacktrackDialog] = useState<{
    stage: number;
    field?: string;
    stageName: string;
    affectedStages: { number: number; name: string }[];
  } | null>(null);

  // 缓存已加载的阶段数据
  const stageCache = useRef<Map<number, StageData>>(new Map());

  // ── 切换阶段时重置审计状态 ────────────────────────

  useEffect(() => {
    setAuditReport(null);
    setGateDecision(null);
    setOptimizeComplete(false);
    setOptimizedOutput(null);
    setSavedOutput(null);
    setConverging(false);
  }, [activeStage]);

  // ── 初始化（项目 + 阶段列表 + 当前阶段数据，一次完成）──

  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsStreaming(false);
      setStreamingContent("");
    }

    async function init() {
      try {
        // Step 1: 并行加载项目信息 + 阶段列表
        const [projRes, stagesRes] = await Promise.all([
          fetch(`/api/project/${projectId}`, { cache: "no-store" }),
          fetch(`/api/project/${projectId}/stages`, { cache: "no-store" }),
        ]);

        let proj: any = null;
        let stagesData: any = null;
        let defaultStage = 1;

        if (projRes.ok) proj = await projRes.json();
        if (stagesRes.ok) {
          stagesData = await stagesRes.json();
          defaultStage = stagesData.activeStage ?? 1;
        }

        // Step 2: 加载当前阶段数据
        const cached = stageCache.current.get(defaultStage);
        let stageData: StageData | null = null;
        if (cached && cached.status !== "invalidated") {
          stageData = cached;
        } else {
          const stageRes = await fetch(`/api/project/${projectId}/stage/${defaultStage}`);
          if (stageRes.ok) {
            stageData = await stageRes.json();
            if (stageData && stageData.status !== "active" && stageData.status !== "draft") {
              stageCache.current.set(defaultStage, stageData);
            }
          }
        }

        // Step 3: 一次性设置所有状态，只触发一次渲染
        if (proj) setProject({ id: proj.id, name: proj.name, category: proj.category });
        if (stagesData) {
          setStages(stagesData.stages);
          setAllComplete(stagesData.allComplete);
        }
        if (stageData) {
          setStageData(stageData);
          if (stageData.auditResult) {
            setAuditReport(stageData.auditResult);
            setGateDecision(stageData.auditResult.gateDecision);
          }
        }
        setActiveStage(defaultStage);
      } catch (e) {
        console.error("初始化失败:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId]);

  // ── 切换阶段 ──────────────────────────────────────

  const handleStageSelect = useCallback(
    async (stage: number) => {
      if (stage === activeStage) return;

      // 取消进行中的流式请求
      if (abortRef.current) {
        abortRef.current.abort();
        setIsStreaming(false);
        setStreamingContent("");
      }

      // 检查缓存
      const cached = stageCache.current.get(stage);
      if (cached && cached.status !== "invalidated") {
        setStageData(cached);
        if (cached.auditResult) {
          setAuditReport(cached.auditResult);
          setGateDecision(cached.auditResult.gateDecision);
        }
        setActiveStage(stage);
        return;
      }

      setStageData(null);
      setActiveStage(stage);

      try {
        const res = await fetch(`/api/project/${projectId}/stage/${stage}`);
        if (res.ok) {
          const data: StageData = await res.json();
          setStageData(data);
          if (data.status !== "active" && data.status !== "draft") {
            stageCache.current.set(stage, data);
          }
          if (data.auditResult) {
            setAuditReport(data.auditResult);
            setGateDecision(data.auditResult.gateDecision);
          }
        }
      } catch (e) {
        console.error("加载阶段数据失败:", e);
      }
    },
    [activeStage, projectId]
  );

  // ── 话题级回溯 ────────────────────────────────────

  /** 第一步：弹窗确认 —— 计算下游影响范围，让用户确认 */
  const handleBacktrack = useCallback(
    (stage: number, field?: string) => {
      if (!projectId || isStreaming) return;

      const downstream = getAllDownstream(stage);
      const affectedStages = downstream.map((n) => ({
        number: n,
        name: STAGE_META[n]?.name ?? `阶段 ${n}`,
      }));

      setBacktrackDialog({
        stage,
        field,
        stageName: STAGE_META[stage]?.name ?? `阶段 ${stage}`,
        affectedStages,
      });
    },
    [projectId, isStreaming]
  );

  /** 第二步：用户确认后执行实际回溯 */
  const executeBacktrack = useCallback(async () => {
    if (!backtrackDialog) return;

    const { stage, field } = backtrackDialog;
    setBacktrackDialog(null);

    setIsStreaming(true);
    setStreamingContent(`正在回到 S${stage}…`);

    try {
      const res = await fetch(
        `/api/project/${projectId}/stage/${stage}/backtrack`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        // 清除目标阶段和所有失效阶段的缓存
        stageCache.current.delete(stage);
        for (const ds of data.invalidatedStages ?? []) {
          stageCache.current.delete(ds.number);
        }

        await refreshStages();
        // 加载回溯后的阶段数据（保留的对话 + 输出）
        const stageRes = await fetch(`/api/project/${projectId}/stage/${stage}`);
        if (stageRes.ok) setStageData(await stageRes.json());
        setActiveStage(stage);
        setStreamingContent("");
      } else {
        const err = await res.json();
        setStreamingContent(`（回溯失败: ${err.error}）`);
      }
    } catch (e: any) {
      setStreamingContent(`（错误: ${e.message}）`);
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, isStreaming, backtrackDialog]);

  // ── 发送消息（SSE 流式） ─────────────────────────

  const handleSendMessage = useCallback(
    async (message: string, searchEnabled?: boolean) => {
      if (!projectId || isStreaming) return;

      const userMsg: Message = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      setStageData((prev) =>
        prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev
      );

      setIsStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/project/${projectId}/stage/${activeStage}/message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, searchEnabled: searchEnabled ?? false }),
            signal: controller.signal,
          }
        );

        if (res.status === 403) {
          setStreamingContent("（当前阶段不可发送消息）");
          setIsStreaming(false);
          stageCache.current.delete(activeStage);
          const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
          if (stageRes.ok) setStageData(await stageRes.json());
          return;
        }

        if (res.status === 409) {
          setStreamingContent("（此阶段的上游决策已变更，请先重新运行此阶段）");
          setIsStreaming(false);
          stageCache.current.delete(activeStage);
          const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
          if (stageRes.ok) setStageData(await stageRes.json());
          refreshStages();
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无响应流");

        const decoder = new TextDecoder();
        let fullResponse = "";
        let leftover = ""; // 跨 chunk 行缓冲：上一個 chunk 未完成的行

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // 将 leftover 与当前 chunk 拼接，避免 SSE 事件被 TCP 分片截断
          const combined = leftover + chunk;
          const lines = combined.split("\n");
          // 最后一行可能不完整（chunk 在此处截断）→ 保留到下一次循环
          leftover = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullResponse += data.content;
                  setStreamingContent(fullResponse);
                }
                if (data.done) {
                  // ── 确认完成事件：阶段已自动完成 ──────────
                  if (data.confirmed) {
                    if (data.success && data.advanced && data.nextStage) {
                      // 阶段完成并推进
                      stageCache.current.delete(activeStage);
                      if (data.auditReport) {
                        setAuditReport(data.auditReport);
                        setGateDecision(data.gateDecision ?? null);
                      }
                      setStreamingContent("");
                      setIsStreaming(false);
                      await refreshStages();
                      stageCache.current.delete(data.nextStage);
                      const nextRes = await fetch(
                        `/api/project/${projectId}/stage/${data.nextStage}`
                      );
                      if (nextRes.ok) {
                        setStageData(await nextRes.json());
                      }
                      setActiveStage(data.nextStage);
                    } else if (data.success && !data.advanced) {
                      // 阶段完成但未推进（reoptimize/block）
                      if (data.auditReport) {
                        setAuditReport(data.auditReport);
                        setGateDecision(data.gateDecision ?? null);
                      }
                      setStreamingContent("");
                      setIsStreaming(false);
                      stageCache.current.delete(activeStage);
                      const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
                      if (stageRes.ok) setStageData(await stageRes.json());
                      await refreshStages();
                    } else {
                      // 确认失败（success=false）—— 尝试从 DB 恢复最新状态
                      setStreamingContent(`（确认失败: ${data.errors?.join("; ") ?? "未知错误"}）`);
                      setIsStreaming(false);
                      stageCache.current.delete(activeStage);
                      try {
                        const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
                        if (stageRes.ok) {
                          const fresh = await stageRes.json();
                          setStageData(fresh);
                          if (fresh.auditResult) {
                            setAuditReport(fresh.auditResult);
                            setGateDecision(fresh.auditResult.gateDecision);
                          }
                        }
                        await refreshStages();
                      } catch { /* 静默失败 */ }
                    }
                    return; // 不执行下面的普通消息处理
                  }

                  // ── 修改/拒绝事件：回到咨询模式 ──────────
                  if (data.intent === "modify" || data.intent === "reject") {
                    setStreamingContent("");
                    setIsStreaming(false);
                    stageCache.current.delete(activeStage);
                    const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
                    if (stageRes.ok) setStageData(await stageRes.json());
                    await refreshStages();
                    return;
                  }

                  // ── 普通消息 ──────────────────────────
                  const aiMsg: Message = {
                    role: "assistant",
                    content: data.fullResponse ?? fullResponse,
                    timestamp: new Date().toISOString(),
                  };
                  setStageData((prev) =>
                    prev
                      ? { ...prev, messages: [...prev.messages, aiMsg], progress: { ...prev.progress, roundCount: prev.progress.roundCount + 1 } }
                      : prev
                  );
                  setStreamingContent("");
                  setIsStreaming(false);
                }
                if (data.error) {
                  setStreamingContent(`（错误: ${data.error}）`);
                  setIsStreaming(false);
                  // 刷新状态以同步 DB 中的真实状态（异常可能已部分写入）
                  stageCache.current.delete(activeStage);
                  try {
                    const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
                    if (stageRes.ok) {
                      const fresh = await stageRes.json();
                      setStageData(fresh);
                      if (fresh.auditResult) {
                        setAuditReport(fresh.auditResult);
                        setGateDecision(fresh.auditResult.gateDecision);
                      }
                    }
                    await refreshStages();
                  } catch { /* 静默失败 */ }
                }
              } catch { /* 非 JSON 行 */ }
            }
          }
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error("SSE 错误:", e);
          setStreamingContent("（连接中断，请刷新页面后重试）");
        }
        setIsStreaming(false);
      }
    },
    [projectId, activeStage, isStreaming]
  );

  // ── 触发收束 ──────────────────────────────────────
  // 统一使用 /confirm 端点（与内联确认走同一套 confirmAndCompleteStage 管道）

  const handleConverge = useCallback(async () => {
    if (!projectId || converging) return;

    setConverging(true);
    setStreamingContent("正在收束阶段对话…");

    try {
      const res = await fetch(
        `/api/project/${projectId}/stage/${activeStage}/confirm`,
        { method: "POST" }
      );

      if (!res.ok) {
        const err = await res.json();
        setStreamingContent(`（收束失败: ${err.error}）`);
        setConverging(false);
        // 即使失败也尝试刷新 DB 状态
        stageCache.current.delete(activeStage);
        try {
          const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
          if (stageRes.ok) {
            const fresh = await stageRes.json();
            setStageData(fresh);
            if (fresh.auditResult) {
              setAuditReport(fresh.auditResult);
              setGateDecision(fresh.auditResult.gateDecision);
            }
          }
          await refreshStages();
        } catch { /* 静默 */ }
        return;
      }

      const data = await res.json();
      setStreamingContent("");

      // 清除当前阶段缓存
      stageCache.current.delete(activeStage);

      // 刷新当前阶段数据
      const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
      if (stageRes.ok) {
        const stageData = await stageRes.json();
        setStageData(stageData);
      }

      // 显示审计结果
      if (data.auditReport) {
        setAuditReport(data.auditReport);
        setGateDecision(data.gateDecision);
      }

      // 自动跳转到下一阶段
      if (data.advanced && data.nextStage) {
        await refreshStages();
        stageCache.current.delete(data.nextStage);
        const nextRes = await fetch(
          `/api/project/${projectId}/stage/${data.nextStage}`
        );
        if (nextRes.ok) {
          setStageData(await nextRes.json());
        }
        setActiveStage(data.nextStage);
      } else {
        // 未推进（reoptimize/block）—— 刷新阶段列表显示审计面板
        await refreshStages();
      }
    } catch (e: any) {
      console.error("收束失败:", e);
      setStreamingContent(`（收束过程出错: ${e.message}）`);
    } finally {
      setConverging(false);
    }
  }, [projectId, activeStage, converging]);

  // ── 智能优化 ──────────────────────────────────────

  const handleSmartOptimize = useCallback(async () => {
    if (!projectId || isStreaming) return;

    setSavedOutput(stageData?.output ?? null);
    setIsStreaming(true);
    setStreamingContent("正在智能优化…");

    try {
      const res = await fetch(
        `/api/project/${projectId}/stage/${activeStage}/optimize`,
        { method: "POST" }
      );

      if (res.ok) {
        const data = await res.json();

        if (data.success) {
          // 刷新阶段数据（包含新的优化总结消息）
          stageCache.current.delete(activeStage);
          const stageRes = await fetch(`/api/project/${projectId}/stage/${activeStage}`);
          if (stageRes.ok) setStageData(await stageRes.json());

          // 展示优化完成状态 — Audit 将在用户确认后由 confirmAndCompleteStage 执行
          setOptimizedOutput(data.output ?? null);
          setOptimizeComplete(true);
          setStreamingContent("");
        } else {
          setStreamingContent(`（智能优化失败: ${data.error || "未知错误"}）`);
        }
      } else {
        const err = await res.json();
        setStreamingContent(`（智能优化失败: ${err.error}）`);
      }
    } catch (e: any) {
      setStreamingContent(`（错误: ${e.message}）`);
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, activeStage, isStreaming, stageData]);

  // ── 确认优化版本 ──────────────────────────────────

  const handleConfirmVersion = useCallback(async () => {
    if (!projectId) return;

    setIsStreaming(true);
    try {
      const res = await fetch(
        `/api/project/${projectId}/stage/${activeStage}/force-advance`,
        { method: "POST" }
      );

      if (res.ok) {
        const data = await res.json();
        setOptimizeComplete(false);
        setOptimizedOutput(null);
        setSavedOutput(null);
        setAuditReport(null);
        await refreshStages();

        if (data.nextStage) {
          stageCache.current.delete(data.nextStage);
          const nextRes = await fetch(
            `/api/project/${projectId}/stage/${data.nextStage}`
          );
          if (nextRes.ok) {
            setStageData(await nextRes.json());
          }
          setActiveStage(data.nextStage);
        }
      } else {
        const err = await res.json();
        setStreamingContent(`（确认失败: ${err.error}）`);
      }
    } catch (e: any) {
      setStreamingContent(`（错误: ${e.message}）`);
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, activeStage]);

  // ── 确定当前方案（优化后）──────────────────────────

  const handleConfirmCurrent = useCallback(async () => {
    if (!projectId) return;

    setIsStreaming(true);
    setStreamingContent("正在提交…");

    try {
      const res = await fetch(
        `/api/project/${projectId}/stage/${activeStage}/force-advance`,
        { method: "POST" }
      );

      if (res.ok) {
        const data = await res.json();
        setOptimizeComplete(false);
        setOptimizedOutput(null);
        setSavedOutput(null);
        setAuditReport(null);
        setGateDecision(null);
        setStreamingContent("");
        await refreshStages();

        if (data.nextStage) {
          stageCache.current.delete(data.nextStage);
          const nextRes = await fetch(
            `/api/project/${projectId}/stage/${data.nextStage}`
          );
          if (nextRes.ok) {
            setStageData(await nextRes.json());
          }
          setActiveStage(data.nextStage);
        }
      } else {
        const err = await res.json();
        setStreamingContent(`（提交失败: ${err.error}）`);
      }
    } catch (e: any) {
      setStreamingContent(`（错误: ${e.message}）`);
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, activeStage]);

  // ── 保持当前决策 ──────────────────────────────────

  const handleKeepCurrent = useCallback(async () => {
    if (!projectId) return;

    setIsStreaming(true);
    setStreamingContent("正在推进…");

    try {
      const res = await fetch(
        `/api/project/${projectId}/stage/${activeStage}/force-advance`,
        { method: "POST" }
      );

      if (res.ok) {
        const data = await res.json();
        setAuditReport(null);
        setGateDecision(null);
        setStreamingContent("");
        await refreshStages();

        if (data.nextStage) {
          stageCache.current.delete(data.nextStage);
          // 加载下一阶段数据（含刚持久化的 AI 开场消息）
          const nextRes = await fetch(
            `/api/project/${projectId}/stage/${data.nextStage}`
          );
          if (nextRes.ok) {
            setStageData(await nextRes.json());
          }
          setActiveStage(data.nextStage);
        }
      } else {
        const err = await res.json();
        setStreamingContent(`（推进失败: ${err.error}）`);
      }
    } catch (e: any) {
      setStreamingContent(`（错误: ${e.message}）`);
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, activeStage]);

  const handleRollback = useCallback(async () => {
    if (!projectId || !savedOutput) return;

    setIsStreaming(true);
    try {
      const res = await fetch(
        `/api/project/${projectId}/stage/${activeStage}/rollback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originalOutput: savedOutput }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setOptimizeComplete(false);
        setOptimizedOutput(null);
        setSavedOutput(null);
        // 更新为回退后的数据（含新审计结果）
        setStageData((prev) =>
          prev ? { ...prev, output: data.output } : prev
        );
        if (data.auditReport) {
          setAuditReport(data.auditReport);
          setGateDecision(data.gateDecision);
        }
        // 刷新缓存
        stageCache.current.delete(activeStage);
      } else {
        const err = await res.json();
        setStreamingContent(`（回退失败: ${err.error}）`);
      }
    } catch (e: any) {
      setStreamingContent(`（回退错误: ${e.message}）`);
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, activeStage, savedOutput]);

  // ── 图片上传 ──────────────────────────────────────

  const handleImageUploaded = useCallback(
    (url: string, fileName: string) => {
      // 不再自动发送——将图片 markdown 插入输入框，让用户可添加文字描述
      setPendingImageMd(`![${fileName}](${url})`);
    },
    []
  );

  // ── 刷新阶段列表 ──────────────────────────────────

  const refreshStages = useCallback(async () => {
    try {
      const res = await fetch(`/api/project/${projectId}/stages`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages);
        setAllComplete(data.allComplete);
      }
    } catch (e) {
      console.error("刷新阶段列表失败:", e);
    }
  }, [projectId]);

  // ── 状态轮询兜底（streaming/converging 期间每 5s 静默刷新阶段列表）──
  useEffect(() => {
    if (!projectId) return;
    if (!isStreaming && !converging) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/project/${projectId}/stages`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setStages(data.stages);
          setAllComplete(data.allComplete);
        }
      } catch { /* 静默失败，避免刷屏 */ }
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId, isStreaming, converging]);

  // ── 页面可见性恢复刷新（用户切回标签页时同步 DB 状态）──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && projectId) {
        // 静默刷新阶段列表
        fetch(`/api/project/${projectId}/stages`, { cache: "no-store" })
          .then((r) => r.ok && r.json())
          .then((data) => {
            if (data) {
              setStages(data.stages);
              setAllComplete(data.allComplete);
            }
          })
          .catch(() => {});
        // 如果当前阶段可能已变更，刷新阶段数据
        if (activeStage && stageCache.current) {
          fetch(`/api/project/${projectId}/stage/${activeStage}`, { cache: "no-store" })
            .then((r) => r.ok && r.json())
            .then((data) => {
              if (data) {
                setStageData(data);
                if (data.auditResult) {
                  setAuditReport(data.auditResult);
                  setGateDecision(data.auditResult.gateDecision);
                }
              }
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [projectId, activeStage]);

  // ── 构建阶段输出 Map（供侧边栏清单使用） ───────────

  const stageOutputsMap = (() => {
    const map = new Map<number, Record<string, any>>();
    for (const [stageNum, data] of stageCache.current) {
      if (data.output) map.set(stageNum, data.output);
    }
    // 当前阶段如果有输出也加入
    if (stageData?.output) map.set(activeStage, stageData.output);
    return map;
  })();

  // ── 派生状态 ──────────────────────────────────────

  const currentStatus: StageStatus = stageData?.status ?? "draft";
  const isInvalidated = currentStatus === "invalidated";
  const canConverge =
    currentStatus === "waiting_confirm" &&
    (stageData?.messages?.length ?? 0) > 0 &&
    !converging &&
    !isStreaming;

  const showAuditPanel = gateDecision && auditReport && !optimizeComplete;
  const showOptimizeCard = optimizeComplete;

  // ── 加载态 ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-stone-400 text-sm">加载中…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-stone-400 text-sm">项目不存在</div>
      </div>
    );
  }

  // ── 渲染 ──────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-white">
      {/* 顶部导航 */}
      <TopBar
        projectId={project.id}
        brandName={project.name}
        category={project.category}
        allStagesComplete={allComplete}
        completedCount={stages.filter((s) => s.status === "completed").length}
      />

      {/* 主体三栏 */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧栏：阶段导航（可折叠） */}
        <StageSidebar
          stages={stages}
          activeStage={activeStage}
          onSelect={handleStageSelect}
          stageOutputs={stageOutputsMap}
          onBacktrack={handleBacktrack}
        />

        {/* 中间：对话区 + 浮动提示 */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
          {/* 失效提示 */}
          {isInvalidated && (
            <div className="mx-4 mt-3 rounded-lg border border-orange-200 bg-orange-50 p-4 shrink-0">
              <div className="flex items-start gap-3">
                <span className="text-lg">⚠</span>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-orange-800">此阶段的上游决策已变更</h4>
                  <p className="text-xs text-orange-600 mt-1">
                    由于前序阶段的决策被修改，本阶段的结论可能已不再适用。建议重新运行此阶段。
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleBacktrack(activeStage, "")}
                      disabled={isStreaming}
                      className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded
                        hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                      {isStreaming ? "运行中…" : "重新运行此阶段"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 收束中提示 */}
          {converging && (
            <div className="mx-4 mt-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3 shrink-0">
              <p className="text-xs text-blue-600 flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                正在执行阶段收束与审计…
              </p>
            </div>
          )}

          {/* 对话区 */}
          {stageData ? (
            <ChatArea
              stageNumber={activeStage}
              stageName={stageData.stageName || getStageName(activeStage)}
              stageStatus={currentStatus}
              messages={stageData.messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              onSend={handleSendMessage}
              onConverge={canConverge ? handleConverge : undefined}
              converging={converging}
              projectId={projectId}
              pendingInsert={pendingImageMd}
              onPendingInsertConsumed={() => setPendingImageMd(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
              加载阶段数据…
            </div>
          )}
        </div>

        {/* 右侧栏：审计面板 或 优化确认 */}
        {showAuditPanel && (
          <AuditPanel
            gateDecision={gateDecision}
            aiAudit={auditReport.aiAudit}
            ruleCheck={auditReport.ruleCheck}
            referenceIssues={auditReport.referenceIssues}
            onSmartOptimize={handleSmartOptimize}
            onKeepCurrent={gateDecision === "block" ? undefined : handleKeepCurrent}
            loading={isStreaming}
          />
        )}

        {showOptimizeCard && (
            <OptimizeCompleteCard
              stage={activeStage}
              newOutput={optimizedOutput}
              changeSummary={
                auditReport?.aiAudit?.issues
                  ?.filter((i) => i.severity !== "minor")
                  ?.map((i) => i.description) ?? []
              }
              auditReport={auditReport}
              gateDecision={gateDecision ?? undefined}
              onConfirm={handleConfirmVersion}
              onConfirmCurrent={handleConfirmCurrent}
              onSmartOptimize={handleSmartOptimize}
              onRollback={handleRollback}
              loading={isStreaming}
            />
        )}
      </div>

      {/* 图片粘贴监听（所有阶段可用） */}
      <PasteHandler
        projectId={projectId}
        enabled={true}
        onImageUploaded={handleImageUploaded}
      />

      {/* 回溯确认弹窗 */}
      <BacktrackDialog
        open={backtrackDialog !== null}
        stage={backtrackDialog?.stage ?? 1}
        stageName={backtrackDialog?.stageName ?? ""}
        fieldLabel={
          backtrackDialog?.field
            ? displayFieldName(backtrackDialog.field)
            : undefined
        }
        affectedStages={backtrackDialog?.affectedStages ?? []}
        loading={isStreaming}
        onCancel={() => setBacktrackDialog(null)}
        onConfirm={executeBacktrack}
      />
    </div>
  );
}
