export const locales = ["ko", "en", "ja"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "ko";

export const localeLabels: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

export const localeShortLabels: Record<Locale, string> = {
  ko: "KO",
  en: "EN",
  ja: "JA",
};
