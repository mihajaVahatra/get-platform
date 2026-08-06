'use client';

import Image from 'next/image';

interface DefaultAvatarProps {
  gender?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  className?: string;
}

export function DefaultAvatar({ gender, size = 40, className = '' }: DefaultAvatarProps) {
  const isFemale = gender?.toUpperCase() === 'FEMALE';
  const src = isFemale ? '/avatars/default-female.png' : '/avatars/default-male.png';

  return <div className={`relative flex shrink-0 overflow-hidden rounded-full bg-indigo-50 ${className}`} style={{ width: size, height: size }}><Image src={src} alt={isFemale ? 'Avatar par défaut féminin' : 'Avatar par défaut masculin'} fill sizes={`${size}px`} className="object-cover" priority={size >= 80} /></div>;
}
