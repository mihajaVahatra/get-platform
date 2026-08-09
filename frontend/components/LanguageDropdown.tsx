'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocaleSwitcher } from '@/i18n/use-locale-switcher';

const LOCALE_LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
};

export function LanguageDropdown({ className }: { className?: string }) {
  const { locale, locales, isPending, setLocale } = useLocaleSwitcher();
  const t = useTranslations('Common');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // La position (absolute/hidden/lg:flex…) est fournie par l'appelant via
  // `className` sur le conteneur externe ; `relative` reste sur un div
  // interne dédié pour que les deux ne se disputent jamais la propriété
  // CSS `position` (un `relative` codé en dur ici l'emporterait sinon sur
  // l'`absolute` du parent, l'ordre des classes Tailwind dans le DOM
  // n'ayant aucune influence sur celui, fixe, de la feuille de style
  // générée).
  return (
    <div ref={containerRef} className={className}>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={isPending}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 text-sm font-semibold text-[#151b48] disabled:opacity-60"
        >
          <Globe2 className="size-5" />
          {LOCALE_LABELS[locale] ?? locale}
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div
            role="listbox"
            className="absolute right-0 top-full z-20 mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-[0_12px_30px_rgba(60,45,140,0.15)]"
          >
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                role="option"
                aria-selected={l === locale}
                aria-label={l === 'fr' ? t('switchToFr') : t('switchToEn')}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-4 py-2 text-left text-sm font-semibold transition ${l === locale ? 'bg-indigo-50 text-indigo-700' : 'text-[#151b48] hover:bg-slate-50'}`}
              >
                {LOCALE_LABELS[l] ?? l}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
