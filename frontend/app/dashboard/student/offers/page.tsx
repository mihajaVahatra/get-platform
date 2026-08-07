'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';

type Offer = {
  id: string;
  title: string;
  diploma: string;
  duration: number;
  tuitionFees: number;
  currency: string;
  isOpen: boolean;
  applicationDeadline?: string;
  school: {
    id: string;
    name: string;
    city: string;
    region: string;
  };
};

export default function StudentOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedOffers, setAppliedOffers] = useState<Set<string>>(new Set());

  // Filtres — la ville et la tranche de frais viennent des listes de
  // référence gérées par l'admin GET (/platform-cities, /fee-brackets)
  // plutôt que de la saisie libre.
  const [filters, setFilters] = useState({
    diploma: '',
    feeBracketId: '',
    city: '',
  });
  const [cities, setCities] = useState<string[]>([]);
  const [feeBrackets, setFeeBrackets] = useState<
    { id: string; label: string; minFees: number; maxFees: number | null; isActive: boolean }[]
  >([]);

  const fetchFilterOptions = async () => {
    try {
      const [citiesRes, bracketsRes] = await Promise.all([
        apiClient.get('/platform-cities'),
        apiClient.get('/fee-brackets'),
      ]);
      setCities(
        (citiesRes.data.data as { name: string; isActive: boolean }[])
          .filter((item) => item.isActive)
          .map((item) => item.name),
      );
      setFeeBrackets(
        (bracketsRes.data.data as typeof feeBrackets).filter((item) => item.isActive),
      );
    } catch (error) {
      console.error('Erreur chargement des filtres:', error);
    }
  };

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.diploma) params.append('diploma', filters.diploma);
      if (filters.city) params.append('city', filters.city);
      const bracket = feeBrackets.find((item) => item.id === filters.feeBracketId);
      if (bracket) {
        params.append('minFees', String(bracket.minFees));
        if (bracket.maxFees !== null) params.append('maxFees', String(bracket.maxFees));
      }
      params.append('isOpen', 'true');

      const response = await apiClient.get(`/offers?${params.toString()}`);
      setOffers(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement offres:', error);
      toast.error('Erreur lors du chargement des offres');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyApplications = async () => {
    try {
      const response = await apiClient.get('/applications/me');
      const apps = response.data.data || [];
      const appliedIds = new Set<string>(
        apps
          .map((app: { offerId?: string }) => app.offerId)
          .filter((offerId: string | undefined): offerId is string => Boolean(offerId)),
      );
      setAppliedOffers(appliedIds);
    } catch (error) {
      console.error('Erreur chargement candidatures:', error);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchOffers();
      fetchMyApplications();
      fetchFilterOptions();
    });
  }, []);

  const handleApply = async (offerId: string) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/applications', {
        offerIds: [offerId],
      });
      
      if (response.data.data?.submitted?.includes(offerId)) {
        toast.success('Candidature soumise avec succès !');
        setAppliedOffers(prev => new Set(prev).add(offerId));
        setIsDialogOpen(false);
        await fetchMyApplications();
      } else {
        toast.error('Erreur lors de la soumission');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur lors de la soumission';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchOffers();
  };

  const resetFilters = () => {
    setFilters({ diploma: '', feeBracketId: '', city: '' });
    setTimeout(fetchOffers, 100);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement des offres...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rechercher des offres</h1>
        <span className="text-sm text-gray-500">{offers.length} offre(s) disponible(s)</span>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="diploma">Diplôme</Label>
              <Input
                id="diploma"
                placeholder="BAC+5, BAC+3..."
                maxLength={50}
                value={filters.diploma}
                onChange={(e) => handleFilterChange('diploma', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="feeBracketId">Frais (Ar)</Label>
              <Select
                value={filters.feeBracketId || undefined}
                onValueChange={(value) => handleFilterChange('feeBracketId', value ?? '')}
              >
                <SelectTrigger id="feeBracketId">
                  <SelectValue placeholder="Toutes les tranches" />
                </SelectTrigger>
                <SelectContent>
                  {feeBrackets.map((bracket) => (
                    <SelectItem key={bracket.id} value={bracket.id}>
                      {bracket.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="city">Ville</Label>
              <Select
                value={filters.city || undefined}
                onValueChange={(value) => handleFilterChange('city', value ?? '')}
              >
                <SelectTrigger id="city">
                  <SelectValue placeholder="Toutes les villes" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters}>🔍 Rechercher</Button>
            <Button variant="outline" onClick={resetFilters}>Réinitialiser</Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des offres */}
      {offers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Aucune offre ne correspond à vos critères.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offers.map((offer) => {
            const hasApplied = appliedOffers.has(offer.id);
            return (
              <Card key={offer.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{offer.title}</CardTitle>
                      <CardDescription>
                        {offer.school.name} • {offer.school.city}
                      </CardDescription>
                    </div>
                    <Badge className={offer.isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                      {offer.isOpen ? '📢 Ouvert' : '🔒 Fermé'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-gray-500">
                      Diplôme : <span className="font-medium">{offer.diploma}</span>
                    </span>
                    <span className="text-gray-500">
                      Durée : <span className="font-medium">{offer.duration} mois</span>
                    </span>
                    <span className="text-gray-500">
                      Frais : <span className="font-medium text-blue-600">{formatAmount(offer.tuitionFees)}</span>
                    </span>
                    <span className="text-gray-500">
                      Date limite : <span className="font-medium">{formatDate(offer.applicationDeadline)}</span>
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  {hasApplied ? (
                    <Button variant="outline" disabled className="text-green-600">
                      ✅ Candidature soumise
                    </Button>
                  ) : (
                    <Dialog open={isDialogOpen && selectedOffer?.id === offer.id} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) setSelectedOffer(null);
                    }}>
                      <DialogTrigger
                        render={<Button className="bg-blue-600 text-white hover:bg-blue-700" />}
                        onClick={() => setSelectedOffer(offer)}
                      >
                        📨 Postuler
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirmer la candidature</DialogTitle>
                          <DialogDescription>
                            Vous êtes sur le point de postuler à l'offre suivante :
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                          <p><strong>Offre :</strong> {offer.title}</p>
                          <p><strong>École :</strong> {offer.school.name}</p>
                          <p><strong>Diplôme :</strong> {offer.diploma}</p>
                          <p><strong>Frais :</strong> {formatAmount(offer.tuitionFees)}</p>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Annuler
                          </Button>
                          <Button onClick={() => handleApply(offer.id)} disabled={isSubmitting}>
                            {isSubmitting ? 'En cours...' : '✅ Confirmer'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
