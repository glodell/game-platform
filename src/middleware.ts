import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|g/|sdk/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
