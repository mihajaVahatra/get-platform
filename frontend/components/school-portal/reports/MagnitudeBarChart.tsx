'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import styles from './reports.module.css';

type Item = { label: string; count: number };
export function MagnitudeBarChart({ endpoint, label, empty }: { endpoint: string; label: string; empty: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void apiClient.get(endpoint).then((response) => setItems((response.data.data || []).map((item: { enrolledYear?: string; title?: string; count: number }) => ({ label: item.enrolledYear || item.title || 'Non renseigné', count: item.count })))).catch(() => setFailed(true)); }, [endpoint]);
  if (failed) return <p className={styles.empty}>Ce graphique est indisponible pour le moment.</p>;
  if (!items) return <p className={styles.muted}>Chargement…</p>;
  if (items.length === 0) return <p className={styles.empty}>{empty}</p>;
  const max = Math.max(...items.map((item) => item.count), 1);
  return <><div className={styles.list} aria-label={label}>{items.map((item, index) => <div className={styles.barRow} key={item.label}><span>{item.label}</span><div className={styles.track}><div className={`${styles.bar} ${styles.seriesBar}`} style={{ width: `${Math.max((item.count / max) * 88, 3)}%` }} title={`${item.label} : ${item.count}`} />{index === 0 && <span className={styles.lastValue}>{item.count}</span>}</div></div>)}</div><table className={`${styles.table} mt-5`}><thead><tr><th>{label}</th><th>Nombre</th></tr></thead><tbody>{items.map((item) => <tr key={item.label}><td>{item.label}</td><td>{item.count}</td></tr>)}</tbody></table></>;
}
