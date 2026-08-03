'use client';

import { useEffect, useState } from 'react';
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
  DialogTrigger,
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

type Report = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ReportForm = {
  name: string;
  type: 'NATIONAL' | 'REGIONAL' | 'SECTORIAL';
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  periodStart: string;
  periodEnd: string;
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
};

const exportExtensions: Record<ReportForm['format'], string> = {
  PDF: 'pdf',
  EXCEL: 'xls',
  CSV: 'csv',
  JSON: 'json',
};

const PAGE_SIZE = 10;

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const createInitialReportForm = (): ReportForm => ({
  name: '',
  type: 'NATIONAL',
  period: 'MONTHLY',
  periodStart: '',
  periodEnd: '',
  format: 'PDF',
});

const reportTypeLabels: Record<string, string> = {
  NATIONAL: 'National',
  REGIONAL: 'Régional',
  SECTORIAL: 'Sectoriel',
};

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

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<ReportForm>(createInitialReportForm);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      try {
        const response = await apiClient.get('/ministry/reports', {
          params: { page, limit: PAGE_SIZE },
        });
        if (cancelled) return;

        setReports(Array.isArray(response.data.data) ? response.data.data : []);
        setMeta(normalizeMeta(response.data.meta, page));
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        console.error('Erreur chargement rapports:', error);
        setLoadError(
          'Les rapports ne peuvent pas être chargés pour le moment.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  const refreshReports = (resetToFirstPage = false) => {
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

  const handleGenerate = async () => {
    const name = formData.name.trim();
    if (!name || !formData.periodStart || !formData.periodEnd) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (formData.periodStart > formData.periodEnd) {
      toast.error(
        'La date de fin doit être postérieure ou égale à la date de début.',
      );
      return;
    }

    setIsGenerating(true);
    try {
      await apiClient.post('/ministry/reports/generate', {
        ...formData,
        name,
      });
      toast.success('Le rapport a été enregistré.');
      setIsDialogOpen(false);
      setFormData(createInitialReportForm());
      refreshReports(true);
    } catch (error) {
      console.error('Erreur génération rapport:', error);
      toast.error('La génération du rapport a échoué.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (
    reportId: string,
    format: ReportForm['format'],
  ) => {
    try {
      const response = await apiClient.get(
        `/ministry/reports/${reportId}/export?format=${format}`,
        { responseType: 'blob' },
      );
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], {
              type:
                typeof response.headers['content-type'] === 'string'
                  ? response.headers['content-type']
                  : undefined,
            });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      try {
        link.href = url;
        link.download = `rapport-${reportId}.${exportExtensions[format]}`;
        document.body.appendChild(link);
        link.click();
        toast.success('Téléchargement lancé.');
      } finally {
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      }
    } catch (error) {
      console.error('Erreur téléchargement rapport:', error);
      toast.error('Le téléchargement du rapport a échoué.');
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
          <h1 className="text-2xl font-bold">📋 Rapports</h1>
          <p className="text-sm text-gray-500">
            {loading
              ? 'Mise à jour des rapports…'
              : `${meta.total} rapport(s) généré(s) · page ${meta.page} sur ${meta.totalPages}`}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            ➕ Générer un rapport
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Générer un rapport</DialogTitle>
              <DialogDescription>
                Renseignez une période cohérente avant de créer le rapport.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du rapport *</Label>
                <Input
                  id="name"
                  placeholder="Rapport annuel 2024"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData({ ...formData, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  items={[
                    { value: 'NATIONAL', label: 'National' },
                    { value: 'REGIONAL', label: 'Régional' },
                    { value: 'SECTORIAL', label: 'Sectoriel' },
                  ]}
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value ?? 'NATIONAL' })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NATIONAL">National</SelectItem>
                    <SelectItem value="REGIONAL">Régional</SelectItem>
                    <SelectItem value="SECTORIAL">Sectoriel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Période</Label>
                <Select
                  items={[
                    { value: 'DAILY', label: 'Quotidien' },
                    { value: 'WEEKLY', label: 'Hebdomadaire' },
                    { value: 'MONTHLY', label: 'Mensuel' },
                    { value: 'QUARTERLY', label: 'Trimestriel' },
                    { value: 'ANNUAL', label: 'Annuel' },
                  ]}
                  value={formData.period}
                  onValueChange={(value) =>
                    setFormData({ ...formData, period: value ?? 'MONTHLY' })
                  }
                >
                  <SelectTrigger id="period">
                    <SelectValue placeholder="Sélectionner une période" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Quotidien</SelectItem>
                    <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                    <SelectItem value="MONTHLY">Mensuel</SelectItem>
                    <SelectItem value="QUARTERLY">Trimestriel</SelectItem>
                    <SelectItem value="ANNUAL">Annuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="periodStart">Date de début *</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    max={formData.periodEnd || undefined}
                    value={formData.periodStart}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        periodStart: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">Date de fin *</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    min={formData.periodStart || undefined}
                    value={formData.periodEnd}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        periodEnd: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Format d’export</Label>
                <Select
                  items={[
                    { value: 'PDF', label: 'PDF' },
                    { value: 'EXCEL', label: 'Excel' },
                    { value: 'CSV', label: 'CSV' },
                    { value: 'JSON', label: 'JSON' },
                  ]}
                  value={formData.format}
                  onValueChange={(value) =>
                    setFormData({ ...formData, format: value ?? 'PDF' })
                  }
                >
                  <SelectTrigger id="format">
                    <SelectValue placeholder="Sélectionner un format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="EXCEL">Excel</SelectItem>
                    <SelectItem value="CSV">CSV</SelectItem>
                    <SelectItem value="JSON">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isGenerating}
              >
                Annuler
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? 'Génération…' : 'Générer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loadError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
            <Button
              variant="outline"
              onClick={() => refreshReports()}
              disabled={loading}
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && reports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Chargement des rapports…
          </CardContent>
        </Card>
      ) : !loadError && reports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Aucun rapport généré.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">
                      {report.name}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {reportTypeLabels[report.type] || report.type} •{' '}
                      {report.period}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {formatDate(report.generatedAt)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm text-gray-500">
                    {report.description && <span>📝 {report.description}</span>}
                    <span className={report.description ? 'ml-4' : ''}>
                      📅 {formatDate(report.periodStart)} →{' '}
                      {formatDate(report.periodEnd)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {(['PDF', 'EXCEL', 'CSV'] as const).map((format) => (
                      <Button
                        key={format}
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownload(report.id, format)}
                      >
                        {format === 'EXCEL' ? 'Excel' : format}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
