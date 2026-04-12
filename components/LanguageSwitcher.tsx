"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { locales, localeShortLabels, type Locale, defaultLocale } from "@/i18n/config";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [current, setCurrent] = useState<Locale>(defaultLocale);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 1) URL prefix로 현재 locale 감지
    const match = pathname.match(/^\/(ko|en|ja)(\/|$)/);
    if (match) {
      setCurrent(match[1] as Locale);
    } else {
      // 2) localStorage fallback
      const saved = localStorage.getItem("locale") as Locale | null;
      if (saved && (locales as readonly string[]).includes(saved)) setCurrent(saved);
    }
  }, [pathname]);

  function switchLocale(next: Locale) {
    if (typeof window === "undefined") return;
    localStorage.setItem("locale", next);
    setCurrent(next);

    // URL에 locale prefix가 있으면 교체, 없으면 prefix 추가
    const match = pathname.match(/^\/(ko|en|ja)(\/|$)/);
    if (match) {
      const newPath = pathname.replace(/^\/(ko|en|ja)/, `/${next}`);
      router.push(newPath);
    } else {
      router.push(`/${next}`);
    }
  }

  return (
    <div className={`ls-w ${className}`} style={{ display: "inline-flex", gap: 4, background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
      {locales.map(l => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "inherit",
            background: current === l ? "#1a6fc4" : "transparent",
            color: current === l ? "#fff" : "#6b7c93",
            transition: "all 150ms",
          }}
        >
          {localeShortLabels[l]}
        </button>
      ))}
    </div>
  );
}
