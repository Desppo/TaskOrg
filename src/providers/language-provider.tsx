import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { en, es, type TranslationKey } from '@/i18n/translations';

export type Language = 'es' | 'en';

interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const STORAGE_KEY = 'taskorg.language';
const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectedLanguage(): Language {
  return getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectedLanguage);

  useEffect(() => {
    Storage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'es' || stored === 'en') setLanguageState(stored);
    }).catch(() => undefined);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: language === 'es' ? 'es-ES' : 'en-US',
    setLanguage(nextLanguage) {
      setLanguageState(nextLanguage);
      void Storage.setItem(STORAGE_KEY, nextLanguage).catch(() => undefined);
    },
    t(key) {
      return (language === 'es' ? es : en)[key];
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider');
  return value;
}
