'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
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

export default function StudentSettingsPage() {
  const t = useTranslations('StudentSettings');
  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'preferences'
  >('profile');
  const tabs = [
    ['profile', t('tabs.profile')],
    ['security', t('tabs.security')],
    ['preferences', t('tabs.preferences')],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl text-foreground">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('subtitle')}
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
  const t = useTranslations('StudentSettings');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/students/me')
      .then((response) => setProfile(response.data.data as StudentProfile))
      .catch(() => toast.error(t('loadProfileError')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p className="py-8 text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!profile) {
    return (
      <p className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">
        {t('profileLoadFailed')}
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
          {t('editPersonalInfo')}
        </Link>
      </div>
    </div>
  );
}

function SecurityTab() {
  const t = useTranslations('StudentSettings');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
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
        toast.success(t('passwordUpdated'));
      } catch (error) {
        console.error('Erreur changement de mot de passe:', error);
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        toast.error(
          status === 400
            ? t('currentPasswordWrong')
            : t('passwordUpdateError'),
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-extrabold">{t('passwordSectionTitle')}</h2>
      <form className="mt-4 max-w-sm space-y-4" onSubmit={submit}>
        <label className="block text-xs font-bold text-foreground">
          {t('currentPassword')}
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
          {t('newPassword')}
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
          {t('confirmPassword')}
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
          {t('passwordHint')}
        </p>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? t('updating') : t('updatePassword')}
        </button>
      </form>
    </div>
  );
}

function PreferencesTab() {
  const t = useTranslations('StudentSettings');
  const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: t('themeOptions.light') },
    { value: 'dark', label: t('themeOptions.dark') },
    { value: 'system', label: t('themeOptions.system') },
  ];
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
        toast.success(t('preferenceSaved'));
      } catch (error) {
        console.error('Erreur mise à jour du thème:', error);
        setTheme(previous);
        applyTheme(previous);
        toast.error(t('preferenceSaveError'));
      } finally {
        setSaving(false);
      }
    })();
  };

  if (loading) {
    return <p className="py-8 text-sm text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-extrabold">{t('appearanceTitle')}</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        {t('appearanceSubtitle')}
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
