'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  BookOpen,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const loginSchema = z.object({
  email: z.string().email('Saisissez une adresse e-mail valide'),
  password: z
    .string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  remember: z.boolean(),
});

type LoginForm = z.infer<typeof loginSchema>;
type AccountType = 'student' | 'school';

export function LoginScreen() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const isInstitution = accountType === 'school';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: true },
  });

  const completeLogin = async (user: {
    role: string;
    firstName?: string;
  }) => {
    const institutionRoles = ['SCHOOL_ADMIN', 'TEACHER', 'MINISTRY', 'ADMIN_GET'];
    const isInstitutionUser = institutionRoles.includes(user.role);

    if (isInstitution && !isInstitutionUser) {
      await apiClient.post('/auth/logout');
      toast.error('Ce compte étudiant doit se connecter depuis l’onglet Étudiant.');
      return;
    }
    if (!isInstitution && isInstitutionUser) {
      await apiClient.post('/auth/logout');
      toast.error(
        'Ce compte institutionnel doit se connecter depuis l’onglet École / Institution.',
      );
      return;
    }

    const destinations: Record<string, string> = {
      SCHOOL_ADMIN: '/dashboard/school',
      TEACHER: '/dashboard/teacher',
      MINISTRY: '/dashboard/ministry',
      ADMIN_GET: '/dashboard/admin',
    };
    toast.success(`Bienvenue ${user.firstName || ''} !`);
    router.replace(destinations[user.role] || '/dashboard/student');
  };

  const onSubmit = async ({ email, password }: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { mfaRequired, challengeToken: token, user } = response.data.data;
      if (mfaRequired) {
        setChallengeToken(token);
        return;
      }
      await completeLogin(user);
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Erreur de connexion'
          : 'Erreur de connexion',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (challengeToken) {
    return (
      <MfaChallengeScreen
        challengeToken={challengeToken}
        onBack={() => setChallengeToken(null)}
        onVerified={completeLogin}
      />
    );
  }

  return (
    <main className="min-h-screen bg-muted p-3 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[26px] bg-card shadow-[0_20px_60px_rgba(60,45,140,0.12)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-full overflow-hidden bg-primary/10 lg:block">
          <div
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ease-out ${isInstitution ? 'opacity-0' : 'opacity-100'}`}
            style={{ backgroundImage: "url('/login-campus-illustration.png')" }}
          />
          <div
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ease-out ${isInstitution ? 'opacity-100' : 'opacity-0'}`}
            style={{
              backgroundImage: "url('/login-institution-illustration.png')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-primary/40" />
          <div className="relative z-10 flex h-full flex-col p-12 xl:p-14">
            <Brand light />
            <div
              key={accountType}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {isInstitution ? <InstitutionHero /> : <StudentHero />}
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-card px-5 py-9 sm:px-10 lg:px-14 xl:px-16">
          <div className="absolute right-7 top-7 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Globe2 className="size-5" />
            Français
            <ChevronDown className="size-4" />
          </div>
          <div className="w-full max-w-[580px]">
            <div className="mb-10 lg:hidden">
              <Brand />
            </div>
            <div
              key={`heading-${accountType}`}
              className="animate-in fade-in slide-in-from-bottom-2 text-center duration-300"
            >
              {isInstitution ? (
                <>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-[34px]">
                    Connexion{' '}
                    <span className="text-primary">institution</span>{' '}
                    <Building2 className="ml-1 inline size-8 text-primary" />
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-lg text-muted-foreground">
                    Accédez à votre espace institutionnel GET pour gérer votre
                    établissement.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-[34px]">
                    Bienvenue sur <span className="text-primary">GET</span> !
                  </h2>
                  <p className="mt-2 text-lg text-muted-foreground">
                    Connecte-toi pour accéder à ton espace
                  </p>
                </>
              )}
            </div>
            <div className="mt-10 grid grid-cols-1 rounded-xl border border-border p-1 sm:grid-cols-2">
              <AccountTab
                active={!isInstitution}
                icon={UserRound}
                onClick={() => setAccountType('student')}
              >
                Étudiant
              </AccountTab>
              <AccountTab
                active={isInstitution}
                icon={Building2}
                onClick={() => setAccountType('school')}
              >
                École / Institution
              </AccountTab>
            </div>
            <form
              onSubmit={handleSubmit(onSubmit)}
              method="post"
              action="#"
              className="mt-9 space-y-5"
            >
              <label className="block text-sm font-bold text-foreground">
                {isInstitution
                  ? 'Adresse e-mail institutionnelle'
                  : 'Adresse e-mail ou téléphone'}
                <div className="relative mt-2">
                  <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder={
                      isInstitution
                        ? 'exemple@ecole.mg'
                        : 'exemple@email.com ou 034 12 345 67'
                    }
                    className="h-14 w-full rounded-xl border border-border bg-background pl-12 pr-4 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </label>
              <label className="block text-sm font-bold text-foreground">
                Mot de passe
                <div className="relative mt-2">
                  <LockKeyhole className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={
                      isInstitution
                        ? 'Entrez votre mot de passe'
                        : '••••••••••••••'
                    }
                    className="h-14 w-full rounded-xl border border-border bg-background pl-12 pr-12 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </label>
              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border accent-[color:var(--primary)]"
                    {...register('remember')}
                  />
                  Se souvenir de moi
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-bold text-primary hover:text-primary/80"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <button
                disabled={isLoading}
                className="mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Connexion…' : 'Se connecter'}
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15">
                  {isInstitution ? (
                    <LockKeyhole className="size-5" />
                  ) : (
                    <ArrowRight className="size-5" />
                  )}
                </span>
              </button>
            </form>
            {isInstitution ? (
              <>
                <div className="my-8 flex items-center gap-4 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                  ou
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      'La connexion par certificat sera bientôt disponible.',
                    )
                  }
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-border text-sm font-bold text-primary transition hover:bg-primary/10"
                >
                  <ShieldCheck className="size-5" />
                  Connexion avec certificat institutionnel
                </button>
                <p className="mt-14 text-center text-base text-muted-foreground">
                  Besoin d’aide ?{' '}
                  <a
                    href="mailto:contact@get.mg"
                    className="font-extrabold text-primary hover:text-primary/80"
                  >
                    Contactez l’administrateur GET
                  </a>
                </p>
              </>
            ) : (
              <>
                <div className="my-8 flex items-center gap-4 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                  ou
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toast('La connexion Google sera bientôt disponible.')
                  }
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-border text-sm font-bold text-foreground transition hover:bg-muted"
                >
                  <span className="text-2xl font-bold text-[#4285F4]">G</span>
                  Continuer avec Google
                </button>
                <p className="mt-14 text-center text-base text-muted-foreground">
                  Pas encore de compte ?{' '}
                  <Link
                    href="/auth/register"
                    className="font-extrabold text-primary hover:text-primary/80"
                  >
                    Créer un compte
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MfaChallengeScreen({
  challengeToken,
  onBack,
  onVerified,
}: {
  challengeToken: string;
  onBack: () => void;
  onVerified: (user: { role: string; firstName?: string }) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    if (code.length !== 6) {
      toast.error('Saisissez le code à 6 chiffres de votre application');
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/mfa/login-verify', {
        challengeToken,
        code,
      });
      await onVerified(response.data.data.user);
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Code invalide ou expiré'
          : 'Code invalide ou expiré',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-muted p-6">
      <div className="w-full max-w-md rounded-[26px] bg-card p-8 text-center shadow-[0_20px_60px_rgba(60,45,140,0.12)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" />
        </span>
        <h2 className="mt-5 text-2xl font-extrabold text-foreground">
          Vérification en deux étapes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Saisissez le code à 6 chiffres généré par votre application
          d’authentification.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoFocus
          placeholder="123456"
          className="mx-auto mt-6 block h-14 w-48 rounded-xl border border-border bg-background text-center text-2xl font-bold tracking-[0.3em] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        <button
          onClick={() => void submit()}
          disabled={isLoading}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Vérification…' : 'Vérifier'}
        </button>
        <button
          onClick={onBack}
          className="mt-4 text-sm font-bold text-primary hover:text-primary/80"
        >
          ← Retour à la connexion
        </button>
      </div>
    </main>
  );
}

function StudentHero() {
  return (
    <>
      <div className="mt-14 max-w-md">
        <h1 className="text-[44px] font-extrabold leading-[1.12] tracking-tight text-foreground">
          Ton avenir
          <br />
          commence <span className="text-primary">ici.</span>
        </h1>
        <p className="mt-5 text-lg leading-7 text-muted-foreground">
          GET est la plateforme officielle qui simplifie ton parcours post-bac :
          candidatures, concours, paiements et inscriptions, tout en un seul
          endroit.
        </p>
      </div>
      <div className="mt-8 space-y-5">
        <Benefit
          icon={FileText}
          tone="violet"
          title="Simple et rapide"
          text="Un dossier unique pour toutes les écoles."
        />
        <Benefit
          icon={ShieldCheck}
          tone="green"
          title="Sécurisé"
          text="Tes données sont protégées et confidentielles."
        />
        <Benefit
          icon={Smartphone}
          tone="orange"
          title="Accessible partout"
          text="Sur mobile, tablette ou ordinateur."
        />
      </div>
      <Stats institution={false} />
    </>
  );
}
function InstitutionHero() {
  return (
    <>
      <div className="mt-12 inline-flex w-fit items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-extrabold tracking-[0.12em] text-primary">
        <Building2 className="size-5" />
        INSTITUTION
      </div>
      <div className="mt-6 max-w-md">
        <h1 className="text-[42px] font-extrabold leading-[1.12] tracking-tight text-foreground">
          Gérez votre établissement
          <br />
          avec <span className="text-primary">efficacité.</span>
        </h1>
        <p className="mt-5 text-lg leading-7 text-muted-foreground">
          La plateforme officielle pour gérer vos étudiants, cours, professeurs
          et toutes les activités de votre institution en un seul endroit.
        </p>
      </div>
      <div className="mt-7 space-y-4">
        <Benefit
          icon={UserRound}
          tone="violet"
          title="Gestion des étudiants"
          text="Suivi des inscriptions et parcours académiques"
        />
        <Benefit
          icon={BookOpen}
          tone="green"
          title="Gestion académique"
          text="Cours, programmes et emploi du temps"
        />
        <Benefit
          icon={Building2}
          tone="orange"
          title="Administration simplifiée"
          text="Documents, paiements et rapports"
        />
        <Benefit
          icon={ShieldCheck}
          tone="blue"
          title="Sécurisée et fiable"
          text="Données protégées et conformité garantie"
        />
      </div>
      <Stats institution />
    </>
  );
}
function Stats({ institution }: { institution: boolean }) {
  return (
    <div className="mt-auto grid max-w-[570px] grid-cols-3 gap-3 rounded-2xl border border-border bg-card/80 p-4 backdrop-blur-sm">
      <Metric
        value={institution ? '50+' : '+50'}
        label={
          institution ? 'Établissements partenaires' : 'Écoles partenaires'
        }
        icon={Building2}
      />
      <Metric
        value={institution ? '30 000+' : '+30 000'}
        label={institution ? 'Étudiants gérés' : 'Étudiants inscrits'}
        icon={UserRound}
      />
      <Metric
        value="100%"
        label={institution ? 'Sécurisée et conforme' : 'En ligne'}
        icon={ShieldCheck}
      />
    </div>
  );
}
function AccountTab({
  active,
  icon: Icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: typeof UserRound;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-all duration-300 ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-foreground hover:bg-muted'}`}
    >
      <Icon className="size-5" />
      {children}
    </button>
  );
}
function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Retour à l’accueil GET"
      className="flex w-fit items-center gap-4 transition-transform hover:scale-[1.02]"
    >
      <div className="flex items-start font-heading text-5xl font-bold tracking-[-0.08em] text-primary">
        GET<span className="text-primary/60">.</span>
        <GraduationCap className="-ml-1 -mt-1 size-6 rotate-[-18deg] text-primary/70" />
      </div>
      <p
        className={`text-sm font-medium leading-5 ${light ? 'text-muted-foreground' : 'text-muted-foreground'}`}
      >
        Grandes Écoles de
        <br />
        Tananarive et de Madagascar
      </p>
    </Link>
  );
}
function Benefit({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: typeof FileText;
  tone: 'violet' | 'green' | 'orange' | 'blue';
  title: string;
  text: string;
}) {
  const tones = {
    violet: 'bg-muted text-[var(--chart-1)]',
    green: 'bg-muted text-[var(--chart-3)]',
    orange: 'bg-muted text-[var(--chart-4)]',
    blue: 'bg-muted text-[var(--chart-2)]',
  };
  return (
    <div className="flex items-center gap-4">
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="size-6" />
      </span>
      <div>
        <p className="font-extrabold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
function Metric({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: typeof Building2;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-5" />
        <p className="truncate text-xl font-extrabold">{value}</p>
      </div>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
