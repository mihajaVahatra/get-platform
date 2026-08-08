'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { locales, localeCookieName, type Locale } from '@/i18n/config';

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('Common');
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

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center gap-0.5 rounded-full border border-violet-200 bg-white p-0.5 text-[12px] font-bold ${isPending ? 'opacity-60' : ''} ${className ?? ''}`}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setPendingLocale(l)}
          disabled={isPending}
          aria-pressed={l === locale}
          aria-label={l === 'fr' ? t('switchToFr') : t('switchToEn')}
          className={`rounded-full px-2.5 py-1 uppercase transition ${
            l === locale ? 'bg-violet-600 text-white' : 'text-[#4a4470] hover:bg-violet-50'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
