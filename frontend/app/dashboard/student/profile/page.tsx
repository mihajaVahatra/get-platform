'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Schéma de validation pour le formulaire
const profileSchema = z.object({
  firstName: z.string().min(2, 'Prénom trop court (min 2 caractères)').max(50, 'Prénom trop long'),
  lastName: z.string().min(2, 'Nom trop court (min 2 caractères)').max(50, 'Nom trop long'),
  phone: z.string().max(30, 'Numéro trop long').optional(),
  birthDate: z.string().optional(),
  cin: z.string().max(20, 'CIN trop long').optional(),
  bacYear: z.union([z.string(), z.number()]).optional(),
  bacType: z.string().max(50, 'Trop long').optional(),
  city: z.string().max(100, 'Trop long').optional(),
  address: z.string().max(300, 'Adresse trop longue').optional(),
  region: z.string().max(100, 'Trop long').optional(),
  bio: z.string().max(1000, 'Bio trop longue').optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function StudentProfilePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  // Charger le profil au chargement
  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/students/me');
      const data = response.data.data;
      setProfile(data);
      reset({
        ...data,
        birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : '',
      });
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      toast.error('Erreur lors du chargement du profil');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/students/me/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        bacYear:
          data.bacYear === '' || data.bacYear === undefined
            ? undefined
            : Number(data.bacYear),
      };
      const response = await apiClient.put('/students/me', payload);
      setProfile(response.data.data);
      toast.success('Profil mis à jour avec succès !');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur lors de la mise à jour';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec avatar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mon Profil</h1>
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src="/avatar-placeholder.png" />
            <AvatarFallback className="bg-blue-500 text-white text-lg">
              {profile.firstName?.[0]}{profile.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{profile.firstName} {profile.lastName}</p>
            <p className="text-sm text-gray-500">{profile.user?.email}</p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Tabs defaultValue="informations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="informations">Informations</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        {/* === ONGLET INFORMATIONS === */}
        <TabsContent value="informations">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>
                Modifiez vos informations personnelles
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)} method="post" action="#">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom <span className="text-red-500">*</span></Label>
                    <Input
                      id="firstName"
                      maxLength={50}
                      {...register('firstName')}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-red-500 dark:text-red-300">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom <span className="text-red-500">*</span></Label>
                    <Input
                      id="lastName"
                      maxLength={50}
                      {...register('lastName')}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-red-500 dark:text-red-300">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    placeholder="+261 34 12 345 67"
                    maxLength={30}
                    {...register('phone')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Date de naissance</Label>
                    <Input id="birthDate" type="date" {...register('birthDate')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cin">CIN</Label>
                    <Input
                      id="cin"
                      placeholder="101234567"
                      maxLength={20}
                      {...register('cin')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bacYear">Année du bac</Label>
                    <Input
                      id="bacYear"
                      type="number"
                      min={1950}
                      max={2100}
                      placeholder="2023"
                      {...register('bacYear')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bacType">Série du bac</Label>
                    <Input
                      id="bacType"
                      placeholder="S, A, C, D…"
                      maxLength={50}
                      {...register('bacType')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      placeholder="Antananarivo"
                      maxLength={100}
                      {...register('city')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Région</Label>
                    <Input
                      id="region"
                      placeholder="Analamanga"
                      maxLength={100}
                      {...register('region')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    placeholder="Lot II M 12 Bis Analakely"
                    maxLength={300}
                    {...register('address')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Input
                    id="bio"
                    placeholder="Parlez-nous de vous..."
                    maxLength={1000}
                    {...register('bio')}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <a
                  href="/dashboard/student/documents"
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
                >
                  Gérer mes documents (CV, CIN, diplôme…) →
                </a>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Ancien onglet Documents retiré : il dupliquait
            /dashboard/student/documents avec un bouton d'upload non
            fonctionnel et une liste basée sur un champ absent de la réponse
            API. Le vrai gestionnaire de documents reste accessible depuis le
            lien ci-dessus et depuis le menu. */}

        {/* === ONGLET STATISTIQUES === */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Mes statistiques</CardTitle>
              <CardDescription>
                Vue d'ensemble de votre activité
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="bg-blue-50 dark:bg-blue-500/15 p-4 rounded-lg text-center border border-blue-100">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                    {stats?.totalApplications || 0}
                  </p>
                  <p className="text-sm text-gray-600">Candidatures</p>
                </div>
                <div className="bg-green-50 dark:bg-green-500/15 p-4 rounded-lg text-center border border-green-100">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-300">
                    {stats?.acceptedApplications || 0}
                  </p>
                  <p className="text-sm text-gray-600">Acceptées</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-500/15 p-4 rounded-lg text-center border border-yellow-100">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">
                    {stats?.pendingApplications || 0}
                  </p>
                  <p className="text-sm text-gray-600">En attente</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="bg-purple-50 dark:bg-purple-500/15 p-4 rounded-lg text-center border border-purple-100">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                    {stats?.documentsUploaded || 0}
                  </p>
                  <p className="text-sm text-gray-600">Documents</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-500/15 p-4 rounded-lg text-center border border-indigo-100">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">
                    {stats?.profileCompletion || 0}%
                  </p>
                  <p className="text-sm text-gray-600">Profil complété</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
