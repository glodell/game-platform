"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/site";

/**
 * 좁은 화면에서 헤더 메뉴를 대신하는 햄버거 버튼과 시트.
 *
 * 시트는 헤더(sticky, 따라서 위치 기준이 됨) 바로 아래에 붙습니다.
 * 라우트가 바뀌거나, 바깥을 누르거나, Esc 를 누르면 닫힙니다.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 메뉴에서 이동하면 자동으로 닫기
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="relative z-50 grid size-10 place-items-center rounded-lg border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-600 transition-colors"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫히는 레이어 */}
          <div
            className="fixed inset-x-0 top-16 bottom-0 z-30 bg-ink-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav
            id="mobile-nav"
            className="absolute inset-x-0 top-full z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur-md sheet-in"
          >
            <ul className="mx-auto max-w-6xl px-5 py-3 flex flex-col gap-1">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-3 text-base transition-colors ${
                        active
                          ? "bg-ink-800 text-ink-100 font-semibold"
                          : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
