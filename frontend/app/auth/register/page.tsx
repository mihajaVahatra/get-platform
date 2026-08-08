'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Logo } from '@/components/Logo';

const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(2, 'Prénom trop court (minimum 2 caractères)')
      .max(50),
    lastName: z
      .string()
      .min(2, 'Nom trop court (minimum 2 caractères)')
      .max(50),
    email: z.string().email('Saisissez une adresse e-mail valide').max(254),
    phone: z
      .string()
      .min(1, 'Le numéro de téléphone est obligatoire')
      .max(30),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .max(128, 'Mot de passe trop long')
      .regex(/[A-Z]/, 'Ajoutez une majuscule')
      .regex(/[a-z]/, 'Ajoutez une minuscule')
      .regex(/\d/, 'Ajoutez un chiffre')
      .regex(/[@$!%*?&]/, 'Ajoutez un caractère spécial'),
    confirmPassword: z.string().max(128),
    terms: z
      .boolean()
      .refine((value) => value, 'Vous devez accepter les conditions.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

// QA uniquement — génère un email jetable (prénom.nom + chiffre @get.mg) pour
// éviter d'avoir à en inventer un à chaque test d'inscription. À retirer en
// désactivant simplement NEXT_PUBLIC_ALLOW_AUTO_EMAIL sur Vercel (pas de
// changement de code nécessaire) une fois la phase de test terminée.
const AUTO_EMAIL_ENABLED = process.env.NEXT_PUBLIC_ALLOW_AUTO_EMAIL === 'true';

function generateQaEmail(firstName: string, lastName: string): string {
  const slugPart = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  const local = [slugPart(firstName), slugPart(lastName)]
    .filter(Boolean)
    .join('.');
  const suffix = Math.floor(1000 + Math.random() * 90000);
  return `${local || 'candidat'}${suffix}@get.mg`;
}

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [emailAutoFilled, setEmailAutoFilled] = useState(AUTO_EMAIL_ENABLED);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { phone: '', terms: false },
  });
  const password = watch('password', '');
  const firstName = watch('firstName', '');
  const lastName = watch('lastName', '');

  useEffect(() => {
    if (!AUTO_EMAIL_ENABLED || !emailAutoFilled) return;
    if (!firstName && !lastName) return;
    setValue('email', generateQaEmail(firstName, lastName), {
      shouldValidate: true,
    });
  }, [AUTO_EMAIL_ENABLED, emailAutoFilled, firstName, lastName, setValue]);
  const rules: Array<[string, boolean]> = [
    ['Au moins 8 caractères', password.length >= 8],
    ['Une lettre majuscule', /[A-Z]/.test(password)],
    ['Un chiffre', /\d/.test(password)],
    ['Un caractère spécial', /[@$!%*?&]/.test(password)],
  ];

  const onSubmit = async (form: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      const { user } = response.data.data;
      toast.success(`Bienvenue ${user.firstName} !`);
      router.replace('/dashboard/student');
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Erreur lors de l’inscription'
          : 'Erreur lors de l’inscription',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf9ff] p-2 sm:p-3">
      <div className="mx-auto grid min-h-[calc(100vh-1rem)] max-w-[1540px] overflow-hidden rounded-[18px] bg-white shadow-[0_20px_60px_rgba(60,45,140,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden overflow-hidden bg-[#ebeaff] lg:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/register-campus-students.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#eeedff]/95 via-[#eeedff]/45 to-transparent" />
          <div className="relative z-10 flex h-full flex-col p-10 xl:p-11">
            <Brand light />
            <div className="mt-12 max-w-[540px]">
              <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-100/90 px-4 py-2 text-sm font-bold text-indigo-600">
                <Sparkles className="size-4" />
                Rejoins GET et construis ton avenir
              </span>
              <h1 className="mt-6 text-[43px] font-extrabold leading-[1.15] tracking-tight text-[#111949]">
                Ton avenir commence
                <br />
                par une <span className="text-indigo-600">inscription.</span>
              </h1>
              <p className="mt-4 text-lg leading-7 text-[#414b76]">
                Crée ton compte GET pour accéder à toutes les opportunités
                d’études, de concours et de bourses en un seul endroit.
              </p>
            </div>
            <div className="mt-8 space-y-5">
              <Benefit
                icon={UserRound}
                tone="indigo"
                title="Un parcours simplifié"
                text="Postule, suis tes candidatures et inscris-toi facilement."
              />
              <Benefit
                icon={ShieldCheck}
                tone="green"
                title="Sécurisé et fiable"
                text="Tes données sont protégées et confidentielles."
              />
              <Benefit
                icon={Sparkles}
                tone="orange"
                title="Reste informé"
                text="Reçois des notifications sur les concours et admissions."
              />
              <Benefit
                icon={GraduationCap}
                tone="blue"
                title="Des opportunités pour tous"
                text="Découvre les meilleures écoles et formations à Madagascar."
              />
            </div>
          </div>
        </section>
        <section className="relative flex items-center justify-center px-5 py-10 sm:px-8 lg:px-7 xl:px-10">
          <div className="absolute right-7 top-7 text-sm text-[#66718f]">
            Déjà un compte ?{' '}
            <Link
              href="/auth/login"
              className="ml-1 font-bold text-indigo-600 hover:text-indigo-700"
            >
              Se connecter
            </Link>
          </div>
          <div className="w-full max-w-[720px]">
            <div className="mb-9 lg:hidden">
              <Brand />
            </div>
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-indigo-50 text-indigo-600">
                <UserPlus className="size-7" />
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#101643]">
                Créer un compte étudiant
              </h2>
              <p className="mt-2 text-[#69738f]">
                Remplis les informations ci-dessous pour commencer
              </p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} method="post" action="#" className="mt-8 space-y-5">
              <FormSection title="Informations personnelles">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prénom" error={errors.firstName?.message}>
                    <Input
                      icon={UserRound}
                      placeholder="Ton prénom"
                      maxLength={50}
                      {...register('firstName')}
                    />
                  </Field>
                  <Field label="Nom" error={errors.lastName?.message}>
                    <Input
                      icon={UserRound}
                      placeholder="Ton nom"
                      maxLength={50}
                      {...register('lastName')}
                    />
                  </Field>
                </div>
                <Field label="Adresse e-mail" error={errors.email?.message}>
                  <Input
                    icon={Mail}
                    type="email"
                    placeholder="exemple@email.com"
                    maxLength={254}
                    {...register('email', {
                      onChange: () => setEmailAutoFilled(false),
                    })}
                  />
                  {AUTO_EMAIL_ENABLED && emailAutoFilled && (
                    <p className="mt-1 text-xs text-indigo-600">
                      Généré automatiquement pour le QA — modifiable.
                    </p>
                  )}
                </Field>
                <Field
                  label="Numéro de téléphone"
                  error={errors.phone?.message}
                >
                  <Input
                    icon={Phone}
                    type="tel"
                    placeholder="034 12 345 67"
                    maxLength={30}
                    {...register('phone')}
                  />
                </Field>
              </FormSection>
              <FormSection title="Sécurité">
                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordField
                    label="Mot de passe"
                    placeholder="Crée un mot de passe"
                    shown={showPassword}
                    onToggle={() => setShowPassword((value) => !value)}
                    error={errors.password?.message}
                    register={register('password')}
                  />
                  <PasswordField
                    label="Confirmer le mot de passe"
                    placeholder="Confirme ton mot de passe"
                    shown={showConfirmation}
                    onToggle={() => setShowConfirmation((value) => !value)}
                    error={errors.confirmPassword?.message}
                    register={register('confirmPassword')}
                  />
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-6 shrink-0 text-indigo-600" />
                    <div>
                      <p className="text-xs font-extrabold text-[#202856]">
                        Ton mot de passe doit contenir :
                      </p>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        {rules.map(([label, valid]) => (
                          <span
                            key={label}
                            className={
                              valid
                                ? 'font-medium text-emerald-600'
                                : 'text-[#65708e]'
                            }
                          >
                            {valid ? '✓' : '○'} {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </FormSection>
              <label className="flex items-start gap-3 text-sm text-[#26305b]">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-slate-300 accent-indigo-600"
                  {...register('terms')}
                />
                <span>
                  J’accepte les{' '}
                  <a href="#" className="font-medium text-indigo-600">
                    Conditions d’utilisation
                  </a>{' '}
                  et la{' '}
                  <a href="#" className="font-medium text-indigo-600">
                    Politique de confidentialité
                  </a>
                </span>
              </label>
              {errors.terms && (
                <p className="-mt-3 text-xs text-rose-600">
                  {errors.terms.message}
                </p>
              )}
              <button
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 font-extrabold text-white shadow-lg shadow-indigo-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="size-5" />
                {isLoading ? 'Création du compte…' : 'Créer mon compte'}
              </button>
            </form>
            <div className="my-6 flex items-center gap-4 text-xs text-[#79829a] before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
              ou s’inscrire avec
            </div>
            <button
              type="button"
              onClick={() =>
                toast('L’inscription avec Google sera bientôt disponible.')
              }
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 text-sm font-bold text-[#17204e] transition hover:bg-slate-50"
            >
              <span className="text-xl font-black text-[#4285F4]">G</span>Google
            </button>
          </div>
        </section>
      </div>
      <div className="mx-auto mt-5 flex max-w-[1540px] flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white/70 px-7 py-4 text-sm text-[#65708e]">
        <span className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-indigo-100 text-indigo-600">
            <ShieldCheck className="size-5" />
          </span>
          <span>
            <strong className="block text-[#202856]">
              Nous prenons la sécurité de tes données très au sérieux.
            </strong>
            Tes informations sont protégées et ne seront jamais partagées.
          </span>
        </span>
        <span>
          Besoin d’aide ?{' '}
          <a href="mailto:contact@get.mg" className="font-bold text-indigo-600">
            Contacte l’administrateur GET
          </a>
        </span>
      </div>
    </main>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Retour à l’accueil GET"
      className="flex w-fit items-center transition-transform hover:scale-[1.02]"
    >
      <Logo size={52} tone={light ? 'light' : 'color'} />
    </Link>
  );
}
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-sm font-extrabold text-indigo-600">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
function Field({
  label,
  error,
  required = true,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-[#17204e]">
      {label} {required && <span className="text-rose-500">*</span>}
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </label>
  );
}
function Input({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: typeof Mail }) {
  return (
    <span className="relative mt-2 block">
      <Icon className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#7c86a1]" />
      <input
        className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none transition placeholder:text-[#8a93ab] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        {...props}
      />
    </span>
  );
}
function PasswordField({
  label,
  placeholder,
  shown,
  onToggle,
  error,
  register,
}: {
  label: string;
  placeholder: string;
  shown: boolean;
  onToggle: () => void;
  error?: string;
  register: ReturnType<typeof useForm<RegisterForm>>['register'] extends (
    name: infer T,
  ) => infer R
    ? R
    : never;
}) {
  return (
    <Field label={label} error={error}>
      <span className="relative mt-2 block">
        <LockKeyhole className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#7c86a1]" />
        <input
          type={shown ? 'text' : 'password'}
          placeholder={placeholder}
          maxLength={128}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-11 text-sm outline-none transition placeholder:text-[#8a93ab] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          {...register}
        />
        <button
          type="button"
          aria-label={
            shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
          }
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c86a1] hover:text-indigo-600"
        >
          {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </span>
    </Field>
  );
}
function Benefit({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: typeof UserRound;
  tone: 'indigo' | 'green' | 'orange' | 'blue';
  title: string;
  text: string;
}) {
  const tones = {
    indigo: 'bg-indigo-100 text-indigo-600',
    green: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-500',
    blue: 'bg-blue-100 text-blue-600',
  };
  return (
    <div className="flex items-center gap-4">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="size-6" />
      </span>
      <div>
        <p className="font-extrabold text-[#17204e]">{title}</p>
        <p className="mt-0.5 text-sm text-[#4e5a82]">{text}</p>
      </div>
    </div>
  );
}
