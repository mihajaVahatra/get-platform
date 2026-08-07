'use client';

import { cn } from '@/lib/utils';

type LogoVariant = 'mark' | 'lockup';
type LogoTone = 'color' | 'light' | 'mono' | 'forest' | 'terracotta';

/**
 * Déclinaisons officielles de couleur (charte graphique GET, v1 · 2026).
 * Le monogramme est fourni en un seul art (encre #1C1C1C sur fond transparent) et
 * recoloré via `mask-image` pour respecter les déclinaisons encre / vert forêt / terre cuite / claire.
 */
const TONE_COLORS: Record<LogoTone, string> = {
  color: '#1C1C1C', // encre — déclinaison par défaut
  mono: 'currentColor',
  light: '#ffffff',
  forest: '#0E4D44',
  terracotta: '#C1592A',
};

// Ratio natif de l'artwork (monogramme lemurien + wordmark "GET")
const LOGO_ASPECT_RATIO = 281 / 248;

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
  const color = TONE_COLORS[tone];
  const width = Math.round(size * LOGO_ASPECT_RATIO);

  const mark = (
    <span
      role="img"
      aria-label="GET"
      className="inline-block shrink-0"
      style={{
        width,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: 'url(/brand/get-logo.png)',
        maskImage: 'url(/brand/get-logo.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );

  if (variant === 'mark') {
    return <span className={cn('inline-flex', className)}>{mark}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {mark}
      <span
        className={cn(
          'block whitespace-nowrap text-[9px] font-semibold leading-tight',
          tone === 'light' ? 'text-white/70' : 'text-muted-foreground'
        )}
      >
        Grandes Écoles de Tananarive
      </span>
    </span>
  );
}
