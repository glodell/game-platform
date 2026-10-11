import type { ReactNode } from "react";
import { CONTACT_EMAIL, SOCIAL } from "@/lib/site";

/** 소개 · 이용약관 · 개인정보처리방침처럼 글만 있는 안내 페이지의 공통 틀. */
export function DocPage({
  title,
  effective,
  lead,
  children,
}: {
  title: string;
  /** 시행일 (약관 · 방침에만) */
  effective?: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{title}</h1>
      {effective && <p className="text-sm text-ink-400 mt-2">시행일 {effective}</p>}
      {lead && <p className="text-ink-300 mt-5 leading-relaxed">{lead}</p>}
      {children}
    </article>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-black tracking-tight mb-3">{title}</h2>
      <div className="space-y-3 text-ink-300 leading-relaxed">{children}</div>
    </section>
  );
}

export function DocList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-ink-600">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  const external = !href.startsWith("/");
  return (
    <a
      href={href}
      className="text-neon-400 hover:underline break-words"
      {...(external && !href.startsWith("mailto:")
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {children}
    </a>
  );
}

/** 문의처 — 이메일을 정해 두었으면 이메일, 아니면 채널로 안내합니다. */
export function Contact() {
  if (CONTACT_EMAIL) {
    return <DocLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</DocLink>;
  }

  const channels = SOCIAL.filter((item) => item.key === "youtube" || item.key === "instagram");
  return (
    <>
      {channels.map((item, i) => (
        <span key={item.key}>
          {i > 0 && " 또는 "}
          <DocLink href={item.href}>{item.label} 채널</DocLink>
        </span>
      ))}
      의 메시지 · 댓글
    </>
  );
}
