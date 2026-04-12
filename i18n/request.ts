import { getRequestConfig } from "next-intl/server";
import { locales, defaultLocale, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !(locales as readonly string[]).includes(locale)) {
    locale = defaultLocale;
  }
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale: locale as Locale, messages };
});
