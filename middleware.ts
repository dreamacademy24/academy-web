// next-intl middleware - opt-in (locale prefix only on /[locale] pages)
// 기존 라우트(/admin, /portal, /booking 등)는 middleware 영향 없음
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./i18n/config";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 명시적 locale prefix가 있는 경로만 처리
  const hasLocalePrefix = locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocalePrefix) return NextResponse.next();

  // 현재는 pass-through — next-intl이 [locale] 세그먼트를 자동 처리
  return NextResponse.next();
}

export const config = {
  // 다국어 라우트만 매칭 (기존 admin/portal/api 등 제외)
  matcher: ["/(ko|en|ja)/:path*"],
};
