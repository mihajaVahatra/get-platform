'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type PaymentApplication = {
  id: string;
  status: string;
  offer: {
    title: string;
    tuitionFees: number;
    currency?: string;
    school: { name: string };
  };
};

export default function StudentPaymentsPage() {
  const t = useTranslations('StudentPayments');
  return (
    <Suspense
      fallback={<div className="flex justify-center p-8">{t('loading')}</div>}
    >
      <StudentPaymentsContent />
    </Suspense>
  );
}

function StudentPaymentsContent() {
  const t = useTranslations('StudentPayments');
  const searchParams = useSearchParams();
  const preselectedApplicationId = searchParams.get('applicationId');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [applications, setApplications] = useState<PaymentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState({
    applicationId: '',
    method: '',
  });

  // Payables : seules les candidatures acceptées peuvent donner lieu à un
  // paiement (le backend le vérifie aussi, ceci évite juste de proposer un
  // choix qui serait de toute façon refusé).
  const payableApplications = applications.filter(
    (application) => application.status === 'ACCEPTED',
  );

  useEffect(() => {
    fetchPayments();
    fetchApplications();
  }, []);

  // Arrivée depuis "Payer les frais" sur une candidature acceptée : ouvre
  // directement le dialogue de paiement avec cette candidature pré-remplie.
  useEffect(() => {
    if (preselectedApplicationId && applications.length > 0) {
      setPaymentData((current) => ({
        ...current,
        applicationId: preselectedApplicationId,
      }));
      setIsDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedApplicationId, applications]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/payments');
      setPayments(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      toast.error(t('loadPaymentsError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const response = await apiClient.get('/applications/me?limit=100');
      setApplications(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement candidatures:', error);
      toast.error(t('loadApplicationsError'));
    }
  };

  const filteredPayments =
    filter === 'ALL' ? payments : payments.filter((p) => p.status === filter);

  const totalAmount = payments
    .filter((p) => p.status === 'COMPLETED')
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
      PENDING: t('statuses.PENDING'),
      PROCESSING: t('statuses.PROCESSING'),
      COMPLETED: t('statuses.COMPLETED'),
      FAILED: t('statuses.FAILED'),
      REFUNDED: t('statuses.REFUNDED'),
      CANCELLED: t('statuses.CANCELLED'),
      EXPIRED: t('statuses.EXPIRED'),
    };
    return labels[status] || status;
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      ORANGE_MONEY: t('methods.ORANGE_MONEY'),
      MVOLA: t('methods.MVOLA'),
      CARD: t('methods.CARD'),
      BANK_TRANSFER: t('methods.BANK_TRANSFER'),
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
    if (!paymentData.applicationId || !paymentData.method) {
      toast.error(t('selectApplicationAndMethod'));
      return;
    }

    setIsInitiating(true);
    try {
      const response = await apiClient.post('/payments/initiate', {
        method: paymentData.method,
        applicationId: paymentData.applicationId,
      });

      toast.success(t('initiateSuccess'));
      setIsDialogOpen(false);
      setPaymentData({ applicationId: '', method: '' });

      if (response.data.data?.redirectUrl) {
        window.location.href = response.data.data.redirectUrl;
      } else {
        fetchPayments();
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message || t('initiateError');
      toast.error(message);
    } finally {
      setIsInitiating(false);
    }
  };

  const handleRetry = async (payment: Payment) => {
    if (!payment.application?.id) {
      toast.error(t('applicationNotFound'));
      return;
    }
    setRetryingId(payment.id);
    try {
      const response = await apiClient.post('/payments/initiate', {
        method: payment.method,
        applicationId: payment.application.id,
      });
      toast.success(t('retrySuccess'));
      if (response.data.data?.redirectUrl) {
        window.location.href = response.data.data.redirectUrl;
      } else {
        fetchPayments();
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message || t('retryError');
      toast.error(message);
    } finally {
      setRetryingId(null);
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
      toast.success(t('receiptDownloaded'));
    } catch (error) {
      toast.error(t('receiptDownloadError'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">{t('loadingPayments')}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-gray-500 text-sm">
            {t('totalCount', { count: payments.length })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-gray-500">{t('totalPaid')}</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-300">
              {formatAmount(totalAmount)}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              {t('newPayment')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('initiatePaymentTitle')}</DialogTitle>
                <DialogDescription>
                  {t('initiatePaymentSubtitle')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="applicationId">{t('applicationLabel')}</Label>
                  <Select
                    items={payableApplications.map((application) => ({
                      value: application.id,
                      label: `${application.offer.title} — ${application.offer.school.name} (${formatAmount(application.offer.tuitionFees)})`,
                    }))}
                    value={paymentData.applicationId}
                    onValueChange={(value) =>
                      setPaymentData({
                        ...paymentData,
                        applicationId: value ?? '',
                      })
                    }
                  >
                    <SelectTrigger id="applicationId">
                      <SelectValue placeholder={t('chooseApplication')} />
                    </SelectTrigger>
                    <SelectContent>
                      {payableApplications.map((application) => (
                        <SelectItem key={application.id} value={application.id}>
                          {application.offer.title} —{' '}
                          {application.offer.school.name} (
                          {formatAmount(application.offer.tuitionFees)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {payableApplications.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t('noPayableApplications')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">{t('methodLabel')}</Label>
                  <Select
                    items={[
                      { value: 'ORANGE_MONEY', label: t('methods.ORANGE_MONEY') },
                      { value: 'MVOLA', label: t('methods.MVOLA') },
                      { value: 'CARD', label: t('methods.CARD') },
                      { value: 'BANK_TRANSFER', label: t('methods.BANK_TRANSFER') },
                    ]}
                    value={paymentData.method}
                    onValueChange={(value) =>
                      setPaymentData({ ...paymentData, method: value ?? '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('chooseMethod')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORANGE_MONEY">{t('methods.ORANGE_MONEY')}</SelectItem>
                      <SelectItem value="MVOLA">{t('methods.MVOLA')}</SelectItem>
                      <SelectItem value="CARD">{t('methods.CARD')}</SelectItem>
                      <SelectItem value="BANK_TRANSFER">
                        {t('methods.BANK_TRANSFER')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t('cancel')}
                </Button>
                <Button onClick={handleInitiatePayment} disabled={isInitiating}>
                  {isInitiating ? t('inProgress') : t('pay')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">{t('filterLabel')}</label>
        <Select
          items={[
            { value: 'ALL', label: t('filterStatuses.ALL') },
            { value: 'PENDING', label: t('filterStatuses.PENDING') },
            { value: 'PROCESSING', label: t('filterStatuses.PROCESSING') },
            { value: 'COMPLETED', label: t('filterStatuses.COMPLETED') },
            { value: 'FAILED', label: t('filterStatuses.FAILED') },
            { value: 'REFUNDED', label: t('filterStatuses.REFUNDED') },
          ]}
          value={filter}
          onValueChange={(value) => setFilter(value ?? 'ALL')}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('filterStatuses.ALL')}</SelectItem>
            <SelectItem value="PENDING">{t('filterStatuses.PENDING')}</SelectItem>
            <SelectItem value="PROCESSING">{t('filterStatuses.PROCESSING')}</SelectItem>
            <SelectItem value="COMPLETED">{t('filterStatuses.COMPLETED')}</SelectItem>
            <SelectItem value="FAILED">{t('filterStatuses.FAILED')}</SelectItem>
            <SelectItem value="REFUNDED">{t('filterStatuses.REFUNDED')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Liste des paiements */}
      {filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">
              {payments.length === 0
                ? t('noPaymentsYet')
                : t('noMatchFilter')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPayments.map((payment) => (
            <Card
              key={payment.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-3">
                      {payment.reference}
                      <Badge
                        className={`${getStatusColor(payment.status)} text-white`}
                      >
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {payment.application?.offer?.school?.name ||
                        t('directPayment')}{' '}
                      •{payment.application?.offer?.title || t('noApplication')}
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
                      {t('methodPrefix')}{' '}
                      <span className="font-medium">
                        {getMethodLabel(payment.method)}
                      </span>
                    </span>
                    {payment.paidAt && (
                      <span className="text-gray-500">
                        {t('paidOnPrefix')}{' '}
                        <span className="font-medium">
                          {formatDate(payment.paidAt)}
                        </span>
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
                        {t('receipt')}
                      </Button>
                    )}
                    {payment.status === 'PENDING' && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-300">
                        {t('pendingConfirmation')}
                      </span>
                    )}
                    {payment.status === 'FAILED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 dark:text-red-300"
                        disabled={retryingId === payment.id}
                        onClick={() => handleRetry(payment)}
                      >
                        {retryingId === payment.id
                          ? t('retrying')
                          : t('retry')}
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
