'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Building2Icon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type School = {
  id: string;
  name: string;
  description?: string | null;
  city?: string | null;
  region?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  logo?: string | null;
};

type SchoolForm = {
  name: string;
  description: string;
  city: string;
  region: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
};

type Requirement = {
  id: string;
  name: string;
  diploma?: string;
  isRequired: boolean;
};

const EMPTY_FORM: SchoolForm = {
  name: '',
  description: '',
  city: '',
  region: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
};

const diplomas = ['Licence', 'Master 1', 'Master 2', 'Doctorat'];

export default function SchoolSettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [form, setForm] = useState<SchoolForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diploma, setDiploma] = useState('Licence');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [requirementName, setRequirementName] = useState('');
  const [isRequirementRequired, setIsRequirementRequired] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadSchool = async () => {
      try {
        const response = await apiClient.get('/schools/me');
        const currentSchool = response.data.data as School;
        if (cancelled) return;

        setSchool(currentSchool);
        setForm({
          name: currentSchool.name || '',
          description: currentSchool.description || '',
          city: currentSchool.city || '',
          region: currentSchool.region || '',
          contactEmail: currentSchool.contactEmail || '',
          contactPhone: currentSchool.contactPhone || '',
          website: currentSchool.website || '',
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement établissement:', error);
          toast.error('Impossible de charger les informations de l’établissement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSchool();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRequirements = async () => {
      try {
        const response = await apiClient.get(
          `/schools/me/requirements?diploma=${encodeURIComponent(diploma)}`,
        );
        if (!cancelled) setRequirements(response.data.data ?? response.data ?? []);
      } catch {
        if (!cancelled) toast.error('Impossible de charger les prérequis');
      }
    };

    void loadRequirements();
    return () => {
      cancelled = true;
    };
  }, [diploma]);

  const updateField = (field: keyof SchoolForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!school) return;

    setSaving(true);
    try {
      const response = await apiClient.put(`/schools/${school.id}`, {
        name: form.name,
        description: form.description || null,
        city: form.city || null,
        region: form.region || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        website: form.website || null,
      });
      const updatedSchool = response.data.data as School;
      setSchool((current) => ({ ...current, ...updatedSchool }));
      toast.success('Informations de l’établissement enregistrées');
    } catch (error) {
      console.error('Erreur mise à jour établissement:', error);
      toast.error('Impossible d’enregistrer les modifications');
    } finally {
      setSaving(false);
    }
  };

  const refreshRequirements = async () => {
    const response = await apiClient.get(
      `/schools/me/requirements?diploma=${encodeURIComponent(diploma)}`,
    );
    setRequirements(response.data.data ?? response.data ?? []);
  };

  const addRequirement = async () => {
    if (!requirementName.trim()) {
      toast.error('Le nom du prérequis est obligatoire');
      return;
    }

    try {
      await apiClient.post('/schools/me/requirements', {
        name: requirementName.trim(),
        diploma,
        isRequired: isRequirementRequired,
      });
      setRequirementName('');
      await refreshRequirements();
      toast.success('Prérequis ajouté');
    } catch {
      toast.error('Impossible d’ajouter le prérequis');
    }
  };

  const archiveRequirement = async (id: string) => {
    try {
      await apiClient.patch(`/schools/me/requirements/${id}`, { isActive: false });
      await refreshRequirements();
      toast.success('Prérequis archivé');
    } catch {
      toast.error('Impossible d’archiver le prérequis');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement des paramètres...</div>;
  }

  if (!school) {
    return <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-slate-500">Impossible de charger les paramètres de l’établissement.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de l’établissement</h1>
        <p className="text-sm text-muted-foreground">Mettez à jour les informations visibles sur votre fiche.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil de l’établissement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center gap-4 rounded-lg bg-violet-50 p-4">
            <AvatarUpload
              currentUrl={school.logo || undefined}
              endpoint={`/schools/${school.id}/logo`}
              fallbackText={form.name.slice(0, 2).toUpperCase() || 'ÉC'}
              onUpload={(logo) => setSchool((current) => current ? { ...current, logo } : current)}
              size={88}
            />
            <div>
              <p className="font-medium text-slate-800">Logo de l’établissement</p>
              <p className="mt-1 text-sm text-slate-500">PNG, JPG ou WEBP · 5 Mo maximum</p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="school-name">Nom de l’établissement</Label>
                <Input id="school-name" required value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="school-description">Description</Label>
                <textarea id="school-description" value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={4} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-city">Ville</Label>
                <Input id="school-city" value={form.city} onChange={(event) => updateField('city', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-region">Région</Label>
                <Input id="school-region" value={form.region} onChange={(event) => updateField('region', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-email">E-mail de contact</Label>
                <Input id="school-email" type="email" value={form.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-phone">Téléphone</Label>
                <Input id="school-phone" value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="school-website">Site web</Label>
                <Input id="school-website" type="url" placeholder="https://..." value={form.website} onChange={(event) => updateField('website', event.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prérequis d’admission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="requirement-diploma">Diplôme</Label>
            <Select value={diploma} onValueChange={(value) => setDiploma(value ?? 'Licence')}>
              <SelectTrigger id="requirement-diploma"><SelectValue /></SelectTrigger>
              <SelectContent>
                {diplomas.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={requirementName} onChange={(event) => setRequirementName(event.target.value)} placeholder="Ex. Copie CIN" />
            <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={isRequirementRequired} onChange={(event) => setIsRequirementRequired(event.target.checked)} /> Obligatoire</label>
            <Button type="button" onClick={addRequirement}>Ajouter</Button>
          </div>
          <div className="space-y-2">
            {requirements.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun prérequis pour ce diplôme.</p>
            ) : requirements.map((item) => (
              <div className="flex items-center justify-between rounded-lg border p-3" key={item.id}>
                <span>{item.name} {item.isRequired && <b className="text-red-500">*</b>}</span>
                <Button type="button" variant="ghost" className="text-red-600" onClick={() => void archiveRequirement(item.id)}>Archiver</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Building2Icon className="size-4" /> Les modifications sont appliquées uniquement à votre établissement.
      </div>
    </div>
  );
}
