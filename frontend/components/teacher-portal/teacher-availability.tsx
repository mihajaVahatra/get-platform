'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Extrait le message d'erreur métier renvoyé par l'API (payload Axios) s'il existe, pour l'afficher dans un toast. */
function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

/** Jours de la semaine proposés dans le sélecteur d'indisponibilité récurrente (valeurs en chaîne pour le composant `Select`). */
const DAYS = [
  { value: '1', label: 'Lundi' },
  { value: '2', label: 'Mardi' },
  { value: '3', label: 'Mercredi' },
  { value: '4', label: 'Jeudi' },
  { value: '5', label: 'Vendredi' },
  { value: '6', label: 'Samedi' },
  { value: '7', label: 'Dimanche' },
];

/**
 * Créneau d'indisponibilité du professeur : soit récurrent (`dayOfWeek` renseigné),
 * soit ponctuel (`date` renseignée) — les deux champs sont mutuellement exclusifs.
 */
type Unavailability = {
  id: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
  reason: string | null;
};
/** Établissement dans lequel le professeur intervient (option de sélection). */
type SchoolOption = { school: { id: string; name: string } };
/** Marge de temps de trajet minimale déclarée entre deux établissements. */
type TravelBuffer = {
  id: string;
  minutesBuffer: number;
  schoolA: { id: string; name: string };
  schoolB: { id: string; name: string };
};

/**
 * Vue "Disponibilités" du portail professeur : regroupe la gestion des
 * indisponibilités (récurrentes ou ponctuelles) et des temps de trajet
 * minimums entre établissements.
 *
 * Charge en parallèle les indisponibilités (`/teacher/availability`), les
 * temps de trajet (`/teacher/travel-buffers`) et la liste des écoles du
 * professeur (`/teacher/courses/schools`), puis délègue l'affichage et les
 * mutations aux sous-sections `UnavailabilitySection` et `TravelBufferSection`.
 */
export function TeacherAvailabilityManager() {
  const [unavailability, setUnavailability] = useState<Unavailability[]>([]);
  const [buffers, setBuffers] = useState<TravelBuffer[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);

  /** Recharge en une fois les trois ressources de la vue (indisponibilités, temps de trajet, écoles). */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [unavailRes, bufferRes, schoolsRes] = await Promise.all([
        apiClient.get('/teacher/availability'),
        apiClient.get('/teacher/travel-buffers'),
        apiClient.get('/teacher/courses/schools'),
      ]);
      setUnavailability(unavailRes.data.data || []);
      setBuffers(bufferRes.data.data || []);
      setSchools(schoolsRes.data.data || []);
    } catch (error) {
      console.error('Erreur chargement disponibilités:', error);
      toast.error('Impossible de charger vos disponibilités');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadAll();
    });
    return () => {
      active = false;
    };
  }, [loadAll]);

  return (
    <div className="space-y-6">
      <UnavailabilitySection
        items={unavailability}
        loading={loading}
        onChanged={loadAll}
      />
      <TravelBufferSection
        items={buffers}
        schools={schools}
        loading={loading}
        onChanged={loadAll}
      />
    </div>
  );
}

/** Carte de section générique (titre + sous-titre + contenu) réutilisée pour chaque bloc de la vue Disponibilités. */
function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-extrabold text-[#17204e]">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Formulaire et liste de gestion des indisponibilités du professeur.
 * Permet de basculer entre un mode "récurrent" (jour de semaine) et
 * "date précise" (exception ponctuelle), de déclarer un créneau via
 * `POST /teacher/availability` et de le supprimer via
 * `DELETE /teacher/availability/:id`. `onChanged` déclenche un rechargement
 * de la liste depuis le composant parent après chaque mutation.
 */
function UnavailabilitySection({
  items,
  loading,
  onChanged,
}: {
  items: Unavailability[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<'recurring' | 'exception'>('recurring');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Envoie soit `dayOfWeek` (récurrent) soit `date` (exception ponctuelle), jamais les deux,
  // conformément à l'exclusivité mutuelle du type `Unavailability`.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        await apiClient.post('/teacher/availability', {
          dayOfWeek: mode === 'recurring' ? Number(dayOfWeek) : undefined,
          date: mode === 'exception' ? date : undefined,
          startTime,
          endTime,
          reason: reason || undefined,
        });
        toast.success('Indisponibilité déclarée');
        setReason('');
        onChanged();
      } catch (error) {
        toast.error(axiosMessage(error) || 'Impossible de déclarer cette indisponibilité');
      } finally {
        setSaving(false);
      }
    })();
  };

  /** Supprime une indisponibilité déclarée et rafraîchit la liste. */
  const remove = async (id: string) => {
    try {
      await apiClient.delete(`/teacher/availability/${id}`);
      toast.success('Indisponibilité supprimée');
      onChanged();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer');
    }
  };

  return (
    <SectionCard
      title="Mes indisponibilités"
      subtitle="Déclarez les créneaux où vous ne pouvez pas enseigner, qu'ils soient récurrents ou ponctuels."
    >
      <form onSubmit={submit} className="mb-5 flex flex-wrap items-end gap-3 border-b border-border pb-5">
        <div className="flex gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('recurring')}
            className={`rounded-lg px-3 py-2 ${mode === 'recurring' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
          >
            Récurrent
          </button>
          <button
            type="button"
            onClick={() => setMode('exception')}
            className={`rounded-lg px-3 py-2 ${mode === 'exception' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
          >
            Date précise
          </button>
        </div>
        {mode === 'recurring' ? (
          <div className="text-xs font-bold text-foreground">
            Jour
            <Select items={DAYS} value={dayOfWeek} onValueChange={(value) => setDayOfWeek(value ?? '1')}>
              <SelectTrigger className="mt-1.5 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <label className="text-xs font-bold text-foreground">
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              className="mt-1.5 h-9 rounded-lg border border-border px-2 text-xs outline-none focus:border-indigo-500"
            />
          </label>
        )}
        <label className="text-xs font-bold text-foreground">
          Début
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1.5 h-9 rounded-lg border border-border px-2 text-xs outline-none focus:border-indigo-500"
          />
        </label>
        <label className="text-xs font-bold text-foreground">
          Fin
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1.5 h-9 rounded-lg border border-border px-2 text-xs outline-none focus:border-indigo-500"
          />
        </label>
        <label className="min-w-[160px] flex-1 text-xs font-bold text-foreground">
          Motif (facultatif)
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex. Rendez-vous médical"
            maxLength={200}
            className="mt-1.5 h-9 w-full rounded-lg border border-border px-2 text-xs outline-none focus:border-indigo-500"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white disabled:opacity-60"
        >
          <Plus className="size-4" /> Ajouter
        </button>
      </form>
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune indisponibilité déclarée.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground">
                  {item.dayOfWeek
                    ? DAYS.find((d) => Number(d.value) === item.dayOfWeek)?.label
                    : item.date && new Date(item.date).toLocaleDateString('fr-FR')}
                  {' · '}
                  {item.startTime}–{item.endTime}
                </p>
                {item.reason && <p className="mt-0.5 text-muted-foreground">{item.reason}</p>}
              </div>
              <button
                type="button"
                aria-label="Supprimer"
                onClick={() => void remove(item.id)}
                className="text-muted-foreground hover:text-rose-600 dark:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * Formulaire et liste de gestion des temps de trajet minimums entre deux
 * établissements du professeur. N'affiche le formulaire que si le
 * professeur intervient dans au moins deux écoles ; sinon affiche un
 * message explicatif. Crée un temps de trajet via
 * `POST /teacher/travel-buffers` et le supprime via
 * `DELETE /teacher/travel-buffers/:id`.
 */
function TravelBufferSection({
  items,
  schools,
  loading,
  onChanged,
}: {
  items: TravelBuffer[];
  schools: SchoolOption[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [schoolAId, setSchoolAId] = useState('');
  const [schoolBId, setSchoolBId] = useState('');
  const [minutesBuffer, setMinutesBuffer] = useState('30');
  const [saving, setSaving] = useState(false);

  // Empêche de sélectionner deux fois la même école : si l'école choisie côté A
  // est déjà sélectionnée côté B (ou inversement), on réinitialise l'autre champ.
  const selectSchoolA = (value: string) => {
    setSchoolAId(value);
    if (value && value === schoolBId) setSchoolBId('');
  };
  const selectSchoolB = (value: string) => {
    setSchoolBId(value);
    if (value && value === schoolAId) setSchoolAId('');
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        await apiClient.post('/teacher/travel-buffers', {
          schoolAId,
          schoolBId,
          minutesBuffer: Number(minutesBuffer),
        });
        toast.success('Temps de trajet enregistré');
        onChanged();
      } catch (error) {
        toast.error(axiosMessage(error) || "Impossible d'enregistrer ce temps de trajet");
      } finally {
        setSaving(false);
      }
    })();
  };

  /** Supprime un temps de trajet déclaré et rafraîchit la liste. */
  const remove = async (id: string) => {
    try {
      await apiClient.delete(`/teacher/travel-buffers/${id}`);
      toast.success('Temps de trajet supprimé');
      onChanged();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer');
    }
  };

  // Règle métier : un temps de trajet n'a de sens qu'entre deux établissements distincts,
  // on masque donc le formulaire tant que le professeur n'est affecté qu'à une seule école.
  if (schools.length < 2) {
    return (
      <SectionCard
        title="Temps de trajet entre mes écoles"
        subtitle="Disponible dès que vous intervenez dans au moins deux établissements."
      >
        <p className="text-sm text-muted-foreground">
          Vous n&apos;êtes actuellement affecté qu&apos;à un seul établissement.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Temps de trajet entre mes écoles"
      subtitle="Déclarez la marge minimale nécessaire pour vous déplacer d'un établissement à l'autre."
    >
      <form onSubmit={submit} className="mb-5 flex flex-wrap items-end gap-3 border-b border-border pb-5">
        <div className="text-xs font-bold text-foreground">
          École A
          <Select
            items={schools
              .filter(({ school }) => school.id !== schoolBId)
              .map(({ school }) => ({ value: school.id, label: school.name }))}
            value={schoolAId}
            onValueChange={(value) => selectSchoolA(value ?? '')}
            required
          >
            <SelectTrigger className="mt-1.5 h-9 text-xs">
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {schools
                .filter(({ school }) => school.id !== schoolBId)
                .map(({ school }) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs font-bold text-foreground">
          École B
          <Select
            items={schools
              .filter(({ school }) => school.id !== schoolAId)
              .map(({ school }) => ({ value: school.id, label: school.name }))}
            value={schoolBId}
            onValueChange={(value) => selectSchoolB(value ?? '')}
            required
          >
            <SelectTrigger className="mt-1.5 h-9 text-xs">
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {schools
                .filter(({ school }) => school.id !== schoolAId)
                .map(({ school }) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <label className="text-xs font-bold text-foreground">
          Marge (minutes)
          <input
            type="number"
            min={0}
            max={480}
            value={minutesBuffer}
            onChange={(event) => setMinutesBuffer(event.target.value)}
            className="mt-1.5 h-9 w-24 rounded-lg border border-border px-2 text-xs outline-none focus:border-indigo-500"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !schoolAId || !schoolBId}
          className="flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white disabled:opacity-60"
        >
          <Plus className="size-4" /> Enregistrer
        </button>
      </form>
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun temps de trajet déclaré.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground">
                  {item.schoolA.name} ↔ {item.schoolB.name}
                </p>
                <p className="mt-0.5 text-muted-foreground">{item.minutesBuffer} minutes minimum</p>
              </div>
              <button
                type="button"
                aria-label="Supprimer"
                onClick={() => void remove(item.id)}
                className="text-muted-foreground hover:text-rose-600 dark:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
