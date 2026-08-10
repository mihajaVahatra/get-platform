'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import styles from './reports.module.css';

type Item = { status: string; count: number };
// Traduction des statuts techniques du pipeline de candidature en libellés lisibles.
const labels: Record<string, string> = { PENDING: 'Reçues', PRESELECTED: 'Présélectionnées', TEST_SCHEDULED: 'Test planifié', TEST_COMPLETED: 'Test terminé', INTERVIEW_SCHEDULED: 'Entretien planifié', INTERVIEW_COMPLETED: 'Entretien terminé' };

/**
 * Entonnoir (funnel) affichant le nombre de candidatures à chaque étape du
 * processus d'admission (réception, présélection, test, entretien...).
 * Récupère les données via `GET /schools/me/reports/pipeline` au montage.
 */
export function PipelineFunnel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void apiClient.get('/schools/me/reports/pipeline').then((response) => setItems(response.data.data || [])).catch(() => setFailed(true)); }, []);
  if (failed) return <p className={styles.empty}>Le pipeline est indisponible pour le moment.</p>;
  if (!items) return <p className={styles.muted}>Chargement du pipeline…</p>;
  if (!items.some((item) => item.count > 0)) return <p className={styles.empty}>Aucune candidature enregistrée pour le moment.</p>;
  const max = Math.max(...items.map((item) => item.count), 1);
  return <div className={styles.list} aria-label="Pipeline des candidatures">{items.map((item, index) => <div className={styles.barRow} key={item.status}><span>{labels[item.status] || item.status}</span><div className={styles.track}><div className={styles.bar} style={{ width: `${Math.max((item.count / max) * 88, item.count ? 3 : 0)}%`, background: `var(--pipeline-${index + 1})` }} title={`${labels[item.status] || item.status} : ${item.count}`} />{index === items.length - 1 && <span className={styles.lastValue}>{item.count}</span>}</div></div>)}</div>;
}
