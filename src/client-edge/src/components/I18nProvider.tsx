'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/locales/translations';

type Locale = 'zh' | 'en';

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  // Supports {name} placeholders: t('live.suite.summary', { pass: 3, total: 6 })
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en'); // Default to English

  useEffect(() => {
    const saved = localStorage.getItem('app_locale') as Locale;
    if (saved === 'zh' || saved === 'en') {
      setLocaleState(saved);
    } else {
      setLocaleState('en'); // Unconditionally default to English
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('app_locale', newLocale);
  };

  const lookup = (lang: Locale, keys: string[]): string | undefined => {
    let node: any = translations[lang];
    for (const key of keys) {
      if (node && node[key] !== undefined) node = node[key];
      else return undefined;
    }
    return typeof node === 'string' ? node : undefined;
  };

  const t = (path: string, vars?: Record<string, string | number>): string => {
    const keys = path.split('.');
    // Current language first, then English, then the key itself so missing text is visible.
    let text = lookup(locale, keys) ?? lookup('en', keys) ?? path;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
    }
    return text;
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
