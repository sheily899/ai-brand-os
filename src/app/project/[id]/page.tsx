import Link from "next/link";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <p className="text-gray-500 mb-4">项目 {params.id}</p>
      <p className="text-gray-400 text-sm mb-6">工作台将在 Phase 4 实现</p>
      <Link href="/" className="text-sm text-gray-500 hover:text-black underline">
        返回首页
      </Link>
    </main>
  );
}
