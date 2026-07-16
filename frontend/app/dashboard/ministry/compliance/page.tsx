'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

type ComplianceCheck = {
  id: string;
  status: string;
  score?: number;
  remarks?: string;
  checkedAt: string;
  school: {
    id: string;
    name: string;
    city: string;
    region: string;
  };
};

export default function CompliancePage() {
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompliance();
  }, []);

  const fetchCompliance = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/ministry/compliance');
      setChecks(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement conformité:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PASSED: 'bg-green-500',
      FAILED: 'bg-red-500',
      PENDING: 'bg-yellow-500',
    };
    return colors[status] || 'bg-gray-300';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PASSED: '✅ Conforme',
      FAILED: '❌ Non conforme',
      PENDING: '⏳ En attente',
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suivi de la conformité</h1>
        <span className="text-sm text-gray-500">
          {checks.length} contrôle(s)
        </span>
      </div>

      {checks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Aucun contrôle de conformité enregistré.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {checks.map((check) => (
            <Card key={check.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{check.school.name}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {check.school.city} • {check.school.region}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(check.status)} text-white`}>
                    {getStatusLabel(check.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {check.score && (
                    <span className="text-gray-500">
                      Score : <span className="font-medium">{check.score}/100</span>
                    </span>
                  )}
                  <span className="text-gray-500">
                    Contrôlé le : <span className="font-medium">{formatDate(check.checkedAt)}</span>
                  </span>
                  {check.remarks && (
                    <span className="text-gray-500 text-xs">
                      📝 {check.remarks}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
