'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type BroadcastHistoryItem = {
  title: string;
  body: string;
  createdAt: string;
  schoolsReached: number;
};

const dateOf = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

export function AnnouncementsBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/schools/announcements/broadcast');
      setHistory(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement historique des annonces:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadHistory();
    });
    return () => {
      active = false;
    };
  }, [loadHistory]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      setSending(true);
      const response = await apiClient.post('/schools/announcements/broadcast', {
        title: title.trim(),
        body: body.trim(),
      });
      const { schoolsCount, recipientCount } = response.data.data;
      toast.success(
        `Annonce envoyée à ${recipientCount} étudiant${recipientCount > 1 ? 's' : ''} dans ${schoolsCount} établissement${schoolsCount > 1 ? 's' : ''}`,
      );
      setTitle('');
      setBody('');
      await loadHistory();
    } catch (error: unknown) {
      toast.error(
        (error as { response?: { data?: { message?: string } } }).response
          ?.data?.message || 'Impossible d’envoyer cette annonce',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Annonces
        </h1>
        <p className="mt-1 text-sm text-violet-600">
          Diffusez une annonce à tous les étudiants de tous les établissements
          actifs.
        </p>
      </header>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-extrabold text-[#17204e]">
            <Megaphone className="size-5 text-violet-600" />
            Nouvelle annonce plateforme
          </h2>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block text-xs font-bold text-[#34406b]">
              Titre
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                placeholder="Ex. Maintenance planifiée ce week-end"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500"
              />
            </label>
            <label className="block text-xs font-bold text-[#34406b]">
              Message
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={5000}
                required
                rows={5}
                placeholder="Rédigez votre annonce..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-violet-500"
              />
            </label>
            <p className="rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-700">
              Cette annonce sera envoyée aux étudiants inscrits dans tous les
              établissements actifs de la plateforme.
            </p>
            <button
              type="submit"
              disabled={sending || !title.trim() || !body.trim()}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-4" />
              {sending ? 'Envoi en cours...' : 'Diffuser à toutes les écoles'}
            </button>
          </form>
        </section>
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-[#17204e]">
            Historique des diffusions
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Chargement...</p>
          ) : history.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Aucune annonce plateforme envoyée pour le moment.
            </p>
          ) : (
            <div className="mt-4 space-y-2 text-[11px]">
              {history.map((item) => (
                <div
                  key={`${item.title}-${item.createdAt}`}
                  className="rounded-xl border border-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-[#28315e]">{item.title}</p>
                    <span className="shrink-0 rounded bg-violet-50 px-2 py-1 font-bold text-violet-600">
                      {item.schoolsReached} école
                      {item.schoolsReached > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-slate-500">
                    {item.body}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {dateOf(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
