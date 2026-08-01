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
type Program = {
  id: string;
  name: string;
  diploma: string;
  durationYears: number;
  isActive: boolean;
};
type AcademicYear = {
  id: string;
  label: string;
  enrollmentOpensAt: string;
  enrollmentClosesAt: string;
  isCurrent: boolean;
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
  const [programs, setPrograms] = useState<Program[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programForm, setProgramForm] = useState({
    name: '',
    diploma: 'Licence',
    durationYears: '3',
  });
  const [academicForm, setAcademicForm] = useState({
    label: '',
    enrollmentOpensAt: '',
    enrollmentClosesAt: '',
  });
  const [subjects, setSubjects] = useState<
    { id: string; name: string; isActive: boolean }[]
  >([]);
  const [subjectName, setSubjectName] = useState('');

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
          toast.error(
            'Impossible de charger les informations de l’établissement',
          );
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
        if (!cancelled)
          setRequirements(response.data.data ?? response.data ?? []);
      } catch {
        if (!cancelled) toast.error('Impossible de charger les prérequis');
      }
    };

    void loadRequirements();
    return () => {
      cancelled = true;
    };
  }, [diploma]);

  const refreshPrograms = async () => {
    const response = await apiClient.get('/schools/me/programs');
    setPrograms(response.data.data || []);
  };
  const refreshAcademicYears = async () => {
    const response = await apiClient.get('/schools/me/academic-years');
    setAcademicYears(response.data.data || []);
  };
  useEffect(() => {
    void Promise.all([refreshPrograms(), refreshAcademicYears()]).catch(() =>
      toast.error('Impossible de charger les filières et années académiques'),
    );
  }, []);
  const refreshSubjects = async () => {
    const response = await apiClient.get('/schools/me/subjects');
    setSubjects(response.data.data || []);
  };
  useEffect(() => {
    void refreshSubjects().catch(() =>
      toast.error('Impossible de charger les matières'),
    );
  }, []);

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
      await apiClient.patch(`/schools/me/requirements/${id}`, {
        isActive: false,
      });
      await refreshRequirements();
      toast.success('Prérequis archivé');
    } catch {
      toast.error('Impossible d’archiver le prérequis');
    }
  };
  const addProgram = async () => {
    if (!programForm.name.trim())
      return toast.error('Le nom de la filière est obligatoire');
    try {
      await apiClient.post('/schools/me/programs', {
        ...programForm,
        durationYears: Number(programForm.durationYears),
      });
      setProgramForm({ name: '', diploma: 'Licence', durationYears: '3' });
      await refreshPrograms();
      toast.success('Filière ajoutée');
    } catch {
      toast.error("Impossible d'ajouter la filière");
    }
  };
  const toggleProgram = async (program: Program) => {
    try {
      await apiClient.patch(`/schools/me/programs/${program.id}`, {
        isActive: !program.isActive,
      });
      await refreshPrograms();
      toast.success(
        program.isActive ? 'Filière archivée' : 'Filière réactivée',
      );
    } catch {
      toast.error('Impossible de modifier la filière');
    }
  };
  const addAcademicYear = async () => {
    if (
      !academicForm.label ||
      !academicForm.enrollmentOpensAt ||
      !academicForm.enrollmentClosesAt
    )
      return toast.error('Tous les champs sont obligatoires');
    if (academicForm.enrollmentClosesAt < academicForm.enrollmentOpensAt)
      return toast.error("La fermeture doit être postérieure à l'ouverture");
    try {
      await apiClient.post('/schools/me/academic-years', academicForm);
      setAcademicForm({
        label: '',
        enrollmentOpensAt: '',
        enrollmentClosesAt: '',
      });
      await refreshAcademicYears();
      toast.success('Année académique ajoutée');
    } catch {
      toast.error("Impossible d'ajouter l'année académique");
    }
  };
  const setCurrentAcademicYear = async (id: string) => {
    try {
      await apiClient.patch(`/schools/me/academic-years/${id}`, {
        isCurrent: true,
      });
      await refreshAcademicYears();
      toast.success('Année académique courante mise à jour');
    } catch {
      toast.error("Impossible de définir l'année courante");
    }
  };
  const addSubject = async () => {
    if (!subjectName.trim())
      return toast.error('Le nom de la matière est obligatoire');
    try {
      await apiClient.post('/schools/me/subjects', {
        name: subjectName.trim(),
      });
      setSubjectName('');
      await refreshSubjects();
      toast.success('Matière ajoutée');
    } catch {
      toast.error("Impossible d'ajouter la matière");
    }
  };
  const toggleSubject = async (subject: { id: string; isActive: boolean }) => {
    try {
      await apiClient.patch(`/schools/me/subjects/${subject.id}`, {
        isActive: !subject.isActive,
      });
      await refreshSubjects();
    } catch {
      toast.error('Impossible de modifier la matière');
    }
  };
  const enrollmentOpen = (year?: AcademicYear) =>
    !!year &&
    new Date(year.enrollmentOpensAt) <= new Date() &&
    new Date(year.enrollmentClosesAt) >= new Date();

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        Chargement des paramètres...
      </div>
    );
  }

  if (!school) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-slate-500">
        Impossible de charger les paramètres de l’établissement.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de l’établissement</h1>
        <p className="text-sm text-muted-foreground">
          Mettez à jour les informations visibles sur votre fiche.
        </p>
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
              onUpload={(logo) =>
                setSchool((current) =>
                  current ? { ...current, logo } : current,
                )
              }
              size={88}
            />
            <div>
              <p className="font-medium text-slate-800">
                Logo de l’établissement
              </p>
              <p className="mt-1 text-sm text-slate-500">
                PNG, JPG ou WEBP · 5 Mo maximum
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="school-name">Nom de l’établissement</Label>
                <Input
                  id="school-name"
                  required
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="school-description">Description</Label>
                <textarea
                  id="school-description"
                  value={form.description}
                  onChange={(event) =>
                    updateField('description', event.target.value)
                  }
                  rows={4}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-city">Ville</Label>
                <Input
                  id="school-city"
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-region">Région</Label>
                <Input
                  id="school-region"
                  value={form.region}
                  onChange={(event) =>
                    updateField('region', event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-email">E-mail de contact</Label>
                <Input
                  id="school-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    updateField('contactEmail', event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-phone">Téléphone</Label>
                <Input
                  id="school-phone"
                  value={form.contactPhone}
                  onChange={(event) =>
                    updateField('contactPhone', event.target.value)
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="school-website">Site web</Label>
                <Input
                  id="school-website"
                  type="url"
                  placeholder="https://..."
                  value={form.website}
                  onChange={(event) =>
                    updateField('website', event.target.value)
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="filieres">
        <CardHeader>
          <CardTitle>Filières</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              value={programForm.name}
              onChange={(event) =>
                setProgramForm({ ...programForm, name: event.target.value })
              }
              placeholder="Nom"
            />
            <Input
              value={programForm.diploma}
              onChange={(event) =>
                setProgramForm({ ...programForm, diploma: event.target.value })
              }
              placeholder="Diplôme"
            />
            <Select
              items={Array.from({ length: 8 }, (_, index) => ({
                value: String(index + 1),
                label: `${index + 1} an(s)`,
              }))}
              value={programForm.durationYears}
              onValueChange={(value) =>
                setProgramForm({ ...programForm, durationYears: value ?? '3' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 8 }, (_, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {index + 1} an(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={addProgram}>
              Ajouter
            </Button>
          </div>
          <div className="space-y-2">
            {programs.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune filière configurée.
              </p>
            ) : (
              programs.map((program) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={program.id}
                >
                  <span>
                    {program.name} · {program.diploma} · {program.durationYears}{' '}
                    ans{' '}
                    {!program.isActive && (
                      <em className="ml-2 text-slate-500">Archivée</em>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void toggleProgram(program)}
                  >
                    {program.isActive ? 'Archiver' : 'Réactiver'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Matières</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
              placeholder="Ex. Algorithmique"
            />
            <Button type="button" onClick={addSubject}>
              Ajouter
            </Button>
          </div>
          {subjects.map((subject) => (
            <div
              className="flex justify-between rounded-lg border p-3"
              key={subject.id}
            >
              <span>
                {subject.name}{' '}
                {!subject.isActive && (
                  <em className="text-slate-500">Archivée</em>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void toggleSubject(subject)}
              >
                {subject.isActive ? 'Archiver' : 'Réactiver'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Années académiques & inscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const current = academicYears.find((year) => year.isCurrent);
            return current ? (
              <p
                className={`rounded-lg p-3 text-sm font-medium ${enrollmentOpen(current) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
              >
                ● Inscriptions{' '}
                {enrollmentOpen(current) ? 'OUVERTES' : 'FERMÉES'} ·{' '}
                {current.label}
              </p>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Aucune année académique courante.
              </p>
            );
          })()}
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              value={academicForm.label}
              onChange={(event) =>
                setAcademicForm({ ...academicForm, label: event.target.value })
              }
              placeholder="2025-2026"
            />
            <Input
              type="date"
              value={academicForm.enrollmentOpensAt}
              onChange={(event) =>
                setAcademicForm({
                  ...academicForm,
                  enrollmentOpensAt: event.target.value,
                })
              }
            />
            <Input
              type="date"
              value={academicForm.enrollmentClosesAt}
              onChange={(event) =>
                setAcademicForm({
                  ...academicForm,
                  enrollmentClosesAt: event.target.value,
                })
              }
            />
            <Button type="button" onClick={addAcademicYear}>
              Ajouter
            </Button>
          </div>
          <div className="space-y-2">
            {academicYears.map((year) => (
              <div
                className="flex items-center justify-between rounded-lg border p-3"
                key={year.id}
              >
                <span>
                  {year.label}{' '}
                  {year.isCurrent && (
                    <b className="ml-2 text-emerald-600">Courante</b>
                  )}
                  <small className="ml-2 text-slate-500">
                    {new Date(year.enrollmentOpensAt).toLocaleDateString(
                      'fr-FR',
                    )}{' '}
                    →{' '}
                    {new Date(year.enrollmentClosesAt).toLocaleDateString(
                      'fr-FR',
                    )}
                  </small>
                </span>
                {!year.isCurrent && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void setCurrentAcademicYear(year.id)}
                  >
                    Définir comme courante
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prérequis d’admission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="requirement-diploma">Diplôme</Label>
            <Select
              items={diplomas.map((item) => ({ value: item, label: item }))}
              value={diploma}
              onValueChange={(value) => setDiploma(value ?? 'Licence')}
            >
              <SelectTrigger id="requirement-diploma">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {diplomas.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={requirementName}
              onChange={(event) => setRequirementName(event.target.value)}
              placeholder="Ex. Copie CIN"
            />
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isRequirementRequired}
                onChange={(event) =>
                  setIsRequirementRequired(event.target.checked)
                }
              />{' '}
              Obligatoire
            </label>
            <Button type="button" onClick={addRequirement}>
              Ajouter
            </Button>
          </div>
          <div className="space-y-2">
            {requirements.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucun prérequis pour ce diplôme.
              </p>
            ) : (
              requirements.map((item) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={item.id}
                >
                  <span>
                    {item.name}{' '}
                    {item.isRequired && <b className="text-red-500">*</b>}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => void archiveRequirement(item.id)}
                  >
                    Archiver
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Building2Icon className="size-4" /> Les modifications sont appliquées
        uniquement à votre établissement.
      </div>
    </div>
  );
}
