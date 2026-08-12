'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Événement calendaire de l'établissement, tel que renvoyé par `GET /schools/me/events`. */
type SchoolEvent = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
};

/** Formulaire vide par défaut pour la création/modification d'un événement. */
const emptyForm = { title: '', description: '', location: '', startAt: '' };

/** Convertit une date ISO en valeur compatible avec `<input type="datetime-local">` (fuseau local). */
function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Page « Événements » du tableau de bord établissement
 * (route App Router `/dashboard/school/events`).
 * CRUD simple (titre, date/heure, lieu, description) via
 * `GET|POST|PATCH|DELETE /schools/me/events` — affiché aux étudiants
 * inscrits à l'établissement sur leur dashboard (voir
 * StudentService.getUpcomingEvents).
 */
export default function SchoolEventsPage() {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<SchoolEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/schools/me/events');
      setEvents(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement événements:', error);
      toast.error('Impossible de charger les événements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadEvents();
    });
    return () => {
      active = false;
    };
  }, [loadEvents]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (event: SchoolEvent) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      startAt: toDatetimeLocal(event.startAt),
    });
    setFormOpen(true);
  };

  const submitForm = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!form.title.trim() || !form.startAt) {
      toast.error('Le titre et la date sont obligatoires');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      startAt: new Date(form.startAt).toISOString(),
    };
    try {
      setSaving(true);
      if (editingId) {
        await apiClient.patch(`/schools/me/events/${editingId}`, payload);
        toast.success('Événement modifié');
      } else {
        await apiClient.post('/schools/me/events', payload);
        toast.success('Événement créé');
      }
      setFormOpen(false);
      await loadEvents();
    } catch (error) {
      console.error('Erreur enregistrement événement:', error);
      toast.error("Impossible d'enregistrer l'événement");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/schools/me/events/${eventToDelete.id}`);
      toast.success('Événement supprimé');
      setEventToDelete(null);
      await loadEvents();
    } catch (error) {
      console.error('Erreur suppression événement:', error);
      toast.error("Impossible de supprimer l'événement");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#111949]">Événements</h1>
          <p className="text-xs text-muted-foreground">
            Visibles par tous les étudiants inscrits à votre établissement.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Nouvel événement
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Chargement des événements…
            </p>
          ) : events.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Aucun événement à venir. Crée le premier avec « Nouvel événement ».
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-50 p-3"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <CalendarDays className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#17204e]">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      }).format(new Date(event.startAt))}
                      {event.location && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {event.location}
                        </span>
                      )}
                    </p>
                    {event.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Modifier ${event.title}`}
                      onClick={() => openEdit(event)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-slate-50 hover:text-indigo-600"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer ${event.title}`}
                      onClick={() => setEventToDelete(event)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={submitForm}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modifier l'événement" : 'Nouvel événement'}
              </DialogTitle>
              <DialogDescription>
                Titre, date/heure et lieu sont affichés aux étudiants inscrits.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Label className="text-xs font-bold text-[#34406b]">
                Titre
                <Input
                  className="mt-1"
                  maxLength={160}
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </Label>
              <Label className="text-xs font-bold text-[#34406b]">
                Date et heure
                <input
                  type="datetime-local"
                  required
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-indigo-500"
                  value={form.startAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startAt: event.target.value }))
                  }
                />
              </Label>
              <Label className="text-xs font-bold text-[#34406b]">
                Lieu (facultatif)
                <Input
                  className="mt-1"
                  maxLength={200}
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, location: event.target.value }))
                  }
                />
              </Label>
              <Label className="text-xs font-bold text-[#34406b]">
                Description (facultatif)
                <textarea
                  maxLength={2000}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eventToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setEventToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;événement</DialogTitle>
            <DialogDescription>
              L&apos;événement « {eventToDelete?.title} » sera supprimé
              définitivement. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setEventToDelete(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void deleteEvent()}
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
