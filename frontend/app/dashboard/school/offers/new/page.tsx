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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DIPLOMAS = {
  LICENCE: { label: 'Licence', duration: 36, tuitionFees: 3500000 },
  MASTER_1: { label: 'Master 1', duration: 12, tuitionFees: 4000000 },
  MASTER_2: { label: 'Master 2', duration: 12, tuitionFees: 4500000 },
  DOCTORAT: { label: 'Doctorat', duration: 36, tuitionFees: 5000000 },
} as const;

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
  programId: z.string().uuid('Sélectionnez la filière correspondante'),
});
type OfferForm = z.infer<typeof schema>;

export default function NewSchoolOfferPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<{ id: string; name: string; isRequired: boolean }[]>([]);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const currentYear = new Date().getFullYear();
  const academicYears = Array.from({ length: 4 }, (_, index) => {
    const year = currentYear + index;
    return `${year}-${year + 1}`;
  });
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<OfferForm>({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: academicYears[0] },
  });

  useEffect(() => {
    apiClient.get('/schools/me')
      .then((response) => setSchoolId(response.data.data?.id ?? null))
      .catch(() => {
        toast.error('Impossible de charger votre établissement');
        router.replace('/dashboard/school/offers');
      });
    apiClient.get('/schools/me/requirements').then((response) => setRequirements(response.data.data ?? response.data ?? [])).catch(() => undefined);
    apiClient.get('/schools/me/programs').then((response) => setPrograms((response.data.data || []).filter((program: { isActive: boolean }) => program.isActive))).catch(() => toast.error('Impossible de charger les filières'));
  }, [router]);

  const onSubmit = async (data: OfferForm) => {
    if (!schoolId) return toast.error('Établissement introuvable');
    setSaving(true);
    try {
      await apiClient.post('/offers', {
        ...data,
        schoolId,
        requirementIds: selectedRequirements,
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
            <Field label="Titre de l’offre" required error={errors.title?.message}><Input {...register('title')} placeholder="Licence Informatique" /></Field>
            <Field label="Description"><Input {...register('description')} placeholder="Présentez brièvement la formation" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Diplôme" required error={errors.diploma?.message}>
                <Select items={Object.entries(DIPLOMAS).map(([value, option]) => ({ value, label: option.label }))} onValueChange={(value) => {
                  const option = DIPLOMAS[value as keyof typeof DIPLOMAS];
                  if (!option) return;
                  setValue('diploma', option.label, { shouldValidate: true });
                  setValue('duration', option.duration, { shouldValidate: true });
                  setValue('tuitionFees', option.tuitionFees, { shouldValidate: true });
                }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un diplôme" /></SelectTrigger>
                  <SelectContent>{Object.entries(DIPLOMAS).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Filière associée" required error={errors.programId?.message}>
                <Select items={programs.map((program) => ({ value: program.id, label: program.name }))} onValueChange={(value) => setValue('programId', String(value ?? ''), { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionnez la filière correspondante" /></SelectTrigger>
                  <SelectContent>{programs.map((program) => <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Durée (mois)" required error={errors.duration?.message}><Input type="number" {...register('duration', { valueAsNumber: true })} /></Field>
              <Field label="Frais de scolarité (MGA)" required error={errors.tuitionFees?.message}><Input type="number" {...register('tuitionFees', { valueAsNumber: true })} /><p className="text-xs text-muted-foreground">Prérempli selon le diplôme, modifiable si nécessaire.</p></Field>
              <Field label="Capacité"><Input type="number" {...register('capacity', { valueAsNumber: true })} /></Field>
              <Field label="Année académique" required error={errors.academicYear?.message}>
                <Select items={academicYears.map((year) => ({ value: year, label: year }))} defaultValue={academicYears[0]} onValueChange={(value) => setValue('academicYear', value ?? academicYears[0], { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{academicYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Date limite"><Input type="date" {...register('applicationDeadline')} /></Field>
            </div>
            <Field label="Prérequis"><Input {...register('prerequisites')} placeholder="Baccalauréat, dossier académique" /></Field>
            <div className="space-y-2">
              <Label>Pièces et prérequis du dossier</Label>
              {requirements.length ? requirements.map((requirement) => <label key={requirement.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedRequirements.includes(requirement.id)} onChange={() => setSelectedRequirements((current) => current.includes(requirement.id) ? current.filter((id) => id !== requirement.id) : [...current, requirement.id])} />{requirement.name}{requirement.isRequired && <span className="text-red-500">*</span>}</label>) : <p className="text-sm text-muted-foreground">Aucun prérequis configuré. Ajoutez-les dans Paramètres.</p>}
            </div>
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

function Field({ label, required = false, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>{children}{error && <p className="text-sm text-red-500">{error}</p>}</div>;
}
