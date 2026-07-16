'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import toast from 'react-hot-toast';

type DashboardData = {
  totalApplications: number;
  totalStudents: number;
  totalSchools: number;
  totalOffers: number;
  acceptanceRate: number;
  genderDistribution: {
    male: number;
    female: number;
    other: number;
    unknown: number;
  };
  regionalDistribution: {
    region: string;
    count: number;
  }[];
  applicationsByFiliere: {
    filiere: string;
    count: number;
  }[];
  trends: {
    period: string;
    count: number;
  }[];
};

export default function MinistryDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/ministry/dashboard');
      setData(response.data.data);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('fr-FR');
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement du dashboard national...</div>;
  }

  if (!data) {
    return (
      <div className="flex justify-center p-8">
        <p className="text-gray-500">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard National</h1>
          <p className="text-gray-500 text-sm">
            Vue d'ensemble du système éducatif malgache
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/ministry/reports">
            <Button variant="outline">Rapports</Button>
          </Link>
          <Link href="/dashboard/ministry/compliance">
            <Button variant="outline">Conformité</Button>
          </Link>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-blue-600">{formatNumber(data.totalApplications)}</CardTitle>
            <CardDescription>Candidatures</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-green-600">{formatNumber(data.totalStudents)}</CardTitle>
            <CardDescription>Étudiants</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-purple-600">{formatNumber(data.totalSchools)}</CardTitle>
            <CardDescription>Écoles</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-orange-600">{formatNumber(data.totalOffers)}</CardTitle>
            <CardDescription>Offres de formation</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Taux d'acceptation + Répartition par genre */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Taux d'acceptation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{data.acceptanceRate}%</p>
            <p className="text-sm text-gray-500">
              Des candidatures ont été acceptées
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition par genre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>👨 Hommes</span>
                <span className="font-medium">{data.genderDistribution.male || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>👩 Femmes</span>
                <span className="font-medium">{data.genderDistribution.female || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>❓ Non renseigné</span>
                <span className="font-medium">{data.genderDistribution.unknown || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Répartition par région */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Répartition par région</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {data.regionalDistribution.slice(0, 8).map((item) => (
              <div key={item.region} className="flex justify-between border-b py-1">
                <span className="text-sm">{item.region || 'Non renseigné'}</span>
                <span className="font-medium text-sm">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top filières */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🏆 Top filières</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.applicationsByFiliere.slice(0, 5).map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <span>{item.filiere || 'Non renseigné'}</span>
                <div className="flex items-center gap-2">
                  <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${Math.min((item.count / data.totalApplications) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tendances (simplifié) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Évolution des candidatures</CardTitle>
        </CardHeader>
        <CardContent>
          {data.trends && data.trends.length > 0 ? (
            <div className="space-y-2">
              {data.trends.slice(0, 6).map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-sm">{item.period || 'Période'}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Aucune donnée disponible</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
