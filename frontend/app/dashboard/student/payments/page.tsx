'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';

type Payment = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  paidAt?: string;
  createdAt: string;
  receiptUrl?: string;
  application?: {
    id: string;
    offer: {
      title: string;
      school: {
        name: string;
      };
    };
  };
};

export default function StudentPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [paymentData, setPaymentData] = useState({
    applicationId: '',
    amount: '',
    method: '',
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/payments');
      setPayments(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = filter === 'ALL' 
    ? payments 
    : payments.filter(p => p.status === filter);

  const totalAmount = payments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amount, 0);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-500',
      PROCESSING: 'bg-blue-400',
      COMPLETED: 'bg-green-500',
      FAILED: 'bg-red-500',
      REFUNDED: 'bg-gray-400',
      CANCELLED: 'bg-rose-400',
      EXPIRED: 'bg-orange-400',
    };
    return colors[status] || 'bg-gray-300';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      PROCESSING: 'En cours',
      COMPLETED: 'Réussi ✅',
      FAILED: 'Échoué ❌',
      REFUNDED: 'Remboursé',
      CANCELLED: 'Annulé',
      EXPIRED: 'Expiré',
    };
    return labels[status] || status;
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      ORANGE_MONEY: 'Orange Money',
      MVOLA: 'Mvola',
      CARD: 'Carte bancaire',
      BANK_TRANSFER: 'Virement bancaire',
    };
    return labels[method] || method;
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

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' Ar';
  };

  const handleInitiatePayment = async () => {
    if (!paymentData.amount || !paymentData.method) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsInitiating(true);
    try {
      const response = await apiClient.post('/payments/initiate', {
        amount: parseFloat(paymentData.amount),
        method: paymentData.method,
        applicationId: paymentData.applicationId || undefined,
      });
      
      toast.success('Paiement initié avec succès !');
      setIsDialogOpen(false);
      setPaymentData({ applicationId: '', amount: '', method: '' });
      
      if (response.data.data?.redirectUrl) {
        window.location.href = response.data.data.redirectUrl;
      } else {
        fetchPayments();
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur lors de l\'initiation';
      toast.error(message);
    } finally {
      setIsInitiating(false);
    }
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const response = await apiClient.get(`/payments/${paymentId}/receipt`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recu-${paymentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Reçu téléchargé');
    } catch (error) {
      toast.error('Erreur lors du téléchargement du reçu');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Chargement des paiements...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes paiements</h1>
          <p className="text-gray-500 text-sm">
            {payments.length} paiement(s) au total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total payé</p>
            <p className="text-xl font-bold text-green-600">{formatAmount(totalAmount)}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              🆕 Nouveau paiement
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Initier un paiement</DialogTitle>
                <DialogDescription>
                  Remplissez les informations pour effectuer un paiement
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Montant (MGA)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="4500000"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">Méthode de paiement</Label>
                  <Select
                    value={paymentData.method}
                    onValueChange={(value) => setPaymentData({ ...paymentData, method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une méthode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
                      <SelectItem value="MVOLA">Mvola</SelectItem>
                      <SelectItem value="CARD">Carte bancaire</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Virement bancaire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationId">Candidature (optionnel)</Label>
                  <Input
                    id="applicationId"
                    placeholder="ID de la candidature"
                    value={paymentData.applicationId}
                    onChange={(e) => setPaymentData({ ...paymentData, applicationId: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleInitiatePayment} disabled={isInitiating}>
                  {isInitiating ? 'En cours...' : 'Payer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
          <option value="PROCESSING">En cours</option>
          <option value="COMPLETED">Réussis</option>
          <option value="FAILED">Échoués</option>
          <option value="REFUNDED">Remboursés</option>
        </select>
      </div>

      {/* Liste des paiements */}
      {filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">
              {payments.length === 0 
                ? 'Vous n\'avez pas encore effectué de paiement.' 
                : 'Aucun paiement ne correspond à ce filtre.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPayments.map((payment) => (
            <Card key={payment.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-3">
                      {payment.reference}
                      <Badge className={`${getStatusColor(payment.status)} text-white`}>
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {payment.application?.offer?.school?.name || 'Paiement direct'} • 
                      {payment.application?.offer?.title || 'Sans candidature'}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {formatAmount(payment.amount)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(payment.createdAt)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">
                      Méthode : <span className="font-medium">{getMethodLabel(payment.method)}</span>
                    </span>
                    {payment.paidAt && (
                      <span className="text-gray-500">
                        Payé le : <span className="font-medium">{formatDate(payment.paidAt)}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {payment.status === 'COMPLETED' && payment.receiptUrl && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownloadReceipt(payment.id)}
                      >
                        📥 Reçu
                      </Button>
                    )}
                    {payment.status === 'PENDING' && (
                      <span className="text-xs text-yellow-600">
                        ⏳ En attente de confirmation
                      </span>
                    )}
                    {payment.status === 'FAILED' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-600"
                      >
                        🔄 Réessayer
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
