"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProjectItem {
  id: string;
  name: string;
  category: string;
  createdAt: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ProjectHistory() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/project")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (projects.length === 0) return null;

  return (
    <div className="w-full">
      {/* 标题 */}
      <h2 className="text-sm font-semibold tracking-wide text-[#37352f]/60 uppercase mb-2">
        历史项目
      </h2>

      {/* 列表 */}
      <div className="border border-[#e9e9e6] rounded-[15px] divide-y divide-[#e9e9e6]">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className="flex items-center justify-between px-3 py-2.5 hover:bg-[#f1f1ef] transition-colors cursor-pointer text-[#37352f]"
          >
            {/* 左侧：名称 */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-sm truncate">{p.name}</span>
            </div>

            {/* 右侧：标签 + 日期 */}
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              {p.category && (
                <span className="bg-[#f1f1ef] px-2 py-0.5 rounded-md text-xs text-[#37352f]/70">
                  {p.category}
                </span>
              )}
              <span className="text-xs text-[#37352f]/40">
                {formatDate(p.createdAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
