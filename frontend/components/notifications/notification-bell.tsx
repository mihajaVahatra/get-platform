'use client';

import { useCallback, useEffect, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Bell, CheckCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const dateOf = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const refreshUnreadCount = useCallback(() => {
    apiClient
      .get('/notifications/me', { params: { isRead: false, limit: 1 } })
      .then((response) => setUnreadCount(response.data.meta?.total ?? 0))
      .catch(() => setUnreadCount(0));
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    window.addEventListener('notifications:updated', refreshUnreadCount);
    return () =>
      window.removeEventListener('notifications:updated', refreshUnreadCount);
  }, [refreshUnreadCount]);

  const loadNotifications = useCallback(() => {
    setLoading(true);
    apiClient
      .get('/notifications/me', { params: { limit: 8 } })
      .then((response) => setItems(response.data.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiClient.put(`/notifications/${id}/read`);
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      );
      window.dispatchEvent(new Event('notifications:updated'));
    } catch {
      // silencieux : l’état local reste inchangé, l’utilisateur peut réessayer
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/me/read-all');
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      window.dispatchEvent(new Event('notifications:updated'));
    } catch {
      // silencieux : l’état local reste inchangé, l’utilisateur peut réessayer
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) loadNotifications();
      }}
    >
      <Popover.Trigger
        aria-label="Notifications"
        className={cn(
          'relative grid size-9 place-items-center rounded-lg transition',
          dark
            ? 'text-white hover:bg-white/10'
            : 'text-[#17204e] hover:bg-muted',
        )}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-2xl border border-border bg-card shadow-xl duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-extrabold text-[#111949]">
                Notifications
              </p>
              {items.some((item) => !item.isRead) && (
                <button
                  onClick={() => void markAllAsRead()}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:text-indigo-300"
                >
                  <CheckCheck className="size-3.5" /> Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="p-5 text-center text-xs text-muted-foreground">
                  Chargement...
                </p>
              ) : items.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted-foreground">
                  Aucune notification pour le moment.
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => !item.isRead && void markAsRead(item.id)}
                    className={cn(
                      'block w-full border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted',
                      !item.isRead && 'bg-indigo-50/60',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!item.isRead && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#111949]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                          {item.body}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {dateOf(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
