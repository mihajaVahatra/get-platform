'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type SchoolAnnouncement = {
  announcementId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  targetType: string;
  createdAt: string;
  notificationId: string;
  isRead: boolean;
};

export function SchoolNewsFeed() {
  const [items, setItems] = useState<SchoolAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        '/schools/announcements/mine?page=1&limit=20',
      );
      setItems(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement des actualités:', error);
      toast.error('Impossible de charger les actualités');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const markAsRead = async (item: SchoolAnnouncement) => {
    if (item.isRead) return;
    setItems((current) =>
      current.map((entry) =>
        entry.notificationId === item.notificationId
          ? { ...entry, isRead: true }
          : entry,
      ),
    );
    try {
      await apiClient.put(`/notifications/${item.notificationId}/read`);
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
        Chargement des actualités…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Bell className="size-7" />
        </span>
        <p className="mt-4 text-sm font-bold text-slate-700">
          Aucune actualité pour le moment
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Les actualités publiées par votre établissement apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.announcementId}
          onClick={() => void markAsRead(item)}
          className={`cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(68,50,140,0.05)] transition ${
            item.isRead ? 'border-slate-100' : 'border-violet-200'
          }`}
        >
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="h-40 w-full object-cover"
            />
          )}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-extrabold text-[#17204e]">
                {item.title}
              </h3>
              {!item.isRead && (
                <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" />
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {item.body}
            </p>
            <p className="mt-3 text-[10px] text-slate-400">
              {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
