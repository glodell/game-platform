"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FEATURES } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";

type Props = {
  profile: { handle: string; display_name: string; avatar_url: string | null; role: string } | null;
  isStaff: boolean;
};

export function AccountMenu({ profile, isStaff }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    const next = encodeURIComponent(pathname || "/");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    });
  }

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
    setBusy(false);
  }

  if (!profile) {
    return (
      <button
        onClick={signIn}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg bg-ink-100 text-ink-950 px-3.5 py-2 text-sm font-semibold hover:bg-white transition-colors disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "이동 중…" : "로그인"}
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-ink-700 pl-1 pr-3 py-1 hover:border-ink-600 transition-colors"
      >
        <Avatar url={profile.avatar_url} name={profile.display_name} />
        <span className="text-sm text-ink-300 max-w-28 truncate hidden sm:block">
          {profile.display_name}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 panel p-1.5 text-sm shadow-2xl">
          <div className="px-3 py-2.5 border-b border-ink-800 mb-1">
            <p className="font-semibold truncate">{profile.display_name}</p>
            <p className="text-ink-400 text-xs truncate">@{profile.handle}</p>
          </div>
          <MenuLink href={`/u/${profile.handle}`} onClick={() => setOpen(false)}>내 프로필</MenuLink>
          {FEATURES.community && (
            <MenuLink href="/submit" onClick={() => setOpen(false)}>게임 제출하기</MenuLink>
          )}
          {isStaff && (
            <MenuLink href="/admin" onClick={() => setOpen(false)}>
              <span className="text-lime-glow">운영자 콘솔</span>
            </MenuLink>
          )}
          <button
            onClick={signOut}
            disabled={busy}
            className="w-full text-left px-3 py-2 rounded-lg text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-2 rounded-lg text-ink-300 hover:bg-ink-800 hover:text-ink-100 transition-colors"
    >
      {children}
    </Link>
  );
}

export function Avatar({
  url,
  name,
  size = 28,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-ink-700 text-ink-100 font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}
