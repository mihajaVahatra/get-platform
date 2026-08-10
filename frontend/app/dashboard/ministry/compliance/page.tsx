'use client';

import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ComplianceStatus = 'PASSED' | 'FAILED' | 'PENDING';

/** Dernier contrôle de conformité connu pour un établissement (chaque mise à jour crée une nouvelle entrée dans l'historique côté API). */
type ComplianceCheck = {
  id: string;
  status: ComplianceStatus;
  score?: number | null;
  remarks?: string | null;
  checkedAt: string;
  school: {
    id: string;
    name: string;
    city?: string | null;
    region?: string | null;
  };
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ComplianceUpdateForm = {
  status: ComplianceStatus;
  score: string;
  remarks: string;
};

const PAGE_SIZE = 10;

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const statusLabels: Record<ComplianceStatus, string> = {
  PASSED: 'Conforme',
  FAILED: 'Non conforme',
  PENDING: 'En attente',
};

const statusColors: Record<ComplianceStatus, string> = {
  PASSED: 'bg-green-600',
  FAILED: 'bg-red-600',
  PENDING: 'bg-yellow-500',
};

/**
 * Normalise les métadonnées de pagination renvoyées par l'API en repli sûr
 * (valeurs par défaut si absentes/invalides), pour éviter tout NaN ou page
 * totale à zéro dans l'interface.
 */
function normalizeMeta(
  meta: Partial<PaginationMeta> | undefined,
  page: number,
) {
  return {
    page: Number(meta?.page) || page,
    limit: Number(meta?.limit) || PAGE_SIZE,
    total: Number(meta?.total) || 0,
    totalPages: Math.max(Number(meta?.totalPages) || 1, 1),
  };
}

/**
 * Page de suivi de la conformité des établissements pour le ministère.
 *
 * Liste paginée (`GET /ministry/compliance`, `latestOnly: true` pour ne
 * récupérer que le dernier contrôle par établissement) filtrable par statut
 * (conforme / non conforme / en attente). Permet d'enregistrer un nouveau
 * contrôle via `PUT /ministry/compliance/:schoolId`, qui ajoute une entrée à
 * l'historique côté API plutôt que d'écraser le contrôle précédent.
 *
 * Volontairement, aucune donnée élève n'est affichée sur cette page
 * (uniquement des informations agrégées au niveau établissement).
 */
export default function CompliancePage() {
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>(
    'ALL',
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingCheck, setEditingCheck] = useState<ComplianceCheck | null>(
    null,
  );
  const [updateForm, setUpdateForm] = useState<ComplianceUpdateForm>({
    status: 'PENDING',
    score: '',
    remarks: '',
  });
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Recharge la liste à chaque changement de page, de filtre de statut, ou après une mise
  // à jour réussie (via `reloadKey`, incrémenté par `refreshCompliance`).
  useEffect(() => {
    let cancelled = false;

    const loadCompliance = async () => {
      try {
        const response = await apiClient.get('/ministry/compliance', {
          params: {
            page,
            limit: PAGE_SIZE,
            latestOnly: true,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
          },
        });
        if (cancelled) return;

        setChecks(Array.isArray(response.data.data) ? response.data.data : []);
        setMeta(normalizeMeta(response.data.meta, page));
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        console.error('Erreur chargement conformité:', error);
        setLoadError(
          'Les contrôles de conformité ne peuvent pas être chargés pour le moment.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadCompliance();
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey, statusFilter]);

  /** Force un rechargement de la liste (ex. après une mise à jour), avec retour optionnel à la première page. */
  const refreshCompliance = (resetToFirstPage = false) => {
    setLoading(true);
    setLoadError(null);
    if (resetToFirstPage) setPage(1);
    setReloadKey((current) => current + 1);
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > meta.totalPages || nextPage === page) return;
    setLoading(true);
    setLoadError(null);
    setPage(nextPage);
  };

  const changeStatusFilter = (nextStatus: 'ALL' | ComplianceStatus) => {
    if (nextStatus === statusFilter && page === 1) return;
    setLoading(true);
    setLoadError(null);
    setPage(1);
    setStatusFilter(nextStatus);
  };

  /** Ouvre le dialogue de mise à jour, pré-rempli avec les valeurs du contrôle sélectionné. */
  const openUpdateDialog = (check: ComplianceCheck) => {
    setEditingCheck(check);
    setUpdateError(null);
    setUpdateForm({
      status: check.status,
      score: typeof check.score === 'number' ? String(check.score) : '',
      remarks: check.remarks || '',
    });
  };

  const closeUpdateDialog = () => {
    if (isSaving) return;
    setEditingCheck(null);
    setUpdateError(null);
  };

  // Valide et envoie le nouveau contrôle de conformité ; réinitialise le filtre de statut
  // à « Tous » après succès pour que l'établissement mis à jour reste visible même si son
  // nouveau statut ne correspond plus au filtre actif.
  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCheck) return;

    const score = updateForm.score.trim();
    const numericScore = score === '' ? undefined : Number(score);
    // Le score est facultatif (champ vide accepté), mais s'il est renseigné il doit être
    // un nombre compris entre 0 et 100 — validé côté client avant l'appel API.
    if (
      numericScore !== undefined &&
      (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)
    ) {
      setUpdateError('Le score doit être compris entre 0 et 100.');
      return;
    }

    setIsSaving(true);
    setUpdateError(null);
    try {
      await apiClient.put(`/ministry/compliance/${editingCheck.school.id}`, {
        status: updateForm.status,
        score: numericScore,
        remarks: updateForm.remarks.trim() || undefined,
      });
      toast.success('Le contrôle de conformité a été mis à jour.');
      setEditingCheck(null);
      setStatusFilter('ALL');
      refreshCompliance(true);
    } catch (error) {
      console.error('Erreur mise à jour conformité:', error);
      setUpdateError(
        'La mise à jour a échoué. Vérifiez les valeurs puis réessayez.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Suivi de la conformité</h1>
          <p className="text-sm text-gray-500">
            {loading
              ? 'Mise à jour des contrôles…'
              : `${meta.total} contrôle(s) · page ${meta.page} sur ${meta.totalPages}`}
          </p>
        </div>
        <Select
          items={[
            { value: 'ALL', label: 'Tous les statuts' },
            { value: 'PASSED', label: 'Conforme' },
            { value: 'FAILED', label: 'Non conforme' },
            { value: 'PENDING', label: 'En attente' },
          ]}
          value={statusFilter}
          onValueChange={(value) =>
            changeStatusFilter((value ?? 'ALL') as 'ALL' | ComplianceStatus)
          }
        >
          <SelectTrigger aria-label="Filtrer par statut">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            <SelectItem value="PASSED">Conforme</SelectItem>
            <SelectItem value="FAILED">Non conforme</SelectItem>
            <SelectItem value="PENDING">En attente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loadError && checks.length > 0 && (
        <p className="text-xs text-slate-500">
          Chaque ligne représente l’état actuel d’un établissement. Les données
          élèves ne sont pas affichées ici.
        </p>
      )}

      {loadError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
            <Button
              variant="outline"
              onClick={() => refreshCompliance()}
              disabled={loading}
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && checks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Chargement des contrôles de conformité…
          </CardContent>
        </Card>
      ) : !loadError && checks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">
              Aucun contrôle ne correspond à ce filtre.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {checks.map((check) => {
            const location = [check.school.city, check.school.region]
              .filter(Boolean)
              .join(' · ');

            return (
              <Card
                key={check.id}
                className="transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {check.school.name}
                      </CardTitle>
                      {location && (
                        <p className="text-sm text-gray-500">{location}</p>
                      )}
                    </div>
                    <Badge
                      className={`shrink-0 ${statusColors[check.status]} text-white`}
                    >
                      {statusLabels[check.status] || check.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Badge variant="secondary">État actuel</Badge>
                    {typeof check.score === 'number' && (
                      <span className="text-gray-500">
                        Score :{' '}
                        <span className="font-medium">{check.score}/100</span>
                      </span>
                    )}
                    <span className="text-gray-500">
                      Contrôlé le :{' '}
                      <span className="font-medium">
                        {formatDate(check.checkedAt)}
                      </span>
                    </span>
                    {check.remarks && (
                      <span className="w-full text-xs text-gray-500">
                        📝 {check.remarks}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => openUpdateDialog(check)}
                    >
                      Mettre à jour
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {meta.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text="Précédent"
                className={
                  page <= 1 || loading ? 'pointer-events-none opacity-50' : ''
                }
                onClick={(event) => {
                  event.preventDefault();
                  changePage(page - 1);
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                href="#"
                isActive
                onClick={(event) => event.preventDefault()}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                text="Suivant"
                className={
                  page >= meta.totalPages || loading
                    ? 'pointer-events-none opacity-50'
                    : ''
                }
                onClick={(event) => {
                  event.preventDefault();
                  changePage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <Dialog
        open={Boolean(editingCheck)}
        onOpenChange={(open) => {
          if (!open) closeUpdateDialog();
        }}
      >
        <DialogContent>
          {editingCheck && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Mettre à jour la conformité</DialogTitle>
                <DialogDescription>
                  {editingCheck.school.name}. Cette action ajoute un nouveau
                  contrôle à l’historique.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="compliance-status">Statut</Label>
                  <Select
                    items={[
                      { value: 'PASSED', label: 'Conforme' },
                      { value: 'FAILED', label: 'Non conforme' },
                      { value: 'PENDING', label: 'En attente' },
                    ]}
                    value={updateForm.status}
                    onValueChange={(value) =>
                      setUpdateForm({
                        ...updateForm,
                        status: (value ?? 'PENDING') as ComplianceStatus,
                      })
                    }
                  >
                    <SelectTrigger id="compliance-status">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PASSED">Conforme</SelectItem>
                      <SelectItem value="FAILED">Non conforme</SelectItem>
                      <SelectItem value="PENDING">En attente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compliance-score">Score (facultatif)</Label>
                  <Input
                    id="compliance-score"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    inputMode="numeric"
                    value={updateForm.score}
                    onChange={(event) =>
                      setUpdateForm({
                        ...updateForm,
                        score: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compliance-remarks">
                    Remarque (facultative)
                  </Label>
                  <textarea
                    id="compliance-remarks"
                    className="min-h-24 w-full rounded-lg border border-input bg-transparent p-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    maxLength={2000}
                    value={updateForm.remarks}
                    onChange={(event) =>
                      setUpdateForm({
                        ...updateForm,
                        remarks: event.target.value,
                      })
                    }
                  />
                </div>
                {updateError && (
                  <p role="alert" className="text-sm text-red-600">
                    {updateError}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeUpdateDialog}
                  disabled={isSaving}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
