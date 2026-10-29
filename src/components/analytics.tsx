"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { analyticsEnabled, analyticsPage, GA_ID } from "@/lib/analytics-page";

/** 향상된 측정의 자동 수집 중지를 운영 계정에서 확인한 경우에만 로드한다. */
export function Analytics() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (
      !analyticsEnabled(window.location.origin) ||
      previous.current === pathname
    )
      return;
    previous.current = pathname;
    try {
      window.dataLayer ??= [];
      window.gtag ??= function () {
        // gtag 공식 큐 계약은 rest 배열 대신 Arguments 객체를 받는다.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      if (!document.getElementById("datwe-ga")) {
        window.gtag("js", new Date());
        window.gtag("config", GA_ID, {
          ...analyticsPage(pathname),
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
        const script = document.createElement("script");
        script.id = "datwe-ga";
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
        document.head.appendChild(script);
      }
      window.gtag("event", "page_view", analyticsPage(pathname));
    } catch {
      /* 분석 차단은 제품 탐색을 막지 않는다. */
    }
  }, [pathname]);
  return null;
}
declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}
