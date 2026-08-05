"use client";

/**
 * 回溯确认弹窗
 *
 * 用户点击侧边栏编辑按钮后，先弹出此对话框确认风险，
 * 用户确认后才执行实际回溯操作。
 */

interface AffectedStage {
  number: number;
  name: string;
}

interface BacktrackDialogProps {
  /** 是否显示 */
  open: boolean;
  /** 目标回溯阶段 */
  stage: number;
  /** 目标阶段名称 */
  stageName: string;
  /** 正在编辑的字段（可选，用于提示） */
  fieldLabel?: string;
  /** 将被失效化的下游阶段列表 */
  affectedStages: AffectedStage[];
  /** 加载中 */
  loading?: boolean;
  /** 取消 */
  onCancel: () => void;
  /** 确认回溯 */
  onConfirm: () => void;
}

// ── SVG Icons ──────────────────────────────────────────

function AlertTriangle() {
  return (
    <svg
      className="w-5 h-5 text-amber-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 22h20L12 2z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function BacktrackDialog({
  open,
  stage,
  stageName,
  fieldLabel,
  affectedStages,
  loading = false,
  onCancel,
  onConfirm,
}: BacktrackDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />

      {/* 对话框 */}
      <div className="relative bg-white rounded-xl shadow-lg border border-stone-200 w-full max-w-md mx-4 p-6">
        {/* 头部 */}
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#37352f]">
              确认回到 S{stage} {stageName}
            </h3>
            {fieldLabel && (
              <p className="text-xs text-stone-500 mt-0.5">
                你将修改「{fieldLabel}」
              </p>
            )}
          </div>
        </div>

        {/* 影响说明 */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 mb-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            回溯此阶段后，你可以重新编辑 S{stage}{" "}
            的内容。已完成的对话记录和阶段输出会保留作为参考，但需要基于新的修改重新确认。
          </p>
        </div>

        {/* 受影响的下游阶段 */}
        {affectedStages.length > 0 && (
          <div className="mb-1">
            <p className="text-xs font-medium text-stone-600 mb-2">
              以下阶段将受到影响，需要重新运行：
            </p>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {affectedStages.map((s) => (
                <div
                  key={s.number}
                  className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-medium shrink-0">
                    S{s.number}
                  </span>
                  <span className="text-stone-600">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {affectedStages.length === 0 && (
          <p className="text-xs text-stone-400 mb-4">
            此阶段没有下游依赖，回溯不会影响其他阶段。
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-stone-100">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700
              hover:bg-stone-100 rounded-md transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium bg-amber-600 text-white rounded-md
              hover:bg-amber-700 disabled:opacity-50 transition-colors
              flex items-center gap-1.5"
          >
            {loading && (
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {loading ? "回溯中…" : `确认回到 S${stage}`}
          </button>
        </div>
      </div>
    </div>
  );
}
