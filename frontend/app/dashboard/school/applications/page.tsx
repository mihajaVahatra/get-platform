'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileTextIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

type Application = {
  id: string;
  status: string;
  submittedAt: string;
  offer: {
    id: string;
    title: string;
  };
  student: {
    firstName: string;
    lastName: string;
    user: {
      email: string;
    };
  };
};

type Offer = {
  id: string;
  title: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PRESELECTED: 'Présélectionné',
  TEST_SCHEDULED: 'Test planifié',
  TEST_COMPLETED: 'Test complété',
  INTERVIEW_SCHEDULED: 'Entretien planifié',
  INTERVIEW_COMPLETED: 'Entretien complété',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  WAITLISTED: "Liste d'attente",
  ENROLLED: 'Inscrit',
  CANCELLED: 'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  PRESELECTED: 'bg-blue-500',
  TEST_SCHEDULED: 'bg-purple-500',
  TEST_COMPLETED: 'bg-indigo-500',
  INTERVIEW_SCHEDULED: 'bg-orange-500',
  INTERVIEW_COMPLETED: 'bg-amber-500',
  ACCEPTED: 'bg-green-500',
  REJECTED: 'bg-red-500',
  WAITLISTED: 'bg-gray-500',
  ENROLLED: 'bg-emerald-600',
  CANCELLED: 'bg-rose-500',
};

const PAGE_SIZE = 10;

export default function SchoolApplicationsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8">Chargement des candidatures...</div>}>
      <SchoolApplicationsContent />
    </Suspense>
  );
}

function SchoolApplicationsContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams.get('offerId') || 'ALL';
  const status = searchParams.get('status') || 'ALL';
  const [applications, setApplications] = useState<Application[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const loadOffers = async () => {
      try {
        const response = await apiClient.get('/offers/mine');
        if (!cancelled) setOffers(response.data.data || []);
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement offres:', error);
          toast.error('Impossible de charger les offres');
        }
      }
    };

    void loadOffers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadApplications = async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (offerId !== 'ALL') params.set('offerId', offerId);
        if (status !== 'ALL') params.set('status', status);

        const response = await apiClient.get(`/applications/school/me?${params.toString()}`);
        if (cancelled) return;

        setApplications(response.data.data || []);
        setTotalItems(response.data.meta?.total || 0);
        setTotalPages(response.data.meta?.totalPages || 1);
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement candidatures:', error);
          toast.error('Erreur lors du chargement des candidatures');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadApplications();
    return () => {
      cancelled = true;
    };
  }, [offerId, page, status]);

  const updateFilters = (nextStatus: string, nextOfferId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStatus === 'ALL') params.delete('status');
    else params.set('status', nextStatus);
    if (nextOfferId === 'ALL') params.delete('offerId');
    else params.set('offerId', nextOfferId);

    setPage(1);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  if (loading) {
    return <div className="flex justify-center p-8">Chargement des candidatures...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">📋 Candidatures reçues</h1>
          <p className="text-sm text-gray-500">{totalItems} candidature(s) au total</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Select value={offerId} onValueChange={(value) => updateFilters(status, value ?? 'ALL')}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Toutes les offres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les offres</SelectItem>
              {offers.map((offer) => (
                <SelectItem key={offer.id} value={offer.id}>{offer.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => updateFilters(value ?? 'ALL', offerId)}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              <SelectItem value="PENDING">En attente</SelectItem>
              <SelectItem value="PRESELECTED">Présélectionnées</SelectItem>
              <SelectItem value="TEST_SCHEDULED">Tests planifiés</SelectItem>
              <SelectItem value="INTERVIEW_SCHEDULED">Entretiens planifiés</SelectItem>
              <SelectItem value="ACCEPTED">Acceptées</SelectItem>
              <SelectItem value="REJECTED">Refusées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileTextIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">Aucune candidature ne correspond à ces filtres.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Étudiant</th>
                  <th className="px-5 py-3 font-medium">Offre</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Soumise le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((application) => (
                  <tr
                    key={application.id}
                    className="cursor-pointer transition-colors hover:bg-violet-50 focus-visible:bg-violet-50"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/school/applications/${application.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/dashboard/school/applications/${application.id}`);
                      }
                    }}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {application.student.firstName} {application.student.lastName}
                      </p>
                      <p className="text-slate-500">{application.student.user.email}</p>
                    </td>
                    <td className="px-5 py-4 font-medium text-violet-700">{application.offer.title}</td>
                    <td className="px-5 py-4">
                      <Badge className={`${STATUS_COLORS[application.status] || 'bg-gray-500'} text-white`}>
                        {STATUS_LABELS[application.status] || application.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(application.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  href="#"
                  isActive={page === pageNumber}
                  onClick={(event) => {
                    event.preventDefault();
                    setPage(pageNumber);
                  }}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
