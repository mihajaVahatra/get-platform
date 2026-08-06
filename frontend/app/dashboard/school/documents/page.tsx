'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { DownloadIcon, FileTextIcon, SearchIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type DocumentItem = {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  uploadedAt: string;
  student: { firstName: string; lastName: string; enrolledYear: string | null };
};
const TYPES: Record<string, string> = {
  CV: 'CV',
  LETTER: 'Lettre',
  ID: 'Pièce d’identité',
  DIPLOMA: 'Diplôme',
  PHOTO: 'Photo',
  OTHER: 'Autre',
};
const PAGE_SIZE = 20;

export default function SchoolDocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500">
          Chargement des documents...
        </div>
      }
    >
      <SchoolDocumentsContent />
    </Suspense>
  );
}

function SchoolDocumentsContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrolledYear = searchParams.get('enrolledYear') || 'ALL';
  const type = searchParams.get('type') || 'ALL';
  const querySearch = searchParams.get('search') || '';
  const [classes, setClasses] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchInput, setSearchInput] = useState(querySearch);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const updateUrl = useCallback(
    (nextType: string, nextClass: string, nextSearch: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextType === 'ALL') params.delete('type');
      else params.set('type', nextType);
      if (nextClass === 'ALL') params.delete('enrolledYear');
      else params.set('enrolledYear', nextClass);
      if (!nextSearch.trim()) params.delete('search');
      else params.set('search', nextSearch.trim());
      setPage(1);
      setLoading(true);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiClient.get('/schools/me/students/classes');
        if (!cancelled) setClasses(response.data.data || []);
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement classes:', error);
          toast.error('Impossible de charger les classes');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== querySearch)
        updateUrl(type, enrolledYear, searchInput);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [enrolledYear, querySearch, searchInput, type, updateUrl]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (enrolledYear !== 'ALL') params.set('enrolledYear', enrolledYear);
        if (type !== 'ALL') params.set('type', type);
        if (querySearch) params.set('search', querySearch);
        const response = await apiClient.get(
          `/schools/me/documents?${params.toString()}`,
        );
        if (cancelled) return;
        setDocuments(response.data.data || []);
        setTotal(response.data.meta?.total || 0);
        setTotalPages(response.data.meta?.totalPages || 1);
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement documents:', error);
          toast.error('Impossible de charger les documents');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrolledYear, page, querySearch, type]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  const goToPage = (nextPage: number) => {
    setLoading(true);
    setPage(nextPage);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Documents des étudiants inscrits
        </h1>
        <p className="mt-1 text-sm text-indigo-600">
          Recherchez un document par classe, type ou nom d’étudiant.
        </p>
      </header>
      <Card>
        <CardContent className="p-5">
          <div className="mb-6 grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <label className="relative">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher un étudiant..."
                className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <Select
              items={[
                { value: 'ALL', label: 'Toutes les classes' },
                ...classes.map((item) => ({ value: item, label: item })),
              ]}
              value={enrolledYear}
              onValueChange={(value) =>
                updateUrl(type, value ?? 'ALL', querySearch)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {classes.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={[
                { value: 'ALL', label: 'Tous les types' },
                ...Object.entries(TYPES).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              value={type}
              onValueChange={(value) =>
                updateUrl(value ?? 'ALL', enrolledYear, querySearch)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Type de document" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types</SelectItem>
                {Object.entries(TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Chargement des documents...
            </p>
          ) : documents.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Aucun document ne correspond aux filtres sélectionnés.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileTextIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {document.student.firstName} {document.student.lastName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {document.name} · {TYPES[document.type] || document.type}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {document.student.enrolledYear || 'Classe non renseignée'}{' '}
                      · Déposé le {formatDate(document.uploadedAt)}
                    </p>
                  </div>
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Télécharger ${document.name}`}
                    className="grid size-10 shrink-0 place-items-center rounded-lg text-indigo-600 hover:bg-indigo-50"
                  >
                    <DownloadIcon className="size-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
          {!loading && totalPages > 1 && (
            <Pagination className="mt-5">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={
                      page <= 1 ? 'pointer-events-none opacity-50' : ''
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) goToPage(page - 1);
                    }}
                  />
                </PaginationItem>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((number) => (
                  <PaginationItem key={number}>
                    <PaginationLink
                      href="#"
                      isActive={number === page}
                      onClick={(event) => {
                        event.preventDefault();
                        goToPage(number);
                      }}
                    >
                      {number}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={
                      page >= totalPages ? 'pointer-events-none opacity-50' : ''
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < totalPages) goToPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
          <p className="mt-5 text-xs text-slate-500">
            {total} document(s) trouvé(s). Les résultats sont paginés côté
            serveur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
