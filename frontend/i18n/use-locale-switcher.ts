'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { locales, localeCookieName, type Locale } from './config';

export function useLocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  useEffect(() => {
    if (!pendingLocale || pendingLocale === locale) return;
    document.cookie = `${localeCookieName}=${pendingLocale}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }, [pendingLocale, locale, router]);

  return { locale, locales, isPending, setLocale: setPendingLocale };
}
