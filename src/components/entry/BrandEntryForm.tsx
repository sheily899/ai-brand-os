"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_SUGGESTIONS = [
  "宠物消费",
  "食品饮料",
  "美妆个护",
  "家居生活",
  "母婴儿童",
  "服饰配饰",
  "运动户外",
  "消费电子",
  "文化娱乐",
  "其他",
];

export default function BrandEntryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [categoryOther, setCategoryOther] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isOther = category === "其他";
  const finalCategory = isOther ? categoryOther : category;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("请输入品牌名称");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category: finalCategory.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "创建失败");
      }
      const project = await res.json();
      router.push(`/project/${project.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 品牌名称 */}
        <div>
          <label htmlFor="brandName" className="block text-sm text-[#37352f]/60 mb-1.5">
            品牌名称 <span className="text-red-400">*</span>
          </label>
          <input
            id="brandName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入品牌名称"
            className="w-full px-3 py-[7px] text-sm text-[#37352f] placeholder:text-[#37352f]/30 bg-white border border-[#e9e9e6] rounded-[15px] focus:outline-none focus:border-[#2383e2] focus:ring-0 transition-colors"
            autoFocus
          />
        </div>

        {/* 品类方向 */}
        <div>
          <label htmlFor="category" className="block text-sm text-[#37352f]/60 mb-1.5">
            品类方向 <span className="text-[#37352f]/40 font-normal">(可选)</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-[7px] text-sm text-[#37352f] bg-white border border-[#e9e9e6] rounded-[15px] focus:outline-none focus:border-[#2383e2] focus:ring-0 transition-colors appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2337352f' stroke-opacity='0.4' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              paddingRight: "2rem",
            }}
          >
            <option value="">选择品类</option>
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* "其他" 自定义品类 */}
      {isOther && (
        <input
          type="text"
          value={categoryOther}
          onChange={(e) => setCategoryOther(e.target.value)}
          placeholder="请输入品类方向"
          className="w-full px-3 py-[7px] text-sm text-[#37352f] placeholder:text-[#37352f]/30 bg-white border border-[#e9e9e6] rounded-[15px] focus:outline-none focus:border-[#2383e2] focus:ring-0 transition-colors"
        />
      )}

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-[7px] text-sm font-medium text-white bg-[#2383e2] hover:bg-[#0070f3] rounded-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "创建中..." : "开始品牌咨询"}
      </button>
    </form>
  );
}
