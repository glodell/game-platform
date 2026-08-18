import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="text-2xl font-black mb-3">로그인에 실패했습니다</h1>
      <p className="text-ink-400 text-sm mb-8 break-words">
        {reason ?? "알 수 없는 오류가 발생했습니다."}
      </p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-semibold"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
