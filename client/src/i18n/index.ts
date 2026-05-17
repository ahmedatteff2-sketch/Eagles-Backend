/**
 * i18n setup. Initialized exactly once at module load — there's no async
 * loader because both bundles are tiny and we want translations available
 * before React first paints (avoids the flash of untranslated text).
 *
 * Default language is Arabic (RTL). Switching to English flips `dir` and
 * `lang` on the <html> element via `useLanguage()`.
 */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import en from "./locales/en.json";
import { STORAGE_KEYS } from "@/lib/storage";

export type SupportedLang = "ar" | "en";
const SUPPORTED: SupportedLang[] = ["ar", "en"];
const DEFAULT_LANG: SupportedLang = "ar";

function readSavedLang(): SupportedLang {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LANG);
    if (raw && (SUPPORTED as string[]).includes(raw)) return raw as SupportedLang;
  } catch {
    /* localStorage unavailable — fall through */
  }
  return DEFAULT_LANG;
}

const initialLang = readSavedLang();

void i18next.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: initialLang,
  fallbackLng: DEFAULT_LANG,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

applyDocumentDirection(initialLang);

export function applyDocumentDirection(lang: SupportedLang): void {
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang);
}

export async function setLanguage(lang: SupportedLang): Promise<void> {
  if (!(SUPPORTED as string[]).includes(lang)) return;
  await i18next.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEYS.LANG, lang);
  } catch {
    /* ignore quota errors */
  }
  applyDocumentDirection(lang);
}

export { i18next };
