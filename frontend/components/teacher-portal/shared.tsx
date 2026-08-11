'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, ChevronLeft, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { StudentIdentity } from '@/components/teacher-portal/student-identity';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { NotificationBell } from '@/components/notifications/notification-bell';
import type { CourseEnrollment } from './types';

/** Taille de page utilisée par toutes les listes paginées du portail professeur (étudiants, notes, ressources...). */
export const LIST_PAGE_SIZE = 25;

/**
 * Composant de pagination générique pour les listes du portail professeur.
 * Ne s'affiche que si `totalItems` dépasse `LIST_PAGE_SIZE` (une seule page
 * ne nécessite pas de contrôle de pagination). `page` est borné à
 * `totalPages` pour éviter un état incohérent si la page courante devient
 * invalide après un changement de filtre.
 */
export function ListPagination({
  page,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / LIST_PAGE_SIZE);
  const currentPage = Math.min(page, totalPages);

  if (totalItems <= LIST_PAGE_SIZE) return null;

  return (
    <Pagination className="mt-5">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            className={
              currentPage === 1 ? 'pointer-events-none opacity-50' : ''
            }
            onClick={(event) => {
              event.preventDefault();
              if (currentPage > 1) onPageChange(currentPage - 1);
            }}
          />
        </PaginationItem>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                isActive={currentPage === pageNumber}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(pageNumber);
                }}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            className={
              currentPage === totalPages ? 'pointer-events-none opacity-50' : ''
            }
            onClick={(event) => {
              event.preventDefault();
              if (currentPage < totalPages) onPageChange(currentPage + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/**
 * Liste paginée des étudiants inscrits à un cours donné
 * (`GET /teacher/courses/:id/students`, paginé côté serveur avec
 * `LIST_PAGE_SIZE`). Utilisée à la fois par l'onglet "Étudiants" d'un cours
 * et par la vue globale "Étudiants" une fois un cours sélectionné.
 */
export function CourseStudentList({ courseId }: { courseId: string }) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get(
        `/teacher/courses/${courseId}/students`,
        { params: { page, limit: LIST_PAGE_SIZE } },
      );
      setEnrollments(response.data.data.items || []);
      setTotalItems(response.data.data.meta?.total || 0);
    } catch (error) {
      console.error('Erreur chargement étudiants cours:', error);
      setFailed(true);
      toast.error('Impossible de charger les étudiants de ce cours');
    } finally {
      setLoading(false);
    }
  }, [courseId, page]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchStudents();
    });
    return () => {
      active = false;
    };
  }, [fetchStudents]);

  if (loading || failed || totalItems === 0)
    return (
      <AsyncState
        status={loading ? 'loading' : failed ? 'error' : 'empty'}
        loadingMessage="Chargement des étudiants…"
        errorMessage="Les étudiants de ce cours n’ont pas pu être chargés."
        emptyMessage="Aucun étudiant n’est inscrit à ce cours."
        onRetry={() => void fetchStudents()}
      />
    );

  return (
    <Card title={`Étudiants inscrits (${totalItems})`}>
      <div className="space-y-2">
        {enrollments.map(({ id, student }) => (
          <div
            key={id}
            className="flex items-center gap-3 rounded-xl border border-slate-50 p-2.5"
          >
            <StudentIdentity
              firstName={student.firstName}
              lastName={student.lastName}
              email={student.user.email}
            />
          </div>
        ))}
      </div>
      <ListPagination
        page={page}
        totalItems={totalItems}
        onPageChange={setPage}
      />
    </Card>
  );
}

export type AsyncStateStyle = 'card' | 'inline';

export function AsyncState({
  status,
  loadingMessage,
  errorMessage,
  emptyMessage,
  onRetry,
  retryLabel = 'Réessayer',
  variant = 'card',
  emptyVariant,
  bordered = true,
  textSize,
}: {
  status: 'loading' | 'error' | 'empty';
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: AsyncStateStyle;
  emptyVariant?: AsyncStateStyle;
  bordered?: boolean;
  textSize?: 'xs' | 'sm';
}) {
  const sizeClass = (forVariant: AsyncStateStyle) =>
    (textSize ?? (forVariant === 'card' ? 'sm' : 'xs')) === 'sm'
      ? 'text-sm'
      : 'text-xs';
  const textSizeClass = sizeClass(variant);

  if (status === 'loading') {
    if (variant === 'inline')
      return <p className={`${textSizeClass} text-muted-foreground`}>{loadingMessage}</p>;
    return (
      <p
        className={[
          'rounded-xl',
          bordered ? 'border border-border' : '',
          'bg-card p-5',
          textSizeClass,
          'text-muted-foreground shadow-sm',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {loadingMessage}
      </p>
    );
  }

  if (status === 'error') {
    if (variant === 'inline') {
      if (!errorMessage)
        return (
          <button
            type="button"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-300"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        );
      return (
        <div>
          <p className={`${textSizeClass} text-rose-700 dark:text-rose-300`}>{errorMessage}</p>
          {onRetry && (
            <button
              type="button"
              className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-300"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          )}
        </div>
      );
    }
    return (
      <div
        className={[
          'rounded-xl',
          bordered ? 'border border-rose-100' : '',
          'bg-rose-50 dark:bg-rose-500/15 p-5',
          textSizeClass,
          'text-rose-700 dark:text-rose-300',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p>{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-300"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  const resolvedEmptyVariant = emptyVariant ?? variant;
  const emptyTextSizeClass = sizeClass(resolvedEmptyVariant);
  if (resolvedEmptyVariant === 'inline') {
    if (bordered === false)
      return (
        <p className={`${emptyTextSizeClass} text-muted-foreground`}>{emptyMessage}</p>
      );
    return (
      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  return (
    <p
      className={[
        'rounded-xl',
        bordered ? 'border border-border' : '',
        'bg-card p-5',
        emptyTextSizeClass,
        'text-muted-foreground shadow-sm',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {emptyMessage}
    </p>
  );
}

export function Page({
  title,
  subtitle,
  children,
  action,
  back,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: string;
  back?: string;
}) {
  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {back && (
            <Link
              href={back}
              className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-300"
            >
              <ChevronLeft className="size-4" /> Retour
            </Link>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            {title}
          </h1>
          <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground sm:flex">
            <CalendarDays className="size-4 text-indigo-600 dark:text-indigo-300" />
            Année académique 2024 · 2025
          </button>
          <NotificationBell />
          {action && (
            <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">
              <Plus className="size-4" />
              {action}
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
export function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-[#17204e]">{title}</h2>
        {action && (
          <button className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
            {action}
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
export function List({ items, icon: Icon }: { items: string[]; icon: LucideIcon }) {
  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div className="flex gap-3 py-3" key={item}>
          <span className="grid size-7 place-items-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            <Icon className="size-3.5" />
          </span>
          <p className="flex-1 text-xs font-semibold text-[#34406b]">{item}</p>
          <span className="text-[9px] text-muted-foreground">Il y a 2h</span>
        </div>
      ))}
    </div>
  );
}
export function Info({ rows }: { rows: string[][] }) {
  return (
    <dl className="space-y-3 text-xs">
      {rows.map(([label, value]) => (
        <div className="grid grid-cols-[140px_1fr] gap-3" key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-line font-semibold text-[#34406b]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-indigo-50 dark:bg-indigo-500/15 p-3">
      <b className="text-lg text-indigo-700 dark:text-indigo-300">{value}</b>
      <span className="mt-1 block text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const done =
    value === 'Corrigé' || value === 'En cours' || value === 'En cours';
  return (
    <span
      className={`whitespace-nowrap rounded px-2 py-1 text-[9px] font-bold ${done ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'}`}
    >
      {value}
    </span>
  );
}
