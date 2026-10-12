"use client";

import { useState, type ReactNode } from "react";

/**
 * 랭킹 칸의 작은 탭 — 이벤트가 열려 있을 때 "이벤트 순위" 와 "전체 랭킹" 을 오갑니다.
 * 내용은 서버에서 다 만들어 넘기고, 여기서는 보이는 쪽만 바꿉니다.
 */
export function RankTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].key);

  return (
    <div>
      <div role="tablist" className="flex gap-1 rounded-xl bg-ink-900 border border-ink-800 p-1 mb-4">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                selected ? "bg-ink-100 text-ink-950" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" hidden={tab.key !== active}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
