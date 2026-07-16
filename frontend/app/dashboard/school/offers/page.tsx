'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type Offer = {
  id: string;
  title: string;
  diploma: string;
  duration: number;
  tuitionFees: number;
  isOpen: boolean;
  applicationDeadline?: string;
  createdAt: string;
  _count?: {
    applications: number;
  };
};

export default function SchoolOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/offers?schoolId=me');
      setOffers(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement offres:', error);
      toast.error('Erreur lors du chargement des offres');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette offre ?')) return;
    try {
      await apiClient.delete(`/offers/${id}`);
      toast.success('Offre supprimée');
      fetchOffers();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleStatus = async (id: string, isOpen: boolean) => {
    try {
      await apiClient.patch(`/offers/${id}/status`, { isOpen: !isOpen });
      toast.success(`Offre ${!isOpen ? 'ouverte' : 'fermée'}`);
      fetchOffers();
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' Ar';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non définie';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement des offres...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes offres</h1>
          <p className="text-gray-500 text-sm">{offers.length} offre(s)</p>
        </div>
        <Link href="/dashboard/school/offers/new">
          <Button>➕ Nouvelle offre</Button>
        </Link>
      </div>

      {offers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Vous n'avez pas encore créé d'offre.</p>
            <Link href="/dashboard/school/offers/new">
              <Button className="mt-4">Créer votre première offre</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offers.map((offer) => (
            <Card key={offer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{offer.title}</CardTitle>
                    <CardDescription>
                      {offer.diploma} • {offer.duration} mois
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={offer.isOpen ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}>
                      {offer.isOpen ? 'Ouvert' : 'Fermé'}
                    </Badge>
                    <Badge variant="outline" className="text-blue-600">
                      {offer._count?.applications || 0} candidature(s)
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    Frais : <span className="font-medium text-blue-600">{formatAmount(offer.tuitionFees)}</span>
                  </span>
                  <span className="text-gray-500">
                    Date limite : <span className="font-medium">{formatDate(offer.applicationDeadline)}</span>
                  </span>
                </div>
              </CardContent>
              <div className="px-6 py-3 border-t flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={offer.isOpen ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleToggleStatus(offer.id, offer.isOpen)}
                    className={!offer.isOpen ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                  >
                    {offer.isOpen ? '🔒 Fermer' : '📢 Ouvrir'}
                  </Button>
                  <Link href={`/dashboard/school/offers/${offer.id}`}>
                    <Button variant="outline" size="sm">✏️ Modifier</Button>
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/school/applications?offerId=${offer.id}`}>
                    <Button variant="ghost" size="sm">📋 Voir candidatures</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(offer.id)}
                  >
                    🗑️ Supprimer
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
