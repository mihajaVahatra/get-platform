'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const codeSchema = z.object({
  email: z.string().email('Email invalide').max(254),
  code: z
    .string()
    .regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
});

type CodeForm = z.infer<typeof codeSchema>;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailFromQuery = searchParams.get('email') || '';

  const [isVerifyingToken, setIsVerifyingToken] = useState(!!token);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: emailFromQuery, code: '' },
  });
  const email = watch('email');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await apiClient.post('/auth/verify-email', { token });
        toast.success('Adresse email vérifiée, bienvenue !');
        router.replace('/dashboard/student');
      } catch (error: unknown) {
        setTokenError(
          axios.isAxiosError(error)
            ? error.response?.data?.message ||
                'Lien de vérification invalide ou expiré.'
            : 'Lien de vérification invalide ou expiré.',
        );
      } finally {
        setIsVerifyingToken(false);
      }
    })();
  }, [token, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(
      () => setResendCooldown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const onSubmit = async (data: CodeForm) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/verify-email/code', data);
      toast.success('Adresse email vérifiée, bienvenue !');
      router.replace('/dashboard/student');
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Code de vérification invalide'
          : 'Code de vérification invalide',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (!email || resendCooldown > 0) return;
    setIsResending(true);
    try {
      await apiClient.post('/auth/resend-verification', { email });
      toast.success('Un nouveau code a été envoyé si une inscription est en attente.');
      setResendCooldown(30);
    } catch {
      toast.error("Erreur lors de l'envoi, réessaie dans quelques instants.");
    } finally {
      setIsResending(false);
    }
  };

  if (isVerifyingToken) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            ⏳ Vérification en cours…
          </CardTitle>
          <CardDescription className="text-center">
            On active ton compte, un instant.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          📧 Vérifie ton adresse email
        </CardTitle>
        <CardDescription className="text-center">
          {tokenError ||
            "On t'a envoyé un lien et un code à 6 chiffres. Clique sur le lien, ou saisis le code ci-dessous."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} method="post" action="#">
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              maxLength={254}
              placeholder="jean.rakoto@email.com"
              className={errors.email ? 'border-red-500 focus:ring-red-500' : ''}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code de vérification</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className={`text-center text-lg tracking-[0.4em] ${errors.code ? 'border-red-500 focus:ring-red-500' : ''}`}
              {...register('code')}
            />
            {errors.code && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.code.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Vérification...' : 'Activer mon compte'}
          </Button>
          <button
            type="button"
            onClick={resendCode}
            disabled={isResending || !email || resendCooldown > 0}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendCooldown > 0
              ? `Renvoyer le code (${resendCooldown}s)`
              : isResending
                ? 'Envoi...'
                : 'Renvoyer le code'}
          </button>
          <p className="text-sm text-center text-gray-600">
            <Link href="/auth/register" className="text-blue-600 hover:underline">
              ← Recommencer l’inscription
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
