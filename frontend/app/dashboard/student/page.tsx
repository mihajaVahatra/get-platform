'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Search, ChevronRight, User, FileText, CreditCard, GraduationCap, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

type StudentStats = {
  totalApplications: number;
  pendingApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
  documentsUploaded: number;
  profileCompletion: boolean;
};

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
};

export default function StudentDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchStats();
    fetchRecentApplications();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/students/me');
      setUser(response.data.data);
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/students/me/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  };

  const fetchRecentApplications = async () => {
    try {
      const response = await apiClient.get('/applications/me?limit=3');
      setRecentApplications(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement candidatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-500',
      ACCEPTED: 'bg-green-500',
      REJECTED: 'bg-red-500',
      INTERVIEW_SCHEDULED: 'bg-blue-400',
      TEST_SCHEDULED: 'bg-purple-400',
      ENROLLED: 'bg-emerald-600',
    };
    return colors[status] || 'bg-gray-300';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      ACCEPTED: '✅ Acceptée',
      REJECTED: '❌ Refusée',
      INTERVIEW_SCHEDULED: 'Entretien planifié',
      TEST_SCHEDULED: 'Test planifié',
      ENROLLED: 'Inscrit',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) return <div className="flex justify-center p-8">Chargement...</div>;

  const isProfileComplete = stats?.profileCompletion === true;

  return (
    <div className="space-y-6">
      {/* En-tête avec recherche et notifications */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Rechercher..." className="pl-10" />
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">3</span>
          </Button>
        </div>
      </div>

      {/* Bannière de bienvenue avec indicateur de profil */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-blue-200">Bienvenue,</p>
            <h1 className="text-2xl font-bold">{user?.firstName} {user?.lastName} !</h1>
            <p className="text-blue-200 mt-1">Tenez-vous informé de vos candidatures</p>
          </div>
          
          {/* Badge profil stylé en haut à droite */}
          {!isProfileComplete && (
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20 text-sm font-medium shadow-lg">
              <AlertCircle className="h-4 w-4 text-yellow-300" />
              <span className="text-white/90 text-xs">Profil incomplet</span>
            </div>
          )}
          {isProfileComplete && (
            <div className="flex items-center gap-1.5 bg-green-500/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-green-400/30 text-sm font-medium shadow-lg">
              <span className="text-green-300 text-xs">✅ Profil complet</span>
            </div>
          )}
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-blue-600">📊 Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalApplications || 0}</p>
            <p className="text-sm text-gray-500">Candidatures</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard/student/applications?status=ACCEPTED'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-green-600">✅ Acceptées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats?.acceptedApplications || 0}</p>
            <p className="text-sm text-gray-500">Candidatures acceptées</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard/student/applications?status=PENDING'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-yellow-600">⏳ En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{stats?.pendingApplications || 0}</p>
            <p className="text-sm text-gray-500">Candidatures en cours</p>
          </CardContent>
        </Card>
      </div>

      {/* Dernières candidatures */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">📋 Dernières candidatures</h2>
          <Link href="/dashboard/student/applications" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            Voir tout <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentApplications.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="p-6 text-center text-gray-500">
                Aucune candidature récente
              </CardContent>
            </Card>
          ) : (
            recentApplications.map((app) => (
              <Card key={app.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{app.offer.title}</p>
                      <p className="text-sm text-gray-500">{app.offer.school.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(app.submittedAt)}</p>
                    </div>
                    <Badge className={`${getStatusColor(app.status)} text-white`}>
                      {getStatusLabel(app.status)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Actions rapides */}
      <div>
        <h2 className="text-lg font-semibold mb-4">⚡ Actions rapides</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/dashboard/student/offers">
            <Card className="hover:shadow-lg transition-shadow hover:border-blue-300 cursor-pointer">
              <CardContent className="p-4 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="font-medium text-sm">Rechercher</p>
                <p className="text-xs text-gray-500">des offres</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/student/profile">
            <Card className="hover:shadow-lg transition-shadow hover:border-blue-300 cursor-pointer">
              <CardContent className="p-4 text-center">
                <p className="text-3xl mb-2">👤</p>
                <p className="font-medium text-sm">Mon profil</p>
                <p className="text-xs text-gray-500">mes informations</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/student/payments">
            <Card className="hover:shadow-lg transition-shadow hover:border-blue-300 cursor-pointer">
              <CardContent className="p-4 text-center">
                <p className="text-3xl mb-2">💳</p>
                <p className="font-medium text-sm">Paiements</p>
                <p className="text-xs text-gray-500">historique</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/student/applications">
            <Card className="hover:shadow-lg transition-shadow hover:border-blue-300 cursor-pointer">
              <CardContent className="p-4 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="font-medium text-sm">Candidatures</p>
                <p className="text-xs text-gray-500">suivi</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
