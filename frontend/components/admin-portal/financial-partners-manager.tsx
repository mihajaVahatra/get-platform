'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  Edit3,
  HandCoins,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type PartnerItem = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  logo?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  isActive: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  BANK: 'Banque',
  MOBILE_MONEY: 'Mobile Money',
  INSURANCE: 'Assurance',
  SCHOLARSHIP: 'Bourse',
  OTHER: 'Autre',
};

function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

const PAGE_SIZE = 20;

export function FinancialPartnersManager() {
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<PartnerItem | null>(null);
  const [toDelete, setToDelete] = useState<PartnerItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/financial-partners', {
        params: { page, limit: PAGE_SIZE, search: search || undefined },
      });
      setPartners(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement partenaires financiers:', error);
      toast.error('Impossible de charger les partenaires financiers');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchPartners();
    });
    return () => {
      active = false;
    };
  }, [fetchPartners]);

  const removePartner = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/financial-partners/${toDelete.id}`);
      toast.success('Partenaire supprimé');
      setToDelete(null);
      await fetchPartners();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer ce partenaire');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Partenaires financiers
          </h1>
          <p className="mt-1 text-sm text-indigo-600">
            Gérez les banques, opérateurs et organismes partenaires de la
            plateforme.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setModal('create');
          }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200"
        >
          <Plus className="size-4" />
          Ajouter un partenaire
        </button>
      </header>
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <label className="relative mb-6 block max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-indigo-500"
            maxLength={150}
            placeholder="Rechercher un partenaire..."
          />
        </label>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des partenaires...
          </p>
        ) : partners.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucun partenaire ne correspond à cette recherche.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {partners.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                {row.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.logo}
                    alt=""
                    className="size-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                    <HandCoins className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {row.name}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {row.contactEmail || row.contactPhone || row.website || 'Contact non renseigné'}
                  </p>
                  <div className="mt-1.5">
                    <span className="rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                      {TYPE_LABELS[row.type] || row.type}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-indigo-600">
                  <button
                    aria-label={`Modifier ${row.name}`}
                    onClick={() => {
                      setSelected(row);
                      setModal('edit');
                    }}
                  >
                    <Edit3 className="size-4" />
                  </button>
                  <button
                    aria-label={`Supprimer ${row.name}`}
                    className="text-red-500"
                    onClick={() => setToDelete(row)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} partenaire
              {meta.total > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4 rotate-180" />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </section>
      {modal && (
        <PartnerForm
          partner={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void fetchPartners();
          }}
        />
      )}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="font-extrabold text-[#17204e]">
              Supprimer le partenaire
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Voulez-vous vraiment supprimer « {toDelete.name} » ? Cette
              action est irréversible.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={() => void removePartner()}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PartnerForm({
  partner,
  onClose,
  onSaved,
}: {
  partner: PartnerItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(partner?.name || '');
  const [description, setDescription] = useState(partner?.description || '');
  const [type, setType] = useState(partner?.type || 'OTHER');
  const [contactEmail, setContactEmail] = useState(partner?.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(partner?.contactPhone || '');
  const [website, setWebsite] = useState(partner?.website || '');
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState(partner?.logo || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const uploadLogo = async (file: File) => {
    if (!partner) return;
    try {
      setUploadingLogo(true);
      const form = new FormData();
      form.append('file', file);
      const response = await apiClient.post(
        `/financial-partners/${partner.id}/logo`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setLogo(response.data.data.logoUrl);
      toast.success('Logo mis à jour');
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || "Impossible d'envoyer le logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      website: website.trim() || undefined,
    };
    try {
      setSaving(true);
      if (partner) {
        await apiClient.patch(`/financial-partners/${partner.id}`, payload);
        toast.success('Partenaire mis à jour');
      } else {
        await apiClient.post('/financial-partners', payload);
        toast.success('Partenaire créé');
      }
      onSaved();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer ce partenaire');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="font-extrabold text-[#17204e]">
          {partner ? 'Modifier le partenaire' : 'Nouveau partenaire'}
        </h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          {partner && (
            <div className="flex items-center gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  className="size-12 shrink-0 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <HandCoins className="size-5" />
                </span>
              )}
              <label className="text-xs font-bold text-[#34406b]">
                Logo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingLogo}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                  className="mt-1.5 block text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </label>
            </div>
          )}
          <label className="block text-xs font-bold text-[#34406b]">
            Nom du partenaire
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              required
              placeholder="Ex. BNI Madagascar"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
            />
          </label>
          <label className="block text-xs font-bold text-[#34406b]">
            Type de partenaire
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-[#34406b]">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Détails du partenariat..."
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-indigo-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-[#34406b]">
              E-mail de contact
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="contact@partenaire.mg"
                maxLength={254}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-xs font-bold text-[#34406b]">
              Téléphone
              <input
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="+261 20 22 123 45"
                maxLength={30}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
          </div>
          <label className="block text-xs font-bold text-[#34406b]">
            Site web
            <input
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://www.partenaire.mg"
              maxLength={300}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
