import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, DEFAULT_NS, NAMESPACES, resources, SUPPORTED_LANGUAGES, type Language } from '@/i18n/resources'

export const LANGUAGE_STORAGE_KEY = 'nxl.lang'

/** BCP 47 locale used by Intl formatters for each UI language. */
const LOCALES: Record<Language, string> = { vi: 'vi-VN', en: 'en-US' }

export function currentLanguage(): Language {
  const lng = i18n.resolvedLanguage
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng ?? '') ? (lng as Language) : DEFAULT_LANGUAGE
}

export function currentLocale(): string {
  return LOCALES[currentLanguage()]
}

export function changeLanguage(lng: Language) {
  return i18n.changeLanguage(lng)
}

i18n.on('languageChanged', () => {
  if (typeof document !== 'undefined') document.documentElement.lang = currentLanguage()
})

// Bundled resources: init is synchronous, so the first render already has its strings.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: NAMESPACES,
    defaultNS: DEFAULT_NS,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    initAsync: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    returnNull: false,
  })

export default i18n
