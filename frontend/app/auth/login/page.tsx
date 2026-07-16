'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', data);
      const { accessToken, user } = response.data.data;

      document.cookie = `accessToken=${accessToken}; path=/; max-age=604800`;

      toast.success(`Bienvenue ${user.firstName}! 👋`);

      //Redirection dynamique selon le rôle
      const role = user.role;
      let redirectPath = '/dashboard/student';

      if (role === 'SCHOOL_ADMIN') {
        redirectPath = '/dashboard/school';
      } else if (role === 'MINISTRY') {
        redirectPath = '/dashboard/ministry';
      } else if (role === 'ADMIN_GET') {
        redirectPath = '/dashboard/admin';
      }

      setTimeout(() => {
        window.location.href = redirectPath;
      }, 500);

    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur de connexion';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-center">GET - Connexion</CardTitle>
        <CardDescription className="text-center">
          Connectez-vous à votre espace
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
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
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </Button>
          <p className="text-sm text-center text-gray-600">
            Pas encore de compte ?{' '}
            <Link href="/auth/register" className="text-blue-600 hover:underline">
              S'inscrire
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
