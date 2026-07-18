'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/locales/translations';

type Locale = 'zh' | 'en';

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en'); // Default to English

  useEffect(() => {
    const saved = localStorage.getItem('app_locale') as Locale;
    if (saved === 'zh' || saved === 'en') {
      setLocaleState(saved);
    } else {
      // Auto-detect browser language
      const lang = navigator.language || '';
      if (lang.toLowerCase().startsWith('zh')) {
        setLocaleState('zh');
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('app_locale', newLocale);
  };

  const t = (path: string): string => {
    const keys = path.split('.');
    let result: any = translations[locale];
    
    for (const key of keys) {
      if (result && result[key] !== undefined) {
        result = result[key];
      } else {
        // Fallback to English translation first if key missing in Chinese
        let fallbackResult: any = translations['en'];
        for (const fallbackKey of keys) {
          if (fallbackResult && fallbackResult[fallbackKey] !== undefined) {
            fallbackResult = fallbackResult[fallbackKey];
          } else {
            fallbackResult = path;
            break;
          }
        }
        return typeof fallbackResult === 'string' ? fallbackResult : path;
      }
    }
    
    return typeof result === 'string' ? result : path;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
