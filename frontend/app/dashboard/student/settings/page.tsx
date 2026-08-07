'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { AvatarUpload } from '@/components/AvatarUpload';

type ThemePreference = 'light' | 'dark' | 'system';

type StudentProfile = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  user: { email: string; theme?: ThemePreference };
};

function applyTheme(theme: string) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Système' },
];

export default function StudentSettingsPage() {
  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'preferences'
  >('profile');
  const tabs = [
    ['profile', 'Mon profil'],
    ['security', 'Sécurité'],
    ['preferences', 'Préférences'],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl text-foreground">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">Profil & Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre photo, votre sécurité et vos préférences.
        </p>
      </header>
      <nav className="mb-5 flex gap-5 border-b border-border text-xs font-bold">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`whitespace-nowrap border-b-2 px-1 py-3 ${activeTab === id ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-muted-foreground hover:text-indigo-600 dark:text-indigo-300'}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'security' && <SecurityTab />}
      {activeTab === 'preferences' && <PreferencesTab />}
    </div>
  );
}

function ProfileTab() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/students/me')
      .then((response) => setProfile(response.data.data as StudentProfile))
      .catch(() => toast.error('Impossible de charger votre profil'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="py-8 text-sm text-muted-foreground">Chargement…</p>;
  }
  if (!profile) {
    return (
      <p className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">
        Votre profil n’a pas pu être chargé.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <AvatarUpload
          currentUrl={profile.avatarUrl ?? undefined}
          endpoint="/students/me/avatar"
          fallbackText={`${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`}
          firstName={profile.firstName}
          lastName={profile.lastName}
          onUpload={(avatarUrl) =>
            setProfile((current) => (current ? { ...current, avatarUrl } : current))
          }
        />
        <p className="mt-3 font-bold text-[#16204d]">
          {profile.firstName} {profile.lastName}
        </p>
        <p className="text-xs text-muted-foreground">{profile.user.email}</p>
        <Link
          href="/dashboard/student/profile"
          className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:underline"
        >
          Modifier mes informations personnelles
        </Link>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('La confirmation ne correspond pas au nouveau mot de passe');
      return;
    }
    void (async () => {
      try {
        setSaving(true);
        await apiClient.patch('/students/me/password', {
          currentPassword,
          newPassword,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Mot de passe mis à jour');
      } catch (error) {
        console.error('Erreur changement de mot de passe:', error);
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        toast.error(
          status === 400
            ? 'Le mot de passe actuel est incorrect'
            : 'Impossible de mettre à jour le mot de passe',
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-extrabold">Mot de passe</h2>
      <form className="mt-4 max-w-sm space-y-4" onSubmit={submit}>
        <label className="block text-xs font-bold text-foreground">
          Mot de passe actuel
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        <label className="block text-xs font-bold text-foreground">
          Nouveau mot de passe
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        <label className="block text-xs font-bold text-foreground">
          Confirmer le nouveau mot de passe
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        <p className="text-[10px] text-muted-foreground">
          Au moins 8 caractères, avec une majuscule, une minuscule, un chiffre
          et un caractère spécial (@$!%*?&amp;).
        </p>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
        </button>
      </form>
    </div>
  );
}

function PreferencesTab() {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTheme = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/students/me');
      const profile = response.data.data as StudentProfile;
      setTheme(profile.user.theme || 'system');
    } catch (error) {
      console.error('Erreur chargement préférences étudiant:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      return fetchTheme();
    });
  }, [fetchTheme]);

  const selectTheme = (value: ThemePreference) => {
    const previous = theme;
    setTheme(value);
    applyTheme(value);
    void (async () => {
      try {
        setSaving(true);
        await apiClient.patch('/students/me/theme', { theme: value });
        toast.success('Préférence enregistrée');
      } catch (error) {
        console.error('Erreur mise à jour du thème:', error);
        setTheme(previous);
        applyTheme(previous);
        toast.error('Impossible d’enregistrer votre préférence');
      } finally {
        setSaving(false);
      }
    })();
  };

  if (loading) {
    return <p className="py-8 text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-extrabold">Apparence</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Choisissez l’apparence de l’application sur cet appareil.
      </p>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving}
            className={`rounded-lg border px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
              theme === option.value
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-border text-muted-foreground hover:border-indigo-200'
            }`}
            onClick={() => selectTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
