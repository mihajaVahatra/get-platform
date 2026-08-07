'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

const DAYS = [
  { value: '1', label: 'Lundi' },
  { value: '2', label: 'Mardi' },
  { value: '3', label: 'Mercredi' },
  { value: '4', label: 'Jeudi' },
  { value: '5', label: 'Vendredi' },
  { value: '6', label: 'Samedi' },
  { value: '7', label: 'Dimanche' },
];

type Unavailability = {
  id: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
  reason: string | null;
};
type SchoolOption = { school: { id: string; name: string } };
type TravelBuffer = {
  id: string;
  minutesBuffer: number;
  schoolA: { id: string; name: string };
  schoolB: { id: string; name: string };
};

export function TeacherAvailabilityManager() {
  const [unavailability, setUnavailability] = useState<Unavailability[]>([]);
  const [buffers, setBuffers] = useState<TravelBuffer[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);

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

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-[#17204e]">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

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
      <form onSubmit={submit} className="mb-5 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-5">
        <div className="flex gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('recurring')}
            className={`rounded-lg px-3 py-2 ${mode === 'recurring' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            Récurrent
          </button>
          <button
            type="button"
            onClick={() => setMode('exception')}
            className={`rounded-lg px-3 py-2 ${mode === 'exception' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            Date précise
          </button>
        </div>
        {mode === 'recurring' ? (
          <label className="text-xs font-bold text-slate-700">
            Jour
            <select
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(event.target.value)}
              className="mt-1.5 h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-indigo-500"
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-xs font-bold text-slate-700">
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              className="mt-1.5 h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-indigo-500"
            />
          </label>
        )}
        <label className="text-xs font-bold text-slate-700">
          Début
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1.5 h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-indigo-500"
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Fin
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1.5 h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-indigo-500"
          />
        </label>
        <label className="min-w-[160px] flex-1 text-xs font-bold text-slate-700">
          Motif (facultatif)
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex. Rendez-vous médical"
            maxLength={200}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-indigo-500"
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
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune indisponibilité déclarée.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800">
                  {item.dayOfWeek
                    ? DAYS.find((d) => Number(d.value) === item.dayOfWeek)?.label
                    : item.date && new Date(item.date).toLocaleDateString('fr-FR')}
                  {' · '}
                  {item.startTime}–{item.endTime}
                </p>
                {item.reason && <p className="mt-0.5 text-slate-500">{item.reason}</p>}
              </div>
              <button
                type="button"
                aria-label="Supprimer"
                onClick={() => void remove(item.id)}
                className="text-slate-400 hover:text-rose-600"
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

  const remove = async (id: string) => {
    try {
      await apiClient.delete(`/teacher/travel-buffers/${id}`);
      toast.success('Temps de trajet supprimé');
      onChanged();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer');
    }
  };

  if (schools.length < 2) {
    return (
      <SectionCard
        title="Temps de trajet entre mes écoles"
        subtitle="Disponible dès que vous intervenez dans au moins deux établissements."
      >
        <p className="text-sm text-slate-500">
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
      <form onSubmit={submit} className="mb-5 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-5">
        <label className="text-xs font-bold text-slate-700">
          École A
          <select
            value={schoolAId}
            onChange={(event) => selectSchoolA(event.target.value)}
            required
            className="mt-1.5 h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-indigo-500"
          >
            <option value="">Choisir...</option>
            {schools
              .filter(({ school }) => school.id !== schoolBId)
              .map(({ school }) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          École B
          <select
            value={schoolBId}
            onChange={(event) => selectSchoolB(event.target.value)}
            required
            className="mt-1.5 h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-indigo-500"
          >
            <option value="">Choisir...</option>
            {schools
              .filter(({ school }) => school.id !== schoolAId)
              .map(({ school }) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          Marge (minutes)
          <input
            type="number"
            min={0}
            max={480}
            value={minutesBuffer}
            onChange={(event) => setMinutesBuffer(event.target.value)}
            className="mt-1.5 h-9 w-24 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-indigo-500"
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
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun temps de trajet déclaré.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800">
                  {item.schoolA.name} ↔ {item.schoolB.name}
                </p>
                <p className="mt-0.5 text-slate-500">{item.minutesBuffer} minutes minimum</p>
              </div>
              <button
                type="button"
                aria-label="Supprimer"
                onClick={() => void remove(item.id)}
                className="text-slate-400 hover:text-rose-600"
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
