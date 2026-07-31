import HeroTitle from "@/components/entry/HeroTitle";
import BrandEntryForm from "@/components/entry/BrandEntryForm";
import ProjectHistory from "@/components/entry/ProjectHistory";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-24">
      <div className="w-full max-w-[708px] space-y-10">
        {/* Header */}
        <HeroTitle />

        {/* 表单 */}
        <BrandEntryForm />

        {/* 历史项目 */}
        <ProjectHistory />
      </div>
    </main>
  );
}
