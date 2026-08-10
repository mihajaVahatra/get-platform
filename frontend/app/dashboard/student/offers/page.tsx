'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';

/** Offre de formation publiée par une école, telle que retournée par l'API `/offers`. */
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

/**
 * Route `/dashboard/student/offers` : client component ('use client') permettant à l'étudiant
 * de parcourir et filtrer les offres de formation ouvertes (par diplôme, tranche de frais,
 * ville), puis de postuler à une offre via une modale de confirmation.
 * Appels API via `apiClient` :
 * - `GET /offers/diplomas`, `/platform-cities`, `/fee-brackets` : options des filtres.
 * - `GET /offers` (avec filtres en query params, `isOpen=true`) : liste des offres.
 * - `GET /applications/me` : détermine les offres auxquelles l'étudiant a déjà postulé.
 * - `POST /applications` : soumet une candidature pour une offre.
 */
export default function StudentOffersPage() {
  const t = useTranslations('StudentOffers');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedOffers, setAppliedOffers] = useState<Set<string>>(new Set());

  // Filtres à choix uniquement (pas de saisie libre) : le diplôme vient des
  // offres ouvertes existantes (/offers/diplomas), la ville et la tranche de
  // frais des listes de référence gérées par l'admin GET (/platform-cities,
  // /fee-brackets).
  const [filters, setFilters] = useState({
    diploma: '',
    feeBracketId: '',
    city: '',
  });
  const [diplomas, setDiplomas] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [feeBrackets, setFeeBrackets] = useState<
    { id: string; label: string; minFees: number; maxFees: number | null; isActive: boolean }[]
  >([]);

  /** Charge les options de filtrage (diplômes disponibles, villes actives, tranches de frais actives). */
  const fetchFilterOptions = async () => {
    try {
      const [diplomasRes, citiesRes, bracketsRes] = await Promise.all([
        apiClient.get('/offers/diplomas'),
        apiClient.get('/platform-cities'),
        apiClient.get('/fee-brackets'),
      ]);
      setDiplomas(diplomasRes.data.data as string[]);
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

  // Accepte les filtres à appliquer en paramètre plutôt que de toujours lire
  // l'état `filters` : resetFilters() a besoin d'enchaîner la remise à zéro
  // et le rechargement dans le même appel, sans dépendre d'une fermeture
  // (closure) figée sur les anciennes valeurs le temps que le re-render
  // React propage le nouvel état.
  const fetchOffers = async (activeFilters: typeof filters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilters.diploma) params.append('diploma', activeFilters.diploma);
      if (activeFilters.city) params.append('city', activeFilters.city);
      const bracket = feeBrackets.find((item) => item.id === activeFilters.feeBracketId);
      if (bracket) {
        params.append('minFees', String(bracket.minFees));
        if (bracket.maxFees !== null) params.append('maxFees', String(bracket.maxFees));
      }
      params.append('isOpen', 'true');

      const response = await apiClient.get(`/offers?${params.toString()}`);
      setOffers(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement offres:', error);
      toast.error(t('loadOffersError'));
    } finally {
      setLoading(false);
    }
  };

  /** Charge les candidatures existantes de l'étudiant pour marquer les offres déjà postulées (`appliedOffers`). */
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

  /**
   * Soumet une candidature pour l'offre donnée. Le backend traite `offerIds` comme un tableau
   * (candidature multiple potentielle) mais un seul ID est envoyé ici ; le succès est vérifié
   * via la présence de l'offre dans `submitted` plutôt que via le seul statut HTTP.
   */
  const handleApply = async (offerId: string) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/applications', {
        offerIds: [offerId],
      });
      
      if (response.data.data?.submitted?.includes(offerId)) {
        toast.success(t('applySuccess'));
        setAppliedOffers(prev => new Set(prev).add(offerId));
        setIsDialogOpen(false);
        await fetchMyApplications();
      } else {
        toast.error(t('applyError'));
      }
    } catch (error: any) {
      const message = error.response?.data?.message || t('applyError');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' Ar';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('notDefined');
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
    const cleared = { diploma: '', feeBracketId: '', city: '' };
    setFilters(cleared);
    fetchOffers(cleared);
  };

  if (loading) {
    return <div className="flex justify-center p-8">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <span className="text-sm text-gray-500">{t('offersAvailable', { count: offers.length })}</span>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="diploma">{t('diploma')}</Label>
              <Select
                items={diplomas.map((diploma) => ({ value: diploma, label: diploma }))}
                value={filters.diploma || undefined}
                onValueChange={(value) => handleFilterChange('diploma', value ?? '')}
              >
                <SelectTrigger id="diploma">
                  <SelectValue placeholder={t('allDiplomas')} />
                </SelectTrigger>
                <SelectContent>
                  {diplomas.map((diploma) => (
                    <SelectItem key={diploma} value={diploma}>
                      {diploma}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="feeBracketId">{t('fees')}</Label>
              <Select
                items={feeBrackets.map((bracket) => ({ value: bracket.id, label: bracket.label }))}
                value={filters.feeBracketId || undefined}
                onValueChange={(value) => handleFilterChange('feeBracketId', value ?? '')}
              >
                <SelectTrigger id="feeBracketId">
                  <SelectValue placeholder={t('allBrackets')} />
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
              <Label htmlFor="city">{t('city')}</Label>
              <Select
                items={cities.map((city) => ({ value: city, label: city }))}
                value={filters.city || undefined}
                onValueChange={(value) => handleFilterChange('city', value ?? '')}
              >
                <SelectTrigger id="city">
                  <SelectValue placeholder={t('allCities')} />
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
            <Button onClick={applyFilters}>🔍 {t('search')}</Button>
            <Button variant="outline" onClick={resetFilters}>{t('reset')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des offres */}
      {offers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">{t('noMatch')}</p>
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
                      {offer.isOpen ? `📢 ${t('open')}` : `🔒 ${t('closed')}`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-gray-500">
                      {t('diplomaLabel')} <span className="font-medium">{offer.diploma}</span>
                    </span>
                    <span className="text-gray-500">
                      {t('durationLabel')} <span className="font-medium">{t('durationMonths', { count: offer.duration })}</span>
                    </span>
                    <span className="text-gray-500">
                      {t('feesLabel')} <span className="font-medium text-blue-600 dark:text-blue-300">{formatAmount(offer.tuitionFees)}</span>
                    </span>
                    <span className="text-gray-500">
                      {t('deadlineLabel')} <span className="font-medium">{formatDate(offer.applicationDeadline)}</span>
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  {hasApplied ? (
                    <Button variant="outline" disabled className="text-green-600 dark:text-green-300">
                      ✅ {t('alreadyApplied')}
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
                        📨 {t('apply')}
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('confirmApplicationTitle')}</DialogTitle>
                          <DialogDescription>
                            {t('confirmApplicationDescription')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                          <p><strong>{t('offerLabel')}</strong> {offer.title}</p>
                          <p><strong>{t('schoolLabel')}</strong> {offer.school.name}</p>
                          <p><strong>{t('diplomaLabel')}</strong> {offer.diploma}</p>
                          <p><strong>{t('feesLabel')}</strong> {formatAmount(offer.tuitionFees)}</p>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            {t('cancel')}
                          </Button>
                          <Button onClick={() => handleApply(offer.id)} disabled={isSubmitting}>
                            {isSubmitting ? t('confirming') : `✅ ${t('confirm')}`}
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
