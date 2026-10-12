"use client";

import { useEffect, useState, type ReactNode } from "react";

export type AdminTab = {
  key: string;
  label: string;
  /** 처리할 것이 있을 때 탭 이름 옆에 띄우는 숫자 */
  badge?: number;
  content: ReactNode;
};

/**
 * 운영자 콘솔의 탭.
 *
 * 안 보이는 탭도 지우지 않고 숨기기만 합니다 — 탭을 오가도 쓰던 글이나 올리는 중이던 게임
 * 폴더가 사라지지 않습니다. 고른 탭은 주소의 # 뒤에 남겨서 새로고침해도 그 탭으로 돌아옵니다.
 */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0].key);

  // 주소의 # 는 서버가 볼 수 없어서, 화면이 뜬 뒤에 맞춥니다.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (tabs.some((tab) => tab.key === fromHash)) setActive(fromHash);
  }, [tabs]);

  function select(key: string) {
    setActive(key);
    window.history.replaceState(null, "", `#${key}`);
  }

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="운영자 콘솔 메뉴"
        className="flex gap-1 border-b border-ink-800 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              onClick={() => select(tab.key)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                selected
                  ? "border-neon-400 text-ink-100"
                  : "border-transparent text-ink-400 hover:text-ink-100"
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-1.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-xs text-gold tabular-nums">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== active}
          // 각 구역은 위아래로 쌓일 때를 기준으로 여백을 갖고 있어, 탭 바로 아래 첫 구역만 줄입니다.
          className="[&>section:first-child]:mt-8"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
