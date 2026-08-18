const STEPS = [
  {
    title: "Supabase 프로젝트 만들기",
    body: "supabase.com 에서 새 프로젝트를 만듭니다. 리전은 Northeast Asia (Seoul) 을 고르면 국내 접속이 빠릅니다.",
  },
  {
    title: "스키마 넣기",
    body: "대시보드의 SQL Editor 를 열고 이 저장소의 supabase/schema.sql 내용을 통째로 붙여넣어 실행합니다.",
  },
  {
    title: "구글 로그인 켜기",
    body: "Authentication > Providers > Google 을 켜고, Google Cloud Console 에서 만든 클라이언트 ID/시크릿을 넣습니다. 리디렉션 URL 은 Supabase 가 알려주는 주소를 그대로 씁니다.",
  },
  {
    title: "환경 변수 채우기",
    body: ".env.local.example 을 .env.local 로 복사하고 Settings > API 의 URL·anon key·service_role key 를 채웁니다.",
  },
  {
    title: "나를 운영자로 지정",
    body: "한 번 로그인한 뒤 SQL Editor 에서 update profiles set role = 'owner' where handle = '내핸들'; 을 실행하면 운영자 콘솔이 열립니다.",
  },
];

export function SetupGuide() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-sm font-semibold text-punch-400 mb-2">아직 연결 전</p>
      <h1 className="text-3xl font-black tracking-tight mb-3">Supabase 를 연결하면 시작됩니다</h1>
      <p className="text-ink-400 mb-10">
        로그인·랭킹·좋아요·댓글은 모두 데이터베이스가 필요합니다. 아래 다섯 단계만 하면 됩니다.
      </p>

      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="panel p-5 flex gap-4">
            <span className="grid place-items-center size-7 shrink-0 rounded-lg bg-ink-800 text-sm font-black">
              {i + 1}
            </span>
            <div>
              <p className="font-bold">{step.title}</p>
              <p className="text-sm text-ink-400 mt-1 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-sm text-ink-400 mt-8">
        자세한 순서는 저장소 루트의 <code className="text-neon-400">README.md</code> 에 정리해 두었습니다.
      </p>
    </div>
  );
}
