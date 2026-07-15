'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Définition du type d'une candidature
type Application = {
  id: string;
  status: string;
  submittedAt: string;
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
  timeline?: {
    id: string;
    status: string;
    note: string;
    createdAt: string;
  }[];
};

export default function StudentApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/applications/me');
      setApplications(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement candidatures:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les candidatures par statut
  const filteredApplications = filter === 'ALL' 
    ? applications 
    : applications.filter(app => app.status === filter);

  // Fonction pour obtenir la couleur du badge selon le statut
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
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
    return colors[status] || 'bg-gray-300';
  };

  // Fonction pour traduire le statut en français
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      PRESELECTED: 'Présélectionné',
      TEST_SCHEDULED: 'Test planifié',
      TEST_COMPLETED: 'Test complété',
      INTERVIEW_SCHEDULED: 'Entretien planifié',
      INTERVIEW_COMPLETED: 'Entretien complété',
      ACCEPTED: 'Acceptée ✅',
      REJECTED: 'Refusée ❌',
      WAITLISTED: 'Liste d\'attente',
      ENROLLED: 'Inscrit',
      CANCELLED: 'Annulée',
    };
    return labels[status] || status;
  };

  // Formater la date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement des candidatures...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes candidatures</h1>
          <p className="text-gray-500 text-sm">
            {applications.length} candidature(s) au total
          </p>
        </div>
        {/* Filtre */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Filtrer :</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="ALL">Tous</option>
            <option value="PENDING">En attente</option>
            <option value="ACCEPTED">Acceptées</option>
            <option value="REJECTED">Refusées</option>
            <option value="INTERVIEW_SCHEDULED">Entretiens</option>
            <option value="TEST_SCHEDULED">Tests</option>
          </select>
        </div>
      </div>

      {/* Liste des candidatures */}
      {filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">
              {applications.length === 0 
                ? 'Vous n\'avez pas encore soumis de candidature.' 
                : 'Aucune candidature ne correspond à ce filtre.'}
            </p>
            <Button className="mt-4" variant="outline">
              Rechercher des offres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredApplications.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {app.offer.title}
                    </CardTitle>
                    <CardDescription>
                      {app.offer.school.name} • {app.offer.school.city}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(app.status)} text-white`}>
                      {getStatusLabel(app.status)}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {formatDate(app.submittedAt)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    Diplôme : <span className="font-medium">{app.offer.diploma}</span>
                  </span>
                  <Button variant="link" className="p-0 h-auto text-blue-600">
                    Voir les détails
                  </Button>
                </div>
                {/* Afficher la timeline si disponible */}
                {app.timeline && app.timeline.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      Dernière activité : {
                        app.timeline[app.timeline.length - 1]?.note 
                        || 'Aucune activité'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
