'use client';

import { useState } from 'react';
import { DownloadIcon, FileSpreadsheetIcon, UsersRoundIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PipelineFunnel } from '@/components/school-portal/reports/PipelineFunnel';
import { OutcomesChart } from '@/components/school-portal/reports/OutcomesChart';
import { TrendLine } from '@/components/school-portal/reports/TrendLine';
import { MagnitudeBarChart } from '@/components/school-portal/reports/MagnitudeBarChart';
import styles from '@/components/school-portal/reports/reports.module.css';

type ReportType = 'applications' | 'students';

export default function SchoolReportsPage() {
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  const download = async (type: ReportType) => {
    setDownloading(type);
    try {
      const response = await apiClient.get(`/schools/me/reports/export?type=${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé');
    } catch (error) {
      console.error('Erreur export CSV:', error);
      toast.error("Impossible de générer l'export CSV");
    } finally { setDownloading(null); }
  };

  return <div className={`mx-auto max-w-[1100px] space-y-6 ${styles.root}`}><header><h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Rapports & Statistiques</h1><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Suivez les admissions et téléchargez des exports CSV compatibles avec Excel et LibreOffice.</p></header><div className="grid gap-4 lg:grid-cols-2"><ChartCard title="Pipeline d’admission"><PipelineFunnel /></ChartCard><ChartCard title="Décisions finales"><OutcomesChart /></ChartCard><ChartCard title="Candidatures par mois"><TrendLine /></ChartCard><ChartCard title="Candidatures par offre"><MagnitudeBarChart endpoint="/schools/me/reports/by-offer" label="Offre" empty="Aucune candidature par offre pour le moment." /></ChartCard><ChartCard title="Étudiants par classe"><MagnitudeBarChart endpoint="/schools/me/reports/by-class" label="Classe" empty="Aucun étudiant inscrit pour le moment." /></ChartCard></div><div className="grid gap-4 md:grid-cols-2"><ReportCard icon={FileSpreadsheetIcon} title="Exporter les candidatures" description="Candidats, offre, statut et date de soumission." loading={downloading === 'applications'} onDownload={() => void download('applications')} /><ReportCard icon={UsersRoundIcon} title="Exporter les étudiants inscrits" description="Étudiants actuellement inscrits dans votre établissement." loading={downloading === 'students'} onDownload={() => void download('students')} /></div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Les tableaux par offre et par classe restent disponibles sous les graphiques. Les exports sont limités aux données de votre établissement.</p></div>;
}

function ReportCard({ icon: Icon, title, description, loading, onDownload }: { icon: typeof FileSpreadsheetIcon; title: string; description: string; loading: boolean; onDownload: () => void }) { return <Card><CardContent className="p-6"><span className="grid size-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="size-6" /></span><h2 className="mt-4 font-extrabold text-[#17204e]">{title}</h2><p className="mt-2 min-h-10 text-sm text-slate-500">{description}</p><Button className="mt-5 w-full" onClick={onDownload} disabled={loading}>{loading ? 'Préparation...' : <><DownloadIcon /> Télécharger le CSV</>}</Button></CardContent></Card>; }

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card className={styles.chartCard}><CardContent className="p-6"><h2 className="mb-5 font-extrabold">{title}</h2>{children}</CardContent></Card>; }
