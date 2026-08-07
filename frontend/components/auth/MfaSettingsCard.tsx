'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ShieldCheck, ShieldOff, LoaderCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type EnrollState = {
  qrCode: string;
  secret: string;
} | null;

function axiosMessage(error: unknown, fallback: string) {
  return axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || fallback
    : fallback;
}

/**
 * Activation/désactivation de la double authentification (TOTP), pour les
 * comptes ADMIN_GET / SCHOOL_ADMIN / MINISTRY. Sans cet écran, le MFA côté
 * backend est inutilisable : il n'existait aucun moyen de l'activer.
 */
export function MfaSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((response) => setMfaEnabled(Boolean(response.data.data.user.mfaEnabled)))
      .catch((error) => console.error('Erreur chargement du statut MFA:', error))
      .finally(() => setLoading(false));
  }, []);

  const startEnroll = async () => {
    setSubmitting(true);
    try {
      const response = await apiClient.post('/auth/mfa/enable');
      setEnroll(response.data.data);
      setCode('');
    } catch (error) {
      toast.error(axiosMessage(error, "Impossible de démarrer l'activation du MFA"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmEnroll = async () => {
    if (code.length !== 6) {
      toast.error('Saisissez le code à 6 chiffres de votre application');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/auth/mfa/verify', { code });
      toast.success('Double authentification activée');
      setMfaEnabled(true);
      setEnroll(null);
      setCode('');
    } catch (error) {
      toast.error(axiosMessage(error, 'Code invalide'));
    } finally {
      setSubmitting(false);
    }
  };

  const disable = async () => {
    if (code.length !== 6) {
      toast.error('Saisissez le code à 6 chiffres de votre application');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/auth/mfa/disable', { code });
      toast.success('Double authentification désactivée');
      setMfaEnabled(false);
      setDisableOpen(false);
      setCode('');
    } catch (error) {
      toast.error(axiosMessage(error, 'Code invalide'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Chargement…
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-[#17204e]">Double authentification (MFA)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Protège ton compte avec un code à usage unique généré par une
            application comme Google Authenticator ou Authy, en plus de ton
            mot de passe.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${mfaEnabled ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}
        >
          {mfaEnabled ? 'Activée' : 'Désactivée'}
        </span>
      </div>

      {!mfaEnabled && !enroll && (
        <button
          onClick={() => void startEnroll()}
          disabled={submitting}
          className="mt-5 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <ShieldCheck className="size-4" />
          {submitting ? 'Préparation…' : 'Activer la double authentification'}
        </button>
      )}

      {enroll && (
        <div className="mt-5 grid gap-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 sm:grid-cols-[auto_1fr]">
          <img
            src={enroll.qrCode}
            alt="QR code à scanner avec votre application d'authentification"
            className="size-40 rounded-lg border border-white bg-card p-2"
          />
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              1. Scannez ce QR code avec votre application d'authentification.
              <br />
              2. Ou saisissez la clé manuellement :{' '}
              <code className="rounded bg-card px-1.5 py-0.5 text-xs">
                {enroll.secret}
              </code>
            </p>
            <div>
              <label className="text-xs font-bold text-[#34406b]">
                Code à 6 chiffres
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="123456"
                  className="mt-1 block h-10 w-40 rounded-lg border border-border px-3 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void confirmEnroll()}
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {submitting ? 'Vérification…' : 'Confirmer et activer'}
              </button>
              <button
                onClick={() => {
                  setEnroll(null);
                  setCode('');
                }}
                className="rounded-lg px-4 py-2 text-xs font-bold text-muted-foreground"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {mfaEnabled && !disableOpen && (
        <button
          onClick={() => setDisableOpen(true)}
          className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:bg-rose-500/15"
        >
          <ShieldOff className="size-4" />
          Désactiver la double authentification
        </button>
      )}

      {disableOpen && (
        <div className="mt-5 space-y-3 rounded-xl border border-rose-100 bg-rose-50/40 p-4">
          <p className="text-sm text-muted-foreground">
            Saisissez un code de votre application pour confirmer la
            désactivation.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="block h-10 w-40 rounded-lg border border-border px-3 text-sm outline-none focus:border-rose-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void disable()}
              disabled={submitting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {submitting ? 'Vérification…' : 'Confirmer la désactivation'}
            </button>
            <button
              onClick={() => {
                setDisableOpen(false);
                setCode('');
              }}
              className="rounded-lg px-4 py-2 text-xs font-bold text-muted-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
