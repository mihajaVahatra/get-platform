'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageUpload } from '@/components/ImageUpload';
import { Bell, Search, ChevronRight, User, FileText, CreditCard, GraduationCap, Settings, LogOut } from 'lucide-react';
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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
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

  if (loading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="flex gap-6">
      {/* ===== SIDEBAR GAUCHE ===== */}
      <aside className="hidden md:block w-72 shrink-0">
        <div className="bg-gradient-to-b from-purple-700 to-purple-900 rounded-2xl p-6 text-white sticky top-6">
          {/* Avatar */}
          <div className="flex justify-center">
            <ImageUpload
              currentUrl={user?.avatarUrl}
              endpoint="/students/me/avatar"
              onUpload={(url) => setUser({ ...user, avatarUrl: url })}
              fallbackText={user && getInitials(user.firstName, user.lastName)}
              size="medium"
            />
          </div>
          <div className="text-center mt-2">
            <h2 className="text-xl font-bold">{user?.firstName} {user?.lastName}</h2>
            <p className="text-purple-200 text-sm">Étudiant</p>
            <Badge className="mt-2 bg-white/20 text-white border-0">
              {stats?.profileCompletion ? '✅ Profil complet' : '⚠️ Profil incomplet'}
            </Badge>
          </div>

          {/* Statistiques utilisateur */}
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-purple-200 text-sm">Candidatures</span>
              <span className="font-bold">{stats?.totalApplications || 0}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-purple-200 text-sm">Acceptées</span>
              <span className="font-bold text-green-300">{stats?.acceptedApplications || 0}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-purple-200 text-sm">En attente</span>
              <span className="font-bold text-yellow-300">{stats?.pendingApplications || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-purple-200 text-sm">Documents</span>
              <span className="font-bold">{stats?.documentsUploaded || 0}</span>
            </div>
          </div>

          {/* Menu de navigation rapide */}
          <div className="mt-6 pt-4 border-t border-white/10 space-y-1">
            <Link href="/dashboard/student/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
              <User className="h-4 w-4" />
              Mon profil
            </Link>
            <Link href="/dashboard/student/applications" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
              <FileText className="h-4 w-4" />
              Mes candidatures
            </Link>
            <Link href="/dashboard/student/offers" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
              <GraduationCap className="h-4 w-4" />
              Rechercher des offres
            </Link>
            <Link href="/dashboard/student/payments" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
              <CreditCard className="h-4 w-4" />
              Mes paiements
            </Link>
            <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
              <Settings className="h-4 w-4" />
              Paramètres
            </Link>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm w-full text-left text-red-300">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* ===== CONTENU PRINCIPAL ===== */}
      <div className="flex-1 space-y-6">
        {/* Header avec recherche et notifications */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Rechercher..." className="pl-10" />
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                3
              </span>
            </Button>
            <div className="flex items-center gap-3 md:hidden">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-500 text-white text-xs">
                  {user && getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {/* Section bienvenue */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-blue-200">Bienvenue,</p>
              <h1 className="text-2xl font-bold">{user?.firstName} {user?.lastName} !</h1>
              <p className="text-blue-200 mt-1">Tenez-vous informé de vos candidatures</p>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 hidden md:flex">
              {stats?.profileCompletion ? 'Profil complet ✅' : 'Profil incomplet ⚠️'}
            </Badge>
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
    </div>
  );
}
