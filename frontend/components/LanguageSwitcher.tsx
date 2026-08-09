'use client';

import { useTranslations } from 'next-intl';
import { useLocaleSwitcher } from '@/i18n/use-locale-switcher';

export function LanguageSwitcher({
  className,
  variant = 'light',
}: {
  className?: string;
  variant?: 'light' | 'sidebar';
}) {
  const { locale, locales, isPending, setLocale } = useLocaleSwitcher();
  const t = useTranslations('Common');

  const containerClass =
    variant === 'sidebar'
      ? 'border-border bg-card'
      : 'border-violet-200 bg-white';
  const activeClass = variant === 'sidebar' ? 'bg-indigo-600 text-white' : 'bg-violet-600 text-white';
  const inactiveClass =
    variant === 'sidebar'
      ? 'text-muted-foreground hover:bg-indigo-50 hover:text-indigo-700'
      : 'text-[#4a4470] hover:bg-violet-50';

  return (
    <div
      role="group"
      aria-label="Language"
      translate="no"
      className={`notranslate inline-flex items-center gap-0.5 rounded-full border p-0.5 text-[12px] font-bold ${containerClass} ${isPending ? 'opacity-60' : ''} ${className ?? ''}`}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          disabled={isPending}
          aria-pressed={l === locale}
          aria-label={l === 'fr' ? t('switchToFr') : t('switchToEn')}
          className={`rounded-full px-2.5 py-1 uppercase transition ${l === locale ? activeClass : inactiveClass}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
