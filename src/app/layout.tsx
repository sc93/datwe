import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import Link from "next/link";

import { Analytics } from "@/components/analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://datwe.vercel.app"),
  title: "다음주 퇴사 | 로또 번호 생성기",
  description:
    "최근 로또 당첨번호를 확인하고, 원하는 조건으로 나만의 번호를 만들어 저장해 보세요. 직장인의 작은 퇴사 로망, DATWE.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "DATWE 다음주 퇴사",
    title: "다음주 퇴사 | 로또 번호 생성기",
    description: "최근 당첨번호 확인부터 나만의 조건으로 번호 생성·저장까지.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "다음주 퇴사 | 로또 번호 생성기",
    description: "최근 당첨번호 확인부터 나만의 조건으로 번호 생성·저장까지.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta
          name="google-site-verification"
          content="Ij37Fo71XLQ_7jIt4HEnRKeRYveFfyMUwhVnrVgXMNI"
        />
        <meta
          name="naver-site-verification"
          content="78620915d4073b38f73f28eb83c6722017bc62b9"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansKr.variable} antialiased`}
      >
        <div className="border-border/60 bg-background mx-auto min-h-dvh w-full max-w-150 border-x min-[900px]:mb-7">
          <header className="border-foreground mx-5 flex h-[78px] items-center justify-between border-b-2 min-[480px]:mx-6 min-[900px]:h-24">
            <Link
              href="/"
              aria-label="다음주 퇴사 메인"
              className="inline-flex min-h-11 items-center text-[34px] leading-none font-extrabold tracking-[-2px]"
            >
              datwe<span className="text-primary">.</span>
            </Link>
            <span className="text-xs font-semibold tracking-wide">
              다음주 퇴사
            </span>
          </header>
          <Analytics />
          <main className="px-5 pt-7 min-[480px]:px-6">{children}</main>
          <footer className="text-muted-foreground mx-5 mt-10 flex flex-col items-center border-t pt-9 pb-[calc(10rem+env(safe-area-inset-bottom))] text-center min-[480px]:mx-6">
            <span className="text-xl font-extrabold tracking-tight">
              datwe.
            </span>
            <p className="mt-3 text-xs leading-6">
              번호 조건은 조합에만 반영되며
              <br />
              당첨을 보장하지 않아요.
            </p>
            <a
              className="mt-2 inline-flex min-h-11 items-center text-xs"
              href="mailto:devssc93@gmail.com"
            >
              문의하기 ↗
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
