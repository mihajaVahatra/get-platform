'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STAT_ICONS = [
  'ShieldCheck',
  'BadgeCheck',
  'Sparkles',
  'Building2',
  'UserRound',
  'ClipboardCheck',
] as const;

const ACTOR_ICONS = ['GraduationCap', 'Building2', 'Landmark', 'ShieldCheck'] as const;

type Hero = { title: string; subtitle: string };
type StatItem = { icon: string; value: string; label: string };
type StepItem = { title: string; text: string };
type ActorCardItem = { icon: string; title: string; text: string };

type Config = {
  hero: Hero;
  stats: StatItem[];
  steps: StepItem[];
  actorCards: ActorCardItem[];
};

function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

export function LandingContentManager() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/landing/config');
      setConfig(response.data.data);
    } catch (error) {
      console.error('Erreur chargement config landing:', error);
      toast.error('Impossible de charger le contenu de la landing page');
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

  if (loading || !config) {
    return (
      <div className="mx-auto max-w-[1100px] py-12 text-center text-sm text-slate-500">
        Chargement du contenu...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Contenu de la landing page
        </h1>
        <p className="mt-1 text-sm text-indigo-600">
          Modifiez le hero, les chiffres clés, les étapes et les cartes
          acteurs de la page d&apos;accueil publique.
        </p>
        <p className="mt-2 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">
          Les logos des établissements se gèrent depuis « Établissements » ;
          les logos des partenaires financiers depuis « Partenaires
          financiers ».
        </p>
      </header>
      <HeroSection hero={config.hero} />
      <StatsSection stats={config.stats} />
      <StepsSection steps={config.steps} />
      <ActorCardsSection actorCards={config.actorCards} />
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-[#17204e]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SaveButton({ saving }: { saving: boolean }) {
  return (
    <div className="mt-4 flex justify-end">
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  );
}

function HeroSection({ hero }: { hero: Hero }) {
  const [title, setTitle] = useState(hero.title);
  const [subtitle, setSubtitle] = useState(hero.subtitle);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/hero', { title, subtitle });
      toast.success('Hero mis à jour');
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer le hero');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Hero">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-bold text-[#34406b]">
          Titre
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            rows={2}
            required
            className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-indigo-500"
          />
        </label>
        <label className="block text-xs font-bold text-[#34406b]">
          Sous-titre
          <textarea
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            maxLength={500}
            rows={3}
            required
            className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-indigo-500"
          />
        </label>
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}

function StatsSection({ stats }: { stats: StatItem[] }) {
  const [items, setItems] = useState(stats);
  const [saving, setSaving] = useState(false);

  const update = (index: number, patch: Partial<StatItem>) =>
    setItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/stats', { items });
      toast.success('Chiffres clés mis à jour');
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer les chiffres clés');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Chiffres clés">
      <form onSubmit={submit} className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-3">
            <div className="block text-xs font-bold text-[#34406b]">
              Icône
              <Select
                value={item.icon}
                onValueChange={(value) => value && update(index, { icon: value })}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full font-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAT_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="block text-xs font-bold text-[#34406b]">
              Valeur
              <input
                value={item.value}
                onChange={(event) => update(index, { value: event.target.value })}
                maxLength={20}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-xs font-bold text-[#34406b]">
              Libellé
              <input
                value={item.label}
                onChange={(event) => update(index, { label: event.target.value })}
                maxLength={80}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
          </div>
        ))}
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}

function StepsSection({ steps }: { steps: StepItem[] }) {
  const [items, setItems] = useState(steps);
  const [saving, setSaving] = useState(false);

  const update = (index: number, patch: Partial<StepItem>) =>
    setItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/steps', { items });
      toast.success('Étapes mises à jour');
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer les étapes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Comment ça marche (4 étapes)">
      <form onSubmit={submit} className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-[#34406b]">
              Étape {index + 1} — titre
              <input
                value={item.title}
                onChange={(event) => update(index, { title: event.target.value })}
                maxLength={80}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-xs font-bold text-[#34406b]">
              Texte
              <input
                value={item.text}
                onChange={(event) => update(index, { text: event.target.value })}
                maxLength={200}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
          </div>
        ))}
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}

function ActorCardsSection({ actorCards }: { actorCards: ActorCardItem[] }) {
  const [items, setItems] = useState(actorCards);
  const [saving, setSaving] = useState(false);

  const update = (index: number, patch: Partial<ActorCardItem>) =>
    setItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/actor-cards', { items });
      toast.success('Cartes acteurs mises à jour');
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer les cartes acteurs');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Cartes acteurs (4)">
      <form onSubmit={submit} className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-3">
            <div className="block text-xs font-bold text-[#34406b]">
              Icône
              <Select
                value={item.icon}
                onValueChange={(value) => value && update(index, { icon: value })}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full font-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTOR_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="block text-xs font-bold text-[#34406b]">
              Titre
              <input
                value={item.title}
                onChange={(event) => update(index, { title: event.target.value })}
                maxLength={80}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-xs font-bold text-[#34406b]">
              Texte
              <input
                value={item.text}
                onChange={(event) => update(index, { text: event.target.value })}
                maxLength={300}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
          </div>
        ))}
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}
