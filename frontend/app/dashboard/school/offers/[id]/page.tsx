'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';

const offerSchema = z.object({
  title: z.string().min(3, 'Titre trop court').max(150, 'Titre trop long'),
  description: z.string().max(2000, 'Description trop longue').optional(),
  diploma: z.string().min(2, 'Diplôme requis').max(100),
  duration: z.number().min(1, 'Durée minimale 1 mois').max(60, 'Durée trop longue'),
  tuitionFees: z.number().min(0, 'Frais invalides').max(999999999, 'Montant trop élevé'),
  capacity: z.number().max(10000, 'Capacité trop élevée').optional(),
  applicationDeadline: z.string().optional(),
  academicYear: z.string().min(4, 'Année académique requise').max(20),
  prerequisites: z.string().max(2000, 'Prérequis trop longs').optional(),
  programId: z.string().uuid('Sélectionnez la filière correspondante'),
});

/** Type inféré du formulaire d'édition d'offre, dérivé du schéma de validation Zod `offerSchema`. */
type OfferForm = z.infer<typeof offerSchema>;

/**
 * Page « Modifier l'offre » du tableau de bord établissement
 * (route App Router `/dashboard/school/offers/[id]`).
 * Client component (`'use client'`) : charge l'offre existante (`GET /offers/:id`) ainsi
 * que les filières actives de l'établissement, pré-remplit le formulaire (React Hook Form + Zod)
 * puis persiste les modifications via `PUT /offers/:id`.
 */
export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(false);
  // Chargement initial des données de l'offre (distinct de `isLoading`, qui concerne la soumission du formulaire).
  const [loadingData, setLoadingData] = useState(true);
  const [programs, setPrograms] = useState<{ id: string; name: string; diploma: string; isActive: boolean }[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OfferForm>({
    resolver: zodResolver(offerSchema),
  });

  useEffect(() => {
    if (id) {
      fetchOffer();
    }
  }, [id]);

  /**
   * Charge l'offre à modifier et les filières actives de l'établissement, puis
   * réinitialise le formulaire (`reset`) avec les valeurs existantes de l'offre.
   * En cas d'échec, redirige vers la liste des offres.
   */
  const fetchOffer = async () => {
    try {
      const response = await apiClient.get(`/offers/${id}`);
      const offer = response.data.data;
      apiClient
        .get('/schools/me/programs')
        .then((programsResponse) =>
          setPrograms((programsResponse.data.data || []).filter((program: { isActive: boolean }) => program.isActive)),
        )
        .catch(() => toast.error('Impossible de charger les filières'));
      setSelectedProgramId(offer.programId || '');
      reset({
        title: offer.title,
        description: offer.description || '',
        diploma: offer.diploma,
        duration: offer.duration,
        tuitionFees: offer.tuitionFees,
        capacity: offer.capacity || undefined,
        applicationDeadline: offer.applicationDeadline ? offer.applicationDeadline.split('T')[0] : '',
        academicYear: offer.academicYear,
        prerequisites: offer.prerequisites?.join(', ') || '',
        programId: offer.programId || '',
      });
    } catch (error) {
      toast.error('Erreur lors du chargement de l\'offre');
      router.push('/dashboard/school/offers');
    } finally {
      setLoadingData(false);
    }
  };

  /** Soumission du formulaire : persiste les modifications via `PUT /offers/:id`. */
  const onSubmit = async (data: OfferForm) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        duration: Number(data.duration),
        tuitionFees: Number(data.tuitionFees),
        capacity: data.capacity ? Number(data.capacity) : undefined,
        prerequisites: data.prerequisites ? data.prerequisites.split(',').map(s => s.trim()) : [],
      };
      await apiClient.put(`/offers/${id}`, payload);
      toast.success('Offre modifiée avec succès !');
      router.push('/dashboard/school/offers');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur lors de la modification';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingData) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Modifier l'offre</CardTitle>
          <CardDescription>
            Modifiez les informations de votre offre
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} method="post" action="#">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre de l'offre *</Label>
              <Input id="title" maxLength={150} {...register('title')} />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" maxLength={2000} {...register('description')} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="diploma">Diplôme *</Label>
                <Input id="diploma" maxLength={100} {...register('diploma')} />
                {errors.diploma && (
                  <p className="text-sm text-red-500">{errors.diploma.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Durée (mois) *</Label>
                <Input id="duration" type="number" min={1} max={60} {...register('duration', { valueAsNumber: true })} />
                {errors.duration && (
                  <p className="text-sm text-red-500">{errors.duration.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tuitionFees">Frais (MGA) *</Label>
                <Input id="tuitionFees" type="number" min={0} max={999999999} {...register('tuitionFees', { valueAsNumber: true })} />
                {errors.tuitionFees && (
                  <p className="text-sm text-red-500">{errors.tuitionFees.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacité</Label>
                <Input id="capacity" type="number" min={0} max={10000} {...register('capacity', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="programId">Filière associée *</Label>
              <Select
                value={selectedProgramId}
                items={programs.map((program) => ({ value: program.id, label: `${program.name} (${program.diploma})` }))}
                onValueChange={(value) => {
                  const programId = String(value ?? '');
                  setSelectedProgramId(programId);
                  setValue('programId', programId, { shouldValidate: true });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionnez la filière correspondante" /></SelectTrigger>
                <SelectContent>{programs.map((program) => <SelectItem key={program.id} value={program.id}>{program.name} ({program.diploma})</SelectItem>)}</SelectContent>
              </Select>
              {errors.programId && (
                <p className="text-sm text-red-500">{errors.programId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Année académique *</Label>
              <Input id="academicYear" maxLength={20} {...register('academicYear')} />
              {errors.academicYear && (
                <p className="text-sm text-red-500">{errors.academicYear.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicationDeadline">Date limite de candidature</Label>
              <Input id="applicationDeadline" type="date" {...register('applicationDeadline')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prerequisites">Prérequis (séparés par des virgules)</Label>
              <Input id="prerequisites" maxLength={2000} {...register('prerequisites')} />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push('/dashboard/school/offers')}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
