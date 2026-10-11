import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isolatedGameOrigin } from "@/lib/sandbox";
import { HIDDEN_PATHS } from "@/lib/site";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 게임 전용 주소는 게임 파일(/g · /sdk — 아래 matcher 가 이미 건너뜁니다)만 내려줍니다.
  // 그 밖의 주소는 전부 없는 것으로 답해서, 게임과 같은 오리진에 로그인 화면이나 API 가
  // 놓이지 않게 합니다. 개발 서버는 nextUrl 의 호스트를 localhost 로 고쳐 쓰므로 Host 헤더를 봅니다.
  const games = isolatedGameOrigin();
  if (games && request.headers.get("host") === new URL(games).host) {
    return new NextResponse("게임 파일 전용 주소입니다.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // 꺼 둔 기능의 주소로 들어오면 홈으로 보냅니다. 나중에 다시 열 기능이라 임시(307) 이동입니다.
  if (HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let response = NextResponse.next({ request });

  // 아직 Supabase 를 연결하지 않았다면 세션 갱신을 건너뜁니다.
  // (연결 전에도 앱이 뜨고 설정 안내 화면을 볼 수 있어야 합니다.)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 토큰 갱신 (이 호출을 지우면 로그인이 랜덤하게 풀립니다)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // 정적 게임(/g/…)과 SDK 는 세션 갱신이 필요 없으니 건너뜁니다.
  //
  // 예전에는 여기서 games/ 를 제외했는데, 그러면 정적 파일뿐 아니라 게임 상세 페이지
  // (/games/[slug]) 까지 미들웨어를 안 타서 그 페이지에서만 로그인이 풀리곤 했습니다.
  // 정적 게임을 /g 아래로 옮기면서 그 부작용도 같이 없앴습니다.
  // robots.txt · sitemap.xml 은 검색 로봇이 받아가는 파일이라 마찬가지입니다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|g/|sdk/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
