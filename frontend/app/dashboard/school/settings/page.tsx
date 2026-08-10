'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Building2Icon, DoorOpenIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { AvatarUpload } from '@/components/AvatarUpload';
import { MfaSettingsCard } from '@/components/auth/MfaSettingsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Extrait le message d'erreur métier renvoyé par l'API dans une réponse Axios, si présent. */
function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

/** Établissement scolaire, tel que renvoyé par `GET /schools/me`. */
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

/** Champs éditables du formulaire de profil de l'établissement (sous-ensemble de `School`, tous en string pour les inputs contrôlés). */
type SchoolForm = {
  name: string;
  description: string;
  city: string;
  region: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
};

/** Pièce/prérequis de dossier exigé pour un diplôme donné. */
type Requirement = {
  id: string;
  name: string;
  diploma?: string;
  isRequired: boolean;
};
/** Filière (programme d'études) proposée par l'établissement. */
type Program = {
  id: string;
  name: string;
  diploma: string;
  durationYears: number;
  isActive: boolean;
};
/** Année académique et sa fenêtre d'ouverture des inscriptions. */
type AcademicYear = {
  id: string;
  label: string;
  enrollmentOpensAt: string;
  enrollmentClosesAt: string;
  /** Une seule année peut être « courante » à la fois pour l'établissement. */
  isCurrent: boolean;
};

/** Valeurs initiales du formulaire de profil avant chargement des données de l'établissement. */
const EMPTY_FORM: SchoolForm = {
  name: '',
  description: '',
  city: '',
  region: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
};

/** Diplômes proposés comme options pour le filtre de prérequis d'admission. */
const diplomas = ['Licence', 'Master 1', 'Master 2', 'Doctorat'];

/**
 * Page « Paramètres de l'établissement » du tableau de bord établissement
 * (route App Router `/dashboard/school/settings`).
 * Client component (`'use client'`) : centralise la configuration de l'établissement —
 * profil (logo, coordonnées), filières, matières, années académiques (fenêtre d'inscription),
 * prérequis d'admission par diplôme, salles (`RoomsManager`) et authentification multifacteur
 * (`MfaSettingsCard`). Chaque section gère indépendamment son propre état et ses appels API.
 */
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
  const [platformCities, setPlatformCities] = useState<string[]>([]);

  // Charge la liste des villes actives de la plateforme, utilisée comme options du sélecteur
  // « Ville » du profil (liste contrôlée côté plateforme plutôt que saisie libre).
  useEffect(() => {
    apiClient
      .get('/platform-cities')
      .then((response) =>
        setPlatformCities(
          (response.data.data as { name: string; isActive: boolean }[])
            .filter((item) => item.isActive)
            .map((item) => item.name),
        ),
      )
      .catch(() => setPlatformCities([]));
  }, []);

  // Charge le profil de l'établissement courant et initialise le formulaire d'édition.
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

  // Recharge les prérequis d'admission à chaque changement du diplôme sélectionné
  // (les prérequis sont propres à chaque diplôme).
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

  /** Recharge la liste des filières de l'établissement via `GET /schools/me/programs`. */
  const refreshPrograms = async () => {
    const response = await apiClient.get('/schools/me/programs');
    setPrograms(response.data.data || []);
  };
  /** Recharge la liste des années académiques via `GET /schools/me/academic-years`. */
  const refreshAcademicYears = async () => {
    const response = await apiClient.get('/schools/me/academic-years');
    setAcademicYears(response.data.data || []);
  };
  useEffect(() => {
    void Promise.all([refreshPrograms(), refreshAcademicYears()]).catch(() =>
      toast.error('Impossible de charger les filières et années académiques'),
    );
  }, []);
  /** Recharge la liste des matières via `GET /schools/me/subjects`. */
  const refreshSubjects = async () => {
    const response = await apiClient.get('/schools/me/subjects');
    setSubjects(response.data.data || []);
  };
  useEffect(() => {
    void refreshSubjects().catch(() =>
      toast.error('Impossible de charger les matières'),
    );
  }, []);

  /** Met à jour un champ du formulaire de profil de l'établissement. */
  const updateField = (field: keyof SchoolForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  /** Enregistre les modifications du profil de l'établissement via `PUT /schools/:id`. */
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

  /** Recharge les prérequis d'admission pour le diplôme actuellement sélectionné. */
  const refreshRequirements = async () => {
    const response = await apiClient.get(
      `/schools/me/requirements?diploma=${encodeURIComponent(diploma)}`,
    );
    setRequirements(response.data.data ?? response.data ?? []);
  };

  /** Ajoute un nouveau prérequis d'admission pour le diplôme sélectionné. */
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

  /**
   * Archive un prérequis (désactivation logique, `isActive: false`) plutôt que de le supprimer,
   * afin de préserver l'historique des dossiers déjà évalués avec ce prérequis.
   */
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
  /** Ajoute une nouvelle filière (programme d'études) à l'établissement. */
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
  /** Archive ou réactive une filière (bascule de `isActive`). */
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
  /**
   * Ajoute une nouvelle année académique après validation métier : les trois champs sont
   * obligatoires et la date de fermeture des inscriptions doit être postérieure à l'ouverture.
   */
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
  /** Définit une année académique comme « courante » (une seule à la fois côté API). */
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
  /** Ajoute une nouvelle matière enseignable dans l'établissement. */
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
  /** Archive ou réactive une matière (bascule de `isActive`). */
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
  // Les inscriptions pour une année sont considérées ouvertes uniquement si la date courante
  // se situe dans la fenêtre [enrollmentOpensAt, enrollmentClosesAt] de cette année.
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
          <div className="mb-6 flex items-center gap-4 rounded-lg bg-indigo-50 p-4">
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
                  maxLength={150}
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
                  maxLength={2000}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-city">Ville</Label>
                <Select
                  items={platformCities.map((city) => ({ value: city, label: city }))}
                  value={form.city}
                  onValueChange={(value) => updateField('city', value ?? '')}
                >
                  <SelectTrigger id="school-city">
                    <SelectValue placeholder="Sélectionner une ville" />
                  </SelectTrigger>
                  <SelectContent>
                    {platformCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-region">Région</Label>
                <Input
                  id="school-region"
                  maxLength={100}
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
                  maxLength={254}
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
                  maxLength={30}
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
                  maxLength={300}
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
              maxLength={150}
              placeholder="Nom"
            />
            <Input
              value={programForm.diploma}
              onChange={(event) =>
                setProgramForm({ ...programForm, diploma: event.target.value })
              }
              maxLength={100}
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
              maxLength={150}
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
              maxLength={20}
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
              maxLength={150}
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

      <RoomsManager />

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Building2Icon className="size-4" /> Les modifications sont appliquées
        uniquement à votre établissement.
      </div>
    </div>
  );
}

/** Types de salle disponibles, sous forme de paires [valeur API, libellé FR]. */
const ROOM_TYPES = [
  ['STANDARD', 'Standard'],
  ['LAB', 'Laboratoire'],
  ['AMPHI', 'Amphithéâtre'],
  ['SPORT', 'Sport'],
] as const;

/** Salle physique de l'établissement, utilisée pour la planification des cours. */
type Room = {
  id: string;
  name: string;
  capacity: number | null;
  type: string;
  isActive: boolean;
};

/**
 * Sous-section « Salles » de la page Paramètres : liste les salles de l'établissement et
 * permet d'en ajouter (via une boîte de dialogue) ou d'en supprimer. Affiche également
 * la carte de configuration MFA (`MfaSettingsCard`) en bas de la page paramètres.
 */
function RoomsManager() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [type, setType] = useState('STANDARD');
  const [saving, setSaving] = useState(false);

  /** Charge la liste des salles de l'établissement via `GET /schools/me/rooms`. */
  const loadRooms = useCallback(async () => {
    try {
      const response = await apiClient.get('/schools/me/rooms');
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement salles:', error);
      toast.error('Impossible de charger les salles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadRooms();
    });
    return () => {
      active = false;
    };
  }, [loadRooms]);

  /** Crée une nouvelle salle via `POST /schools/me/rooms` puis ferme la boîte de dialogue. */
  const createRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        await apiClient.post('/schools/me/rooms', {
          name,
          capacity: capacity ? Number(capacity) : undefined,
          type,
        });
        toast.success('Salle ajoutée');
        setDialogOpen(false);
        setName('');
        setCapacity('');
        setType('STANDARD');
        await loadRooms();
      } catch (error) {
        toast.error(axiosMessage(error) || 'Impossible de créer cette salle');
      } finally {
        setSaving(false);
      }
    })();
  };

  /** Supprime définitivement une salle via `DELETE /schools/me/rooms/:id`. */
  const deleteRoom = async (room: Room) => {
    try {
      await apiClient.delete(`/schools/me/rooms/${room.id}`);
      toast.success('Salle supprimée');
      await loadRooms();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer cette salle');
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111949]">Salles</h1>
          <p className="mt-1 text-sm text-indigo-600">
            Gérez les salles disponibles pour vos cours.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon /> Ajouter une salle
        </Button>
      </header>
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
          ) : rooms.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <DoorOpenIcon className="mx-auto size-8" />
              <p className="mt-3 text-sm">Aucune salle enregistrée.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">{room.name}</p>
                    <p className="mt-1 text-slate-500">
                      {ROOM_TYPES.find(([value]) => value === room.type)?.[1] || room.type}
                      {room.capacity ? ` · ${room.capacity} places` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Supprimer ${room.name}`}
                    onClick={() => void deleteRoom(room)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={createRoom}>
            <DialogHeader>
              <DialogTitle>Ajouter une salle</DialogTitle>
              <DialogDescription>
                Le nom doit être unique dans votre établissement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">Nom</Label>
                <Input id="room-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-capacity">Capacité (facultatif)</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  min={1}
                  max={10000}
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value.slice(0, 5))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-type">Type</Label>
                <Select
                  items={ROOM_TYPES.map(([value, label]) => ({ value, label }))}
                  value={type}
                  onValueChange={(value) => setType(value ?? 'STANDARD')}
                >
                  <SelectTrigger id="room-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !name}>
                {saving ? 'Ajout...' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MfaSettingsCard />
    </div>
  );
}
