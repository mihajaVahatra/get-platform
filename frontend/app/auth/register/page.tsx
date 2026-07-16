'use client';

import { useState } from 'react';
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
// SCHÉMA DE VALIDATION
// ============================================================
const registerSchema = z.object({
  firstName: z.string().min(2, 'Prénom trop court (min 2 caractères)'),
  lastName: z.string().min(2, 'Nom trop court (min 2 caractères)'),
  email: z.string().email('Email invalide'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
    .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[@$!%*?&]/, 'Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&)'),
});

type RegisterForm = z.infer<typeof registerSchema>;

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
  if (strength < 40) return '#ef4444'; // rouge
  if (strength < 70) return '#f59e0b'; // orange
  return '#22c55e'; // vert
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
export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');

  // Règles du mot de passe avec validation en temps réel
  const passwordRules = [
    { label: 'Au moins 8 caractères', valid: password.length >= 8 },
    { label: 'Au moins 1 majuscule', valid: /[A-Z]/.test(password) },
    { label: 'Au moins 1 minuscule', valid: /[a-z]/.test(password) },
    { label: 'Au moins 1 chiffre', valid: /\d/.test(password) },
    { label: 'Au moins 1 caractère spécial (@$!%*?&)', valid: /[@$!%*?&]/.test(password) },
  ];

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setServerErrors([]);
    try {
      const response = await apiClient.post('/auth/register', data);
      const { accessToken, user } = response.data.data;
      
      document.cookie = `accessToken=${accessToken}; path=/; max-age=604800`;
      
      toast.success(`Bienvenue ${user.firstName}! 🎉`);
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
      
    } catch (error: any) {
      const errorData = error.response?.data;
      let errorMessages: string[] = [];
      
      if (errorData?.message) {
        if (Array.isArray(errorData.message)) {
          errorMessages = errorData.message;
        } else {
          errorMessages = [errorData.message];
        }
      } else {
        errorMessages = ['Une erreur est survenue. Veuillez réessayer.'];
      }
      
      setServerErrors(errorMessages);
      toast.error('Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">🚀 GET - Inscription</CardTitle>
        <CardDescription className="text-center">
          Créez votre compte étudiant
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          
          {/* ===== ERREURS SERVEUR ===== */}
          {serverErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {serverErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-600 flex items-center gap-2">
                  <span>⚠️</span> {error}
                </p>
              ))}
            </div>
          )}

          {/* ===== PRÉNOM / NOM ===== */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                placeholder="Jean"
                className={errors.firstName ? 'border-red-500 focus:ring-red-500' : ''}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span>⚠️</span> {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                placeholder="Rakoto"
                className={errors.lastName ? 'border-red-500 focus:ring-red-500' : ''}
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span>⚠️</span> {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {/* ===== EMAIL ===== */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
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

          {/* ===== MOT DE PASSE ===== */}
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className={errors.password ? 'border-red-500 focus:ring-red-500' : ''}
              {...register('password')}
            />
            
            {/* Barre de force du mot de passe */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300 rounded-full"
                    style={{ 
                      width: `${getPasswordStrength(password)}%`,
                      backgroundColor: getPasswordColor(password)
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
        </CardContent>

        {/* ===== FOOTER ===== */}
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            type="submit" 
            className="w-full transition-all duration-200 hover:scale-[1.02]"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Inscription...
              </span>
            ) : (
              "S'inscrire"
            )}
          </Button>
          
          <p className="text-sm text-center text-gray-600">
            Déjà un compte ?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline hover:text-blue-800 transition-colors">
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
