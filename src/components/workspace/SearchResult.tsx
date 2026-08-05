"use client";

import { renderMarkdownBlocks } from "@/lib/utils/markdown";

interface SearchResultData {
  query: string;
  findings: string;
  credibility: string;
  impact: string;
}

interface SearchResultProps {
  data: SearchResultData;
}

/**
 * 搜索发现三段式展示。
 * 对应共享搜索协议的三段输出：搜索发现 / 可信度判断 / 对分析的影响。
 */
export default function SearchResult({ data }: SearchResultProps) {
  if (!data.findings && !data.credibility && !data.impact) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 my-3">
      <h4 className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        搜索发现
        {data.query && (
          <span className="text-blue-400 font-normal">· {data.query}</span>
        )}
      </h4>

      {data.findings && (
        <div className="mb-2">
          <h5 className="text-[11px] font-medium text-blue-600 mb-0.5">
            关键信息
          </h5>
          <div
            className="text-xs text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdownBlocks(data.findings) }}
          />
        </div>
      )}

      {data.credibility && (
        <div className="mb-2">
          <h5 className="text-[11px] font-medium text-blue-600 mb-0.5">
            可信度判断
          </h5>
          <div
            className="text-xs text-gray-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdownBlocks(data.credibility) }}
          />
        </div>
      )}

      {data.impact && (
        <div>
          <h5 className="text-[11px] font-medium text-blue-600 mb-0.5">
            对本阶段分析的影响
          </h5>
          <div
            className="text-xs text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdownBlocks(data.impact) }}
          />
        </div>
      )}
    </div>
  );
}
