'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import toast from 'react-hot-toast';

type Report = {
  id: string;
  name: string;
  description?: string;
  type: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  fileUrl?: string;
  generatedAt: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'NATIONAL',
    period: 'MONTHLY',
    periodStart: '',
    periodEnd: '',
    format: 'PDF',
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/ministry/reports');
      setReports(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement rapports:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData.name || !formData.periodStart || !formData.periodEnd) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsGenerating(true);
    try {
      await apiClient.post('/ministry/reports/generate', formData);
      toast.success('Rapport en cours de génération');
      setIsDialogOpen(false);
      setFormData({
        name: '',
        type: 'NATIONAL',
        period: 'MONTHLY',
        periodStart: '',
        periodEnd: '',
        format: 'PDF',
      });
      fetchReports();
    } catch (error) {
      toast.error('Erreur lors de la génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (reportId: string, format: string) => {
    try {
      const response = await apiClient.get(
        `/ministry/reports/${reportId}/export?format=${format}`,
        {
          responseType: 'blob',
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `rapport-${reportId}.${format.toLowerCase()}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Téléchargement en cours');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      NATIONAL: 'National',
      REGIONAL: 'Régional',
      SECTORIAL: 'Sectoriel',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📋 Rapports</h1>
          <p className="text-gray-500 text-sm">
            {reports.length} rapport(s) généré(s)
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
                Remplissez les informations pour générer un nouveau rapport
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du rapport *</Label>
                <Input
                  id="name"
                  placeholder="Rapport annuel 2024"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
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
                  onValueChange={(v) =>
                    setFormData({ ...formData, type: v ?? 'NATIONAL' })
                  }
                >
                  <SelectTrigger>
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
                  onValueChange={(v) =>
                    setFormData({ ...formData, period: v ?? 'MONTHLY' })
                  }
                >
                  <SelectTrigger>
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
                  <Label htmlFor="periodStart">Date début *</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) =>
                      setFormData({ ...formData, periodStart: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">Date fin *</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) =>
                      setFormData({ ...formData, periodEnd: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Format d'export</Label>
                <Select
                  items={[
                    { value: 'PDF', label: 'PDF' },
                    { value: 'EXCEL', label: 'Excel' },
                    { value: 'CSV', label: 'CSV' },
                    { value: 'JSON', label: 'JSON' },
                  ]}
                  value={formData.format}
                  onValueChange={(v) =>
                    setFormData({ ...formData, format: v ?? 'PDF' })
                  }
                >
                  <SelectTrigger>
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
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? 'Génération...' : 'Générer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Aucun rapport généré.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {getTypeLabel(report.type)} • {report.period}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {formatDate(report.generatedAt)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm text-gray-500">
                    {report.description && <span>📝 {report.description}</span>}
                    <span className="ml-4">
                      📅 {formatDate(report.periodStart)} →{' '}
                      {formatDate(report.periodEnd)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report.id, 'PDF')}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report.id, 'EXCEL')}
                    >
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report.id, 'CSV')}
                    >
                      CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
