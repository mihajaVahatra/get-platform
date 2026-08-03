'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { PenLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BottomNavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
};

function isItemActive(currentUrl: string, href: string) {
  const [currentPath, currentSearch = ''] = currentUrl.split('?');
  const [targetPath, targetSearch = ''] = href.split('?');
  if (targetSearch)
    return currentPath === targetPath && currentSearch === targetSearch;
  return currentPath === targetPath;
}

export function MobileBottomNav({
  items,
  composeHref,
  dark = false,
}: {
  items: BottomNavItem[];
  composeHref?: string;
  dark?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentUrl = search ? `${pathname}?${search}` : pathname;

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t px-2 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 lg:hidden',
        dark ? 'border-white/10 bg-[#0d1b4d]' : 'border-slate-100 bg-white',
      )}
    >
      {composeHref ? (
        <>
          {items.slice(0, 2).map((item) => (
            <NavButton
              key={item.href}
              item={item}
              active={isItemActive(currentUrl, item.href)}
              dark={dark}
            />
          ))}
          <Link
            href={composeHref}
            aria-label="Nouveau message"
            className="relative -mt-7 grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30 transition active:scale-95"
          >
            <PenLine className="size-6" />
          </Link>
          {items.slice(2, 4).map((item) => (
            <NavButton
              key={item.href}
              item={item}
              active={isItemActive(currentUrl, item.href)}
              dark={dark}
            />
          ))}
        </>
      ) : (
        items.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            active={isItemActive(currentUrl, item.href)}
            dark={dark}
          />
        ))
      )}
    </nav>
  );
}

function NavButton({
  item,
  active,
  dark,
}: {
  item: BottomNavItem;
  active: boolean;
  dark: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex min-w-14 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition',
        active
          ? 'text-violet-600'
          : dark
            ? 'text-blue-100/80'
            : 'text-slate-400',
      )}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}
