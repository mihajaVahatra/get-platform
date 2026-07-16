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
import toast from 'react-hot-toast';

const offerSchema = z.object({
  title: z.string().min(3, 'Titre trop court'),
  description: z.string().optional(),
  diploma: z.string().min(2, 'Diplôme requis'),
  duration: z.number().min(1, 'Durée minimale 1 mois'),
  tuitionFees: z.number().min(0, 'Frais invalides'),
  capacity: z.number().optional(),
  applicationDeadline: z.string().optional(),
  academicYear: z.string().min(4, 'Année académique requise'),
  prerequisites: z.string().optional(),
});

type OfferForm = z.infer<typeof offerSchema>;

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OfferForm>({
    resolver: zodResolver(offerSchema),
  });

  useEffect(() => {
    if (id) {
      fetchOffer();
    }
  }, [id]);

  const fetchOffer = async () => {
    try {
      const response = await apiClient.get(`/offers/${id}`);
      const offer = response.data.data;
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
      });
    } catch (error) {
      toast.error('Erreur lors du chargement de l\'offre');
      router.push('/dashboard/school/offers');
    } finally {
      setLoadingData(false);
    }
  };

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
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre de l'offre *</Label>
              <Input id="title" {...register('title')} />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register('description')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="diploma">Diplôme *</Label>
                <Input id="diploma" {...register('diploma')} />
                {errors.diploma && (
                  <p className="text-sm text-red-500">{errors.diploma.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Durée (mois) *</Label>
                <Input id="duration" type="number" {...register('duration', { valueAsNumber: true })} />
                {errors.duration && (
                  <p className="text-sm text-red-500">{errors.duration.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tuitionFees">Frais (MGA) *</Label>
                <Input id="tuitionFees" type="number" {...register('tuitionFees', { valueAsNumber: true })} />
                {errors.tuitionFees && (
                  <p className="text-sm text-red-500">{errors.tuitionFees.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacité</Label>
                <Input id="capacity" type="number" {...register('capacity', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Année académique *</Label>
              <Input id="academicYear" {...register('academicYear')} />
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
              <Input id="prerequisites" {...register('prerequisites')} />
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
