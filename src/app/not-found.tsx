import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-28 text-center">
      <p className="text-6xl font-black text-ink-700">404</p>
      <h1 className="text-2xl font-black mt-4">여긴 아무것도 없네요</h1>
      <p className="text-ink-400 text-sm mt-2">
        주소가 바뀌었거나, 아직 공개되지 않은 페이지일 수 있습니다.
      </p>
      <Link
        href="/games"
        className="inline-block mt-8 rounded-xl bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-bold hover:bg-white transition-colors"
      >
        게임 목록으로
      </Link>
    </div>
  );
}
