export const SITE_ORIGIN = "https://datwe.vercel.app";
export const GA_ID = "G-X6S68TMWZJ";
export function analyticsPage(pathname: string) {
  const page_path =
    pathname === "/"
      ? "/"
      : pathname === "/draw"
        ? "/draw"
        : /^\/draw\/\d+$/.test(pathname)
          ? "/draw/[round]"
          : "/unknown";
  const page_title =
    page_path === "/"
      ? "다음주 퇴사 | 로또 번호 생성기"
      : page_path === "/draw"
        ? "회차별 당첨번호"
        : page_path === "/draw/[round]"
          ? "회차 당첨번호 상세"
          : "주소 확인";
  return {
    page_path,
    page_title,
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
