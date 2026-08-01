'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ChevronRight, Edit3, Newspaper, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type NewsItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  isPublished: boolean;
  displayOrder: number;
  publishedAt: string;
};

function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

const PAGE_SIZE = 20;

export function LandingNewsManager() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [toDelete, setToDelete] = useState<NewsItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/landing/news/admin', {
        params: { page, limit: PAGE_SIZE },
      });
      setItems(response.data.data.items || []);
      setMeta(response.data.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement actualités:', error);
      toast.error('Impossible de charger les actualités');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchNews();
    });
    return () => {
      active = false;
    };
  }, [fetchNews]);

  const removeNews = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/landing/news/${toDelete.id}`);
      toast.success('Actualité supprimée');
      setToDelete(null);
      await fetchNews();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer cette actualité');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Actualités du site
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Publiez les actualités affichées sur la page d&apos;accueil
            publique.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setModal('create');
          }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200"
        >
          <Plus className="size-4" />
          Ajouter une actualité
        </button>
      </header>
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des actualités...
          </p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune actualité pour le moment.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {items.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.imageUrl}
                    alt=""
                    className="size-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                    <Newspaper className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {row.title}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">{row.body}</p>
                  <div className="mt-1.5 flex gap-2">
                    <span className="rounded bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-600">
                      {row.type}
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-bold ${row.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {row.isPublished ? 'Publiée' : 'Brouillon'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-violet-600">
                  <button
                    aria-label={`Modifier ${row.title}`}
                    onClick={() => {
                      setSelected(row);
                      setModal('edit');
                    }}
                  >
                    <Edit3 className="size-4" />
                  </button>
                  <button
                    aria-label={`Supprimer ${row.title}`}
                    className="text-red-500"
                    onClick={() => setToDelete(row)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} actualité
              {meta.total > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4 rotate-180" />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </section>
      {modal && (
        <NewsForm
          news={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void fetchNews();
          }}
        />
      )}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="font-extrabold text-[#17204e]">
              Supprimer l&apos;actualité
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Voulez-vous vraiment supprimer « {toDelete.title} » ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={() => void removeNews()}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewsForm({
  news,
  onClose,
  onSaved,
}: {
  news: NewsItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState(news?.type || 'ACTUALITÉ');
  const [title, setTitle] = useState(news?.title || '');
  const [body, setBody] = useState(news?.body || '');
  const [isPublished, setIsPublished] = useState(news?.isPublished ?? true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const payload = { type: type.trim(), title: title.trim(), body: body.trim(), isPublished };
    try {
      setSaving(true);
      let newsId = news?.id;
      if (news) {
        await apiClient.patch(`/landing/news/${news.id}`, payload);
        toast.success('Actualité mise à jour');
      } else {
        const response = await apiClient.post('/landing/news', payload);
        newsId = response.data.data.id;
        toast.success('Actualité créée');
      }
      if (photo && newsId) {
        const form = new FormData();
        form.append('file', photo);
        await apiClient.post(`/landing/news/${newsId}/photo`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      onSaved();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer cette actualité');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="font-extrabold text-[#17204e]">
          {news ? "Modifier l'actualité" : 'Nouvelle actualité'}
        </h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-xs font-bold text-[#34406b]">
            Catégorie
            <input
              value={type}
              onChange={(event) => setType(event.target.value)}
              maxLength={40}
              required
              placeholder="Ex. INSCRIPTIONS, CONCOURS, ACTUALITÉ"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-xs font-bold text-[#34406b]">
            Titre
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-xs font-bold text-[#34406b]">
            Texte
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              rows={4}
              required
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-xs font-bold text-[#34406b]">
            Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-violet-700 hover:file:bg-violet-100"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-[#34406b]">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(event) => setIsPublished(event.target.checked)}
            />
            Publiée sur la page d&apos;accueil
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
