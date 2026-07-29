'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  title: z.string().min(3, 'Titre trop court'),
  description: z.string().optional(),
  diploma: z.string().min(2, 'Diplôme requis'),
  duration: z.number().min(6, 'La durée minimale est de 6 mois').max(60),
  tuitionFees: z.number().min(0, 'Frais invalides'),
  capacity: z.number().min(1).optional(),
  applicationDeadline: z.string().optional(),
  academicYear: z.string().min(4, 'Année académique requise'),
  prerequisites: z.string().optional(),
});
type OfferForm = z.infer<typeof schema>;

export default function NewSchoolOfferPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<OfferForm>({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: '2026-2027' },
  });

  useEffect(() => {
    apiClient.get('/schools/me')
      .then((response) => setSchoolId(response.data.data?.id ?? null))
      .catch(() => {
        toast.error('Impossible de charger votre établissement');
        router.replace('/dashboard/school/offers');
      });
  }, [router]);

  const onSubmit = async (data: OfferForm) => {
    if (!schoolId) return toast.error('Établissement introuvable');
    setSaving(true);
    try {
      await apiClient.post('/offers', {
        ...data,
        schoolId,
        duration: Number(data.duration),
        tuitionFees: Number(data.tuitionFees),
        capacity: data.capacity ? Number(data.capacity) : undefined,
        prerequisites: data.prerequisites
          ? data.prerequisites.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      });
      toast.success('Offre créée avec succès');
      router.push('/dashboard/school/offers');
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erreur lors de la création de l'offre");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle offre</CardTitle>
          <CardDescription>Publiez une formation proposée par votre établissement.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <Field label="Titre de l’offre *" error={errors.title?.message}><Input {...register('title')} placeholder="Licence Informatique" /></Field>
            <Field label="Description"><Input {...register('description')} placeholder="Présentez brièvement la formation" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Diplôme *" error={errors.diploma?.message}><Input {...register('diploma')} placeholder="Licence" /></Field>
              <Field label="Durée (mois) *" error={errors.duration?.message}><Input type="number" {...register('duration', { valueAsNumber: true })} /></Field>
              <Field label="Frais de scolarité (MGA) *" error={errors.tuitionFees?.message}><Input type="number" {...register('tuitionFees', { valueAsNumber: true })} /></Field>
              <Field label="Capacité"><Input type="number" {...register('capacity', { valueAsNumber: true })} /></Field>
              <Field label="Année académique *" error={errors.academicYear?.message}><Input {...register('academicYear')} /></Field>
              <Field label="Date limite"><Input type="date" {...register('applicationDeadline')} /></Field>
            </div>
            <Field label="Prérequis"><Input {...register('prerequisites')} placeholder="Baccalauréat, dossier académique" /></Field>
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/school/offers')}>Annuler</Button>
            <Button type="submit" disabled={saving || !schoolId}>{saving ? 'Création…' : 'Créer l’offre'}</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{error && <p className="text-sm text-red-500">{error}</p>}</div>;
}
