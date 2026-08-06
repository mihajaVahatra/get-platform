'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

type LogoVariant = 'mark' | 'lockup';
type LogoTone = 'color' | 'light' | 'mono';

export function Logo({
  variant = 'lockup',
  tone = 'color',
  size = 40,
  className,
}: {
  variant?: LogoVariant;
  tone?: LogoTone;
  size?: number;
  className?: string;
}) {
  const gradientId = useId();

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {tone === 'color' && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
      )}
      <rect
        x="6"
        y="6"
        width="108"
        height="108"
        rx="30"
        fill={tone === 'color' ? `url(#${gradientId})` : tone === 'light' ? '#ffffff' : 'currentColor'}
        opacity={tone === 'light' ? 0.12 : 1}
      />
      <path
        d="M84 46 A24 24 0 1 0 86 70 H60"
        stroke={tone === 'light' ? 'currentColor' : '#ffffff'}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 60 l10 8 -10 8"
        stroke={tone === 'light' ? 'currentColor' : '#ffffff'}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === 'mark') {
    return <span className={cn('inline-flex', className)}>{mark}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {mark}
      <span className="min-w-0">
        <span
          className={cn(
            'block font-heading text-2xl leading-none tracking-tight',
            tone === 'light' ? 'text-white' : tone === 'mono' ? 'text-current' : 'text-foreground'
          )}
          style={{ fontWeight: 800 }}
        >
          GET
        </span>
        <span
          className={cn(
            'mt-0.5 block whitespace-nowrap text-[9px] font-semibold leading-tight',
            tone === 'light' ? 'text-white/70' : 'text-muted-foreground'
          )}
        >
          Grandes Écoles de Tananarive
        </span>
      </span>
    </span>
  );
}
