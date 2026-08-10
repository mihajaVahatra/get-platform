'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import styles from './reports.module.css';

type Outcomes = { accepted: number; rejected: number; waitlisted: number };
// Configuration statique des trois catégories de décisions finales (ordre d'affichage, couleur, icône).
const rows = [
  { key: 'accepted' as const, label: 'Acceptées', color: 'var(--outcome-accepted)', Icon: CheckCircle2 },
  { key: 'rejected' as const, label: 'Refusées', color: 'var(--outcome-rejected)', Icon: XCircle },
  { key: 'waitlisted' as const, label: 'Liste d’attente', color: 'var(--outcome-waitlisted)', Icon: Clock3 },
];

/**
 * Graphique en barres résumant les décisions finales prises sur les
 * candidatures de l'établissement (acceptées / refusées / liste d'attente).
 * Récupère les compteurs via `GET /schools/me/reports/outcomes` au montage.
 */
export function OutcomesChart() {
  const [data, setData] = useState<Outcomes | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void apiClient.get('/schools/me/reports/outcomes').then((response) => setData(response.data.data)).catch(() => setFailed(true)); }, []);
  if (failed) return <p className={styles.empty}>Les décisions finales sont indisponibles pour le moment.</p>;
  if (!data) return <p className={styles.muted}>Chargement des décisions…</p>;
  if (rows.every((row) => data[row.key] === 0)) return <p className={styles.empty}>Aucune décision finale enregistrée pour le moment.</p>;
  const max = Math.max(...rows.map((row) => data[row.key]), 1);
  return <div className={styles.list} aria-label="Décisions finales">{rows.map(({ key, label, color, Icon }) => <div className={styles.barRow} key={key}><span className={styles.outcomeLabel}><Icon size={17} aria-hidden="true" />{label}</span><div className={styles.track}><div className={styles.bar} style={{ width: `${Math.max((data[key] / max) * 88, data[key] ? 3 : 0)}%`, background: color }} title={`${label} : ${data[key]}`} /></div></div>)}</div>;
}
