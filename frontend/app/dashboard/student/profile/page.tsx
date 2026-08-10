'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * Construit le schéma Zod de validation du formulaire de profil étudiant, avec des messages
 * d'erreur traduits via la fonction `t` fournie (nécessaire car les messages Zod doivent
 * réagir aux changements de langue).
 */
function createProfileSchema(t: (key: string) => string) {
  return z.object({
    firstName: z.string().min(2, t('validation.firstNameShort')).max(50, t('validation.firstNameLong')),
    lastName: z.string().min(2, t('validation.lastNameShort')).max(50, t('validation.lastNameLong')),
    phone: z.string().max(30, t('validation.phoneLong')).optional(),
    birthDate: z.string().optional(),
    cin: z.string().max(20, t('validation.cinLong')).optional(),
    bacYear: z.union([z.string(), z.number()]).optional(),
    bacType: z.string().max(50, t('validation.tooLong')).optional(),
    city: z.string().max(100, t('validation.tooLong')).optional(),
    address: z.string().max(300, t('validation.addressLong')).optional(),
    region: z.string().max(100, t('validation.tooLong')).optional(),
    bio: z.string().max(1000, t('validation.bioLong')).optional(),
  });
}

/** Type des valeurs du formulaire de profil, dérivé du schéma Zod `createProfileSchema`. */
type ProfileForm = z.infer<ReturnType<typeof createProfileSchema>>;

/**
 * Route `/dashboard/student/profile` : client component ('use client') affichant le profil
 * complet de l'étudiant sous deux onglets : "Informations" (formulaire d'édition validé par
 * react-hook-form + Zod) et "Statistiques" (candidatures, documents, taux de complétion).
 * Appels API via `apiClient` :
 * - `GET /students/me` : charge le profil au montage et préremplit le formulaire.
 * - `GET /students/me/stats` : charge les statistiques affichées dans l'onglet "Statistiques".
 * - `PUT /students/me` : enregistre les modifications du formulaire.
 */
export default function StudentProfilePage() {
  const t = useTranslations('StudentProfile');
  const profileSchema = useMemo(() => createProfileSchema(t), [t]);
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

  /** Charge le profil étudiant et réinitialise le formulaire avec ces valeurs (date de naissance tronquée au format `YYYY-MM-DD` pour l'input `date`). */
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
      toast.error(t('loadError'));
    }
  };

  /** Charge les statistiques de l'étudiant (candidatures, documents, complétion du profil) affichées dans l'onglet "Statistiques". */
  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/students/me/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  };

  /** Soumet le formulaire de profil : convertit `bacYear` (saisi en texte) en nombre avant l'envoi à l'API. */
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
      toast.success(t('updateSuccess'));
    } catch (error: any) {
      const message = error.response?.data?.message || t('updateError');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) {
    return <div className="flex justify-center p-8">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec avatar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
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
          <TabsTrigger value="informations">{t('tabInfo')}</TabsTrigger>
          <TabsTrigger value="stats">{t('tabStats')}</TabsTrigger>
        </TabsList>

        {/* === ONGLET INFORMATIONS === */}
        <TabsContent value="informations">
          <Card>
            <CardHeader>
              <CardTitle>{t('personalInfoTitle')}</CardTitle>
              <CardDescription>
                {t('personalInfoSubtitle')}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)} method="post" action="#">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t('firstName')} <span className="text-red-500">*</span></Label>
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
                    <Label htmlFor="lastName">{t('lastName')} <span className="text-red-500">*</span></Label>
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
                  <Label htmlFor="phone">{t('phone')}</Label>
                  <Input
                    id="phone"
                    placeholder="+261 34 12 345 67"
                    maxLength={30}
                    {...register('phone')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">{t('birthDate')}</Label>
                    <Input id="birthDate" type="date" {...register('birthDate')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cin">{t('cin')}</Label>
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
                    <Label htmlFor="bacYear">{t('bacYear')}</Label>
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
                    <Label htmlFor="bacType">{t('bacType')}</Label>
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
                    <Label htmlFor="city">{t('city')}</Label>
                    <Input
                      id="city"
                      placeholder="Antananarivo"
                      maxLength={100}
                      {...register('city')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">{t('region')}</Label>
                    <Input
                      id="region"
                      placeholder="Analamanga"
                      maxLength={100}
                      {...register('region')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t('address')}</Label>
                  <Input
                    id="address"
                    placeholder="Lot II M 12 Bis Analakely"
                    maxLength={300}
                    {...register('address')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">{t('bio')}</Label>
                  <Input
                    id="bio"
                    placeholder={t('bioPlaceholder')}
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
                  {t('manageDocuments')}
                </a>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? t('saving') : t('save')}
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
              <CardTitle>{t('statsTitle')}</CardTitle>
              <CardDescription>
                {t('statsSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="bg-blue-50 dark:bg-blue-500/15 p-4 rounded-lg text-center border border-blue-100">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                    {stats?.totalApplications || 0}
                  </p>
                  <p className="text-sm text-gray-600">{t('statApplications')}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-500/15 p-4 rounded-lg text-center border border-green-100">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-300">
                    {stats?.acceptedApplications || 0}
                  </p>
                  <p className="text-sm text-gray-600">{t('statAccepted')}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-500/15 p-4 rounded-lg text-center border border-yellow-100">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">
                    {stats?.pendingApplications || 0}
                  </p>
                  <p className="text-sm text-gray-600">{t('statPending')}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="bg-purple-50 dark:bg-purple-500/15 p-4 rounded-lg text-center border border-purple-100">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                    {stats?.documentsUploaded || 0}
                  </p>
                  <p className="text-sm text-gray-600">{t('statDocuments')}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-500/15 p-4 rounded-lg text-center border border-indigo-100">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">
                    {stats?.profileCompletion || 0}%
                  </p>
                  <p className="text-sm text-gray-600">{t('statProfileCompletion')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
