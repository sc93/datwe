export const SITE_ORIGIN = "https://datwe.vercel.app";
export const GA_ID = "G-X6S68TMWZJ";
export function analyticsPage(pathname: string) {
  function getPagePath() {
    if (pathname === "/") {
      return "/" as const;
    }
    if (pathname === "/draw") {
      return "/draw" as const;
    }
    if (/^\/draw\/\d+$/.test(pathname)) {
      return "/draw/[round]" as const;
    }
    return "/unknown" as const;
  }
  const page_path = getPagePath();
  const page_title = {
    "/": "다음주 퇴사 | 로또 번호 생성기",
    "/draw": "회차별 당첨번호",
    "/draw/[round]": "회차 당첨번호 상세",
    "/unknown": "주소 확인",
  } satisfies Record<typeof page_path, string>;
  return {
    page_path,
    page_title: page_title[page_path],
    page_location: SITE_ORIGIN + page_path,
    page_referrer: "",
  };
}
export function analyticsEnabled(origin: string) {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_GA_ENHANCED_MEASUREMENT_DISABLED === "true" &&
    origin === SITE_ORIGIN
  );
}
