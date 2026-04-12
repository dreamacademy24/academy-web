"use client";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LocalizedHome() {
  const t = useTranslations("home");
  return (<>
    <style>{`
.lh-w{max-width:720px;margin:0 auto;padding:60px 24px;text-align:center;font-family:'Noto Sans KR',sans-serif}
.lh-title{font-size:32px;font-weight:900;margin-bottom:12px;color:#1a1a2e}
.lh-sub{font-size:16px;color:#6b7c93;margin-bottom:36px}
.lh-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.lh-btn{padding:14px 28px;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block}
.lh-btn-blue{background:#1a6fc4;color:#fff}.lh-btn-blue:hover{background:#0d3d7a}
.lh-btn-gray{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0}.lh-btn-gray:hover{background:#e2e8f0}
.lh-lang{margin-top:40px;display:flex;justify-content:center}
    `}</style>
    <div className="lh-w">
      <h1 className="lh-title">{t("hero_title")}</h1>
      <p className="lh-sub">{t("hero_subtitle")}</p>
      <div className="lh-cta">
        <a className="lh-btn lh-btn-blue" href="/booking">{t("cta_booking")}</a>
        <a className="lh-btn lh-btn-gray" href="/portal">{t("cta_portal")}</a>
      </div>
      <div className="lh-lang"><LanguageSwitcher /></div>
    </div>
  </>);
}
