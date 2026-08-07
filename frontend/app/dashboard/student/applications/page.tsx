'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  FileTextIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Application = {
  id: string;
  status: string;
  submittedAt: string;
  score?: number;
  decisionReason?: string;
  interviewDate?: string;
  interviewLink?: string;
  offer: {
    id: string;
    title: string;
    diploma: string;
    school: {
      id: string;
      name: string;
      city: string;
    };
  };
  timeline: {
    id: string;
    status: string;
    note: string;
    createdAt: string;
  }[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PRESELECTED: 'Présélectionné',
  TEST_SCHEDULED: 'Test planifié',
  TEST_COMPLETED: 'Test complété',
  INTERVIEW_SCHEDULED: 'Entretien planifié',
  INTERVIEW_COMPLETED: 'Entretien complété',
  ACCEPTED: '✅ Acceptée',
  REJECTED: '❌ Refusée',
  WAITLISTED: "Liste d'attente",
  ENROLLED: 'Inscrit',
  CANCELLED: 'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  PRESELECTED: 'bg-blue-400',
  TEST_SCHEDULED: 'bg-purple-400',
  TEST_COMPLETED: 'bg-indigo-400',
  INTERVIEW_SCHEDULED: 'bg-orange-400',
  INTERVIEW_COMPLETED: 'bg-amber-400',
  ACCEPTED: 'bg-green-500',
  REJECTED: 'bg-red-500',
  WAITLISTED: 'bg-gray-400',
  ENROLLED: 'bg-emerald-600',
  CANCELLED: 'bg-rose-400',
};

export default function StudentApplicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          Chargement des candidatures...
        </div>
      }
    >
      <StudentApplicationsContent />
    </Suspense>
  );
}

function StudentApplicationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'ALL';

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, page]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.append('page', String(page));
      params.append('limit', '10');

      const response = await apiClient.get(
        `/applications/me?${params.toString()}`,
      );
      setApplications(response.data.data || []);
      setTotalItems(response.data.meta?.total || 0);
      setTotalPages(response.data.meta?.totalPages || 1);
    } catch (error) {
      console.error('Erreur chargement candidatures:', error);
      toast.error('Erreur lors du chargement des candidatures');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'REJECTED':
        return <XCircleIcon className="h-4 w-4" />;
      case 'PENDING':
        return <ClockIcon className="h-4 w-4" />;
      default:
        return <AlertCircleIcon className="h-4 w-4" />;
    }
  };

  const getStatusTimeline = (status: string) => {
    return STATUS_LABELS[status] || status;
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        Chargement des candidatures...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📋 Mes candidatures</h1>
          <p className="text-gray-500 text-sm">
            {totalItems} candidature(s) au total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Filtrer :</span>
          <Select
            items={[
              { value: 'ALL', label: 'Tous' },
              { value: 'PENDING', label: 'En attente' },
              { value: 'ACCEPTED', label: '✅ Acceptées' },
              { value: 'REJECTED', label: '❌ Refusées' },
              { value: 'INTERVIEW_SCHEDULED', label: 'Entretiens planifiés' },
              { value: 'TEST_SCHEDULED', label: 'Tests planifiés' },
            ]}
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value ?? 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="PENDING">En attente</SelectItem>
              <SelectItem value="ACCEPTED">✅ Acceptées</SelectItem>
              <SelectItem value="REJECTED">❌ Refusées</SelectItem>
              <SelectItem value="INTERVIEW_SCHEDULED">
                Entretiens planifiés
              </SelectItem>
              <SelectItem value="TEST_SCHEDULED">Tests planifiés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Liste des candidatures */}
      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {statusFilter !== 'ALL'
                ? 'Aucune candidature ne correspond à ce filtre.'
                : "Vous n'avez pas encore soumis de candidature."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card
              key={app.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedApp(app);
                setIsDialogOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{app.offer.title}</p>
                      <Badge
                        className={`${STATUS_COLORS[app.status] || 'bg-gray-300'} text-white shrink-0`}
                      >
                        {getStatusIcon(app.status)}{' '}
                        {STATUS_LABELS[app.status] || app.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {app.offer.school.name} • {app.offer.school.city}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />{' '}
                        {formatDate(app.submittedAt)}
                      </span>
                      {app.score !== undefined && app.score !== null && (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-300 font-medium">
                          ⭐ {app.score}/100
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {app.status === 'ACCEPTED' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/dashboard/student/payments?applicationId=${app.id}`,
                          );
                        }}
                      >
                        Payer
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      Voir détails →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(p);
                  }}
                  isActive={p === page}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
                className={
                  page >= totalPages ? 'pointer-events-none opacity-50' : ''
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Modale de détails */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la candidature</DialogTitle>
            <DialogDescription>
              {selectedApp?.offer.title} • {selectedApp?.offer.school.name}
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-gray-500">Statut</p>
                  <Badge
                    className={`${STATUS_COLORS[selectedApp.status] || 'bg-gray-300'} text-white`}
                  >
                    {STATUS_LABELS[selectedApp.status] || selectedApp.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500">Date de soumission</p>
                  <p className="font-medium">
                    {formatDate(selectedApp.submittedAt)}
                  </p>
                </div>
                {selectedApp.score !== undefined &&
                  selectedApp.score !== null && (
                    <div>
                      <p className="text-gray-500">Score</p>
                      <p className="font-medium text-blue-600 dark:text-blue-300">
                        {selectedApp.score}/100
                      </p>
                    </div>
                  )}
                {selectedApp.decisionReason && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Motif de la décision</p>
                    <p className="text-sm text-gray-700">
                      {selectedApp.decisionReason}
                    </p>
                  </div>
                )}
                {selectedApp.interviewDate && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Entretien</p>
                    <p className="text-sm">
                      {formatDate(selectedApp.interviewDate)}
                    </p>
                    {selectedApp.interviewLink && (
                      <a
                        href={selectedApp.interviewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-300 hover:underline text-sm"
                      >
                        🔗 Lien de l'entretien
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div>
                <p className="font-medium text-sm mb-2">📜 Historique</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedApp.timeline?.map((event, index) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 text-sm border-l-2 border-gray-200 pl-3 pb-2"
                    >
                      <div className="min-w-[100px] text-xs text-gray-400">
                        {formatDate(event.createdAt)}
                      </div>
                      <div>
                        <span
                          className={`font-medium ${STATUS_COLORS[event.status]?.replace('bg-', 'text-') || 'text-gray-600'}`}
                        >
                          {getStatusTimeline(event.status)}
                        </span>
                        {event.note && (
                          <p className="text-gray-500 text-xs">{event.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Fermer
                </Button>
                {selectedApp.status === 'ACCEPTED' && (
                  <Button
                    onClick={() =>
                      router.push(
                        `/dashboard/student/payments?applicationId=${selectedApp.id}`,
                      )
                    }
                  >
                    Payer les frais de scolarité
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
