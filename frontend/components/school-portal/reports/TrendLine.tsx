'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import styles from './reports.module.css';

type Point = { period: string; count: number };
const month = (value: string) => new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(new Date(value));

export function TrendLine() {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void apiClient.get('/schools/me/reports/trend?months=6').then((response) => setPoints(response.data.data || [])).catch(() => setFailed(true)); }, []);
  if (failed) return <p className={styles.empty}>La tendance est indisponible pour le moment.</p>;
  if (!points) return <p className={styles.muted}>Chargement de la tendance…</p>;
  if (points.length === 0) return <p className={styles.empty}>Aucune candidature enregistrée pour le moment.</p>;
  const max = Math.max(...points.map((point) => point.count), 1);
  const width = 480; const height = 190; const left = 28; const bottom = 28; const top = 14; const usableWidth = width - left - 14; const usableHeight = height - top - bottom;
  const coordinates = points.map((point, index) => ({ ...point, x: left + (points.length === 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth), y: top + usableHeight - (point.count / max) * usableHeight }));
  return <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution mensuelle des candidatures"><line className={styles.grid} x1={left} y1={top + usableHeight} x2={width - 14} y2={top + usableHeight} /><line className={styles.grid} x1={left} y1={top + usableHeight / 2} x2={width - 14} y2={top + usableHeight / 2} /><polyline className={styles.line} points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')} />{coordinates.map((point) => <g key={point.period}><circle className={styles.point} cx={point.x} cy={point.y} r="4"><title>{`${month(point.period)} : ${point.count} candidature(s)`}</title></circle><text className={styles.axis} x={point.x} y={height - 7} textAnchor="middle">{month(point.period)}</text></g>)}</svg>;
}
