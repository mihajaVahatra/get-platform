'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================
// SCHÉMA DE VALIDATION (même règles que register)
// ============================================================
const resetSchema = z.object({
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
    .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[@$!%*?&]/, 'Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&)'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type ResetForm = z.infer<typeof resetSchema>;

// ============================================================
// FONCTIONS DE FORCE DU MOT DE PASSE
// ============================================================
function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 20;
  if (/\d/.test(password)) score += 10;
  if (/[@$!%*?&]/.test(password)) score += 10;
  return Math.min(score, 100);
}

function getPasswordColor(password: string): string {
  const strength = getPasswordStrength(password);
  if (strength < 40) return '#ef4444';
  if (strength < 70) return '#f59e0b';
  return '#22c55e';
}

function getPasswordLabel(password: string): string {
  const strength = getPasswordStrength(password);
  if (strength < 40) return 'Faible';
  if (strength < 70) return 'Moyen';
  return 'Fort 💪';
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const password = watch('password', '');

  // Règles du mot de passe
  const passwordRules = [
    { label: 'Au moins 8 caractères', valid: password.length >= 8 },
    { label: 'Au moins 1 majuscule', valid: /[A-Z]/.test(password) },
    { label: 'Au moins 1 minuscule', valid: /[a-z]/.test(password) },
    { label: 'Au moins 1 chiffre', valid: /\d/.test(password) },
    { label: 'Au moins 1 caractère spécial (@$!%*?&)', valid: /[@$!%*?&]/.test(password) },
  ];

  // Vérifier la présence du token
  useEffect(() => {
    if (!token) {
      setServerError('Token de réinitialisation manquant. Vérifiez votre lien.');
    }
  }, [token]);

  const onSubmit = async (data: ResetForm) => {
    if (!token) {
      toast.error('Token manquant');
      return;
    }

    setIsLoading(true);
    setServerError(null);

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword: data.password,
      });

      setIsSuccess(true);
      toast.success('Mot de passe réinitialisé avec succès !');

      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);

    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur lors de la réinitialisation';
      setServerError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // ========== ÉTAT : SUCCÈS ==========
  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-green-600">✅ Réinitialisation réussie !</CardTitle>
          <CardDescription className="text-center">
            Votre mot de passe a été modifié avec succès.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            ← Se connecter
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // ========== ÉTAT : TOKEN MANQUANT ==========
  if (!token) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-red-600">🔴 Lien invalide</CardTitle>
          <CardDescription className="text-center">
            Le lien de réinitialisation est manquant ou invalide.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/auth/forgot-password" className="text-blue-600 hover:underline">
            ← Demander un nouveau lien
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // ========== ÉTAT : FORMULAIRE ==========
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">🔑 Nouveau mot de passe</CardTitle>
        <CardDescription className="text-center">
          Saisissez votre nouveau mot de passe
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">

          {/* ===== ERREUR SERVEUR ===== */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <span>⚠️</span> {serverError}
              </p>
            </div>
          )}

          {/* ===== NOUVEAU MOT DE PASSE ===== */}
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className={errors.password ? 'border-red-500 focus:ring-red-500' : ''}
              {...register('password')}
            />

            {/* Barre de force */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${getPasswordStrength(password)}%`,
                      backgroundColor: getPasswordColor(password),
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    Force : <span className="font-medium" style={{ color: getPasswordColor(password) }}>
                      {getPasswordLabel(password)}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {password.length} caractères
                  </p>
                </div>
              </div>
            )}

            {errors.password && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.password.message}
              </p>
            )}

            {/* Liste des règles */}
            <div className="mt-2 space-y-1">
              {passwordRules.map((rule, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className={rule.valid ? 'text-green-500' : 'text-gray-300'}>
                    {rule.valid ? '✅' : '⬜'}
                  </span>
                  <span className={rule.valid ? 'text-gray-700' : 'text-gray-400'}>
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ===== CONFIRMER LE MOT DE PASSE ===== */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              className={errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full transition-all duration-200 hover:scale-[1.02]"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Réinitialisation...
              </span>
            ) : (
              'Réinitialiser le mot de passe'
            )}
          </Button>

          <p className="text-sm text-center text-gray-600">
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              ← Retour à la connexion
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
