'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function MessageIconLink({
  href,
  dark = false,
}: {
  href: string;
  dark?: boolean;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      apiClient
        .get('/messages/unread-count')
        .then((response) => setUnreadCount(response.data.data?.count ?? 0))
        .catch(() => setUnreadCount(0));
    };
    refresh();
    window.addEventListener('messages:updated', refresh);
    return () => window.removeEventListener('messages:updated', refresh);
  }, []);

  return (
    <Link
      href={href}
      aria-label="Messages"
      className={cn(
        'relative grid size-9 place-items-center rounded-lg transition',
        dark ? 'text-white hover:bg-white/10' : 'text-[#17204e] hover:bg-slate-100',
      )}
    >
      <Mail className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
