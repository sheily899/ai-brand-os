"use client";

import { useState, useEffect, useCallback } from "react";

const BADGE_STATES = [
  { text: "市场探索", dotColor: "bg-blue-500", bgColor: "bg-blue-50/80 text-blue-950" },
  { text: "用户洞察", dotColor: "bg-amber-500", bgColor: "bg-amber-50/80 text-amber-950" },
  { text: "竞争判断", dotColor: "bg-purple-500", bgColor: "bg-purple-50/80 text-purple-950" },
  { text: "战略推演", dotColor: "bg-emerald-500", bgColor: "bg-emerald-50/80 text-emerald-950" },
];

export default function HeroTitle() {
  const [index, setIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isFlipping, setIsFlipping] = useState(false);

  const flip = useCallback(() => {
    const next = (index + 1) % BADGE_STATES.length;
    setNextIndex(next);
    setIsFlipping(true);
    setTimeout(() => setIndex(next), 275);
    setTimeout(() => setIsFlipping(false), 550);
  }, [index]);

  useEffect(() => {
    const timer = setInterval(flip, 3200);
    return () => clearInterval(timer);
  }, [flip]);

  const current = BADGE_STATES[index];
  const next = BADGE_STATES[nextIndex];

  return (
    <div className="w-full py-8 md:py-12 selection:bg-blue-500/20 font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .flip-stage {
          perspective: 400px;
        }
        .flip-card {
          position: relative;
          transform-style: preserve-3d;
          transform-origin: center center;
        }
        .flip-card.flipping {
          animation: cardFlip 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes cardFlip {
          0%   { transform: rotateX(0deg); }
          100% { transform: rotateX(180deg); }
        }
        .flip-front, .flip-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flip-back {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          transform: rotateX(180deg);
        }
      ` }} />

      <h1 className="text-stone-900 font-semibold text-center tracking-tighter leading-[1.08] text-4xl md:text-7xl max-w-5xl mx-auto">
        AI Brand OS
        <br />
        <span className="block mt-5 md:mt-8">
          <span className="text-xl md:text-3xl tracking-normal align-middle text-stone-500">
            从模糊想法，到
          </span>

          {/* 3D 翻牌胶囊 */}
          <span
            className={`
              inline-flex items-center align-middle whitespace-nowrap
              px-2.5 py-0.5 md:px-4 md:py-1.5 rounded-full
              text-xl md:text-3xl font-semibold mx-1.5 md:mx-3
              transition-all duration-500 ease-out border border-stone-200/40
              ${current.bgColor}
            `}
          >
            <span className={`
              w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full mr-1.5 md:mr-2.5 flex-shrink-0
              ${current.dotColor} transition-colors duration-500
            `} />

            {/* 3D 翻牌文字 */}
            <span className="flip-stage inline-block align-middle">
              <span className={`flip-card inline-block relative ${isFlipping ? "flipping" : ""}`}>
                <span className="flip-front inline-block font-semibold tracking-normal">
                  {isFlipping ? next.text : current.text}
                </span>
                <span className="flip-back inline-block font-semibold tracking-normal">
                  {isFlipping ? current.text : next.text}
                </span>
              </span>
            </span>
          </span>

          <span className="text-xl md:text-3xl tracking-normal align-middle text-stone-500">
            构建清晰品牌方向
          </span>
        </span>
      </h1>
    </div>
  );
}
