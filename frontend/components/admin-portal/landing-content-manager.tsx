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
type Locale = 'fr' | 'en';
type Bilingual<T> = { fr: T; en: T };

type Config = {
  hero: Bilingual<Hero>;
  stats: Bilingual<StatItem[]>;
  steps: Bilingual<StepItem[]>;
  actorCards: Bilingual<ActorCardItem[]>;
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
      const response = await apiClient.get('/landing/config/raw');
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
          acteurs de la page d&apos;accueil publique, en français et en
          anglais.
        </p>
        <p className="mt-2 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">
          Les logos des établissements se gèrent depuis « Établissements » ;
          les logos des partenaires financiers depuis « Partenaires
          financiers ». Si un champ anglais est laissé vide, le visiteur
          anglophone verra la version française en attendant.
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

function LocaleField({
  label,
  fr,
  en,
  onChangeFr,
  onChangeEn,
  maxLength,
  rows,
}: {
  label: string;
  fr: string;
  en: string;
  onChangeFr: (value: string) => void;
  onChangeEn: (value: string) => void;
  maxLength: number;
  rows?: number;
}) {
  const Field = rows ? 'textarea' : 'input';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-bold text-[#34406b]">
        {label} <span className="font-normal text-muted-foreground">(FR)</span>
        <Field
          value={fr}
          onChange={(event) => onChangeFr(event.target.value)}
          maxLength={maxLength}
          rows={rows}
          required
          className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-indigo-500"
        />
      </label>
      <label className="block text-xs font-bold text-[#34406b]">
        {label} <span className="font-normal text-muted-foreground">(EN)</span>
        <Field
          value={en}
          onChange={(event) => onChangeEn(event.target.value)}
          maxLength={maxLength}
          rows={rows}
          className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-indigo-500"
        />
      </label>
    </div>
  );
}

function HeroSection({ hero }: { hero: Bilingual<Hero> }) {
  const [content, setContent] = useState(hero);
  const [saving, setSaving] = useState(false);

  const update = (locale: Locale, patch: Partial<Hero>) =>
    setContent((current) => ({ ...current, [locale]: { ...current[locale], ...patch } }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/hero', content);
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
        <LocaleField
          label="Titre"
          fr={content.fr.title}
          en={content.en.title}
          onChangeFr={(value) => update('fr', { title: value })}
          onChangeEn={(value) => update('en', { title: value })}
          maxLength={200}
          rows={2}
        />
        <LocaleField
          label="Sous-titre"
          fr={content.fr.subtitle}
          en={content.en.subtitle}
          onChangeFr={(value) => update('fr', { subtitle: value })}
          onChangeEn={(value) => update('en', { subtitle: value })}
          maxLength={500}
          rows={3}
        />
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}

function StatsSection({ stats }: { stats: Bilingual<StatItem[]> }) {
  const [content, setContent] = useState(stats);
  const [saving, setSaving] = useState(false);

  const update = (locale: Locale, index: number, patch: Partial<StatItem>) =>
    setContent((current) => ({
      ...current,
      [locale]: current[locale].map((item, idx) =>
        idx === index ? { ...item, ...patch } : item,
      ),
    }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/stats', {
        fr: { items: content.fr },
        en: { items: content.en },
      });
      toast.success('Chiffres clés mis à jour');
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer les chiffres clés');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Chiffres clés">
      <form onSubmit={submit} className="space-y-5">
        {content.fr.map((item, index) => (
          <div key={index} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
            <div className="block text-xs font-bold text-[#34406b]">
              Icône
              <Select
                value={item.icon}
                onValueChange={(value) => {
                  if (!value) return;
                  update('fr', index, { icon: value });
                  update('en', index, { icon: value });
                }}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full max-w-xs font-normal">
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
            <LocaleField
              label="Valeur"
              fr={item.value}
              en={content.en[index].value}
              onChangeFr={(value) => update('fr', index, { value })}
              onChangeEn={(value) => update('en', index, { value })}
              maxLength={20}
            />
            <LocaleField
              label="Libellé"
              fr={item.label}
              en={content.en[index].label}
              onChangeFr={(value) => update('fr', index, { label: value })}
              onChangeEn={(value) => update('en', index, { label: value })}
              maxLength={80}
            />
          </div>
        ))}
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}

function StepsSection({ steps }: { steps: Bilingual<StepItem[]> }) {
  const [content, setContent] = useState(steps);
  const [saving, setSaving] = useState(false);

  const update = (locale: Locale, index: number, patch: Partial<StepItem>) =>
    setContent((current) => ({
      ...current,
      [locale]: current[locale].map((item, idx) =>
        idx === index ? { ...item, ...patch } : item,
      ),
    }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/steps', {
        fr: { items: content.fr },
        en: { items: content.en },
      });
      toast.success('Étapes mises à jour');
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer les étapes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Comment ça marche (4 étapes)">
      <form onSubmit={submit} className="space-y-5">
        {content.fr.map((item, index) => (
          <div key={index} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
            <p className="text-xs font-bold text-[#17204e]">Étape {index + 1}</p>
            <LocaleField
              label="Titre"
              fr={item.title}
              en={content.en[index].title}
              onChangeFr={(value) => update('fr', index, { title: value })}
              onChangeEn={(value) => update('en', index, { title: value })}
              maxLength={80}
            />
            <LocaleField
              label="Texte"
              fr={item.text}
              en={content.en[index].text}
              onChangeFr={(value) => update('fr', index, { text: value })}
              onChangeEn={(value) => update('en', index, { text: value })}
              maxLength={200}
            />
          </div>
        ))}
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}

function ActorCardsSection({ actorCards }: { actorCards: Bilingual<ActorCardItem[]> }) {
  const [content, setContent] = useState(actorCards);
  const [saving, setSaving] = useState(false);

  const update = (locale: Locale, index: number, patch: Partial<ActorCardItem>) =>
    setContent((current) => ({
      ...current,
      [locale]: current[locale].map((item, idx) =>
        idx === index ? { ...item, ...patch } : item,
      ),
    }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/landing/config/actor-cards', {
        fr: { items: content.fr },
        en: { items: content.en },
      });
      toast.success('Cartes acteurs mises à jour');
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer les cartes acteurs');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Cartes acteurs (4)">
      <form onSubmit={submit} className="space-y-5">
        {content.fr.map((item, index) => (
          <div key={index} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
            <div className="block text-xs font-bold text-[#34406b]">
              Icône
              <Select
                value={item.icon}
                onValueChange={(value) => {
                  if (!value) return;
                  update('fr', index, { icon: value });
                  update('en', index, { icon: value });
                }}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full max-w-xs font-normal">
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
            <LocaleField
              label="Titre"
              fr={item.title}
              en={content.en[index].title}
              onChangeFr={(value) => update('fr', index, { title: value })}
              onChangeEn={(value) => update('en', index, { title: value })}
              maxLength={80}
            />
            <LocaleField
              label="Texte"
              fr={item.text}
              en={content.en[index].text}
              onChangeFr={(value) => update('fr', index, { text: value })}
              onChangeEn={(value) => update('en', index, { text: value })}
              maxLength={300}
            />
          </div>
        ))}
        <SaveButton saving={saving} />
      </form>
    </SectionCard>
  );
}
