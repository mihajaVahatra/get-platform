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

const registerSchema = z.object({
  firstName: z.string().min(2, 'Prénom trop court'),
  lastName: z.string().min(2, 'Nom trop court'),
  email: z.string().email('Email invalide'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
    .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[@$!%*?&]/, 'Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&)'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');

  const passwordRules = [
    { label: 'Au moins 8 caractères', valid: password.length >= 8 },
    { label: 'Au moins 1 majuscule', valid: /[A-Z]/.test(password) },
    { label: 'Au moins 1 minuscule', valid: /[a-z]/.test(password) },
    { label: 'Au moins 1 chiffre', valid: /\d/.test(password) },
    { label: 'Au moins 1 caractère spécial (@$!%*?&)', valid: /[@$!%*?&]/.test(password) },
  ];

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register', data);
      const { accessToken, user } = response.data.data;
      
      document.cookie = `accessToken=${accessToken}; path=/; max-age=604800`;
      
      toast.success(`Bienvenue ${user.firstName}! 🎉`);
      
      setTimeout(() => {
        window.location.href = '/dashboard/student';
      }, 500);
      
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur d\'inscription';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-center">GET - Inscription</CardTitle>
        <CardDescription className="text-center">
          Créez votre compte étudiant
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                placeholder="Jean"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                placeholder="Rakoto"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jean.rakoto@email.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
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
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Inscription...' : "S'inscrire"}
          </Button>
          <p className="text-sm text-center text-gray-600">
            Déjà un compte ?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
