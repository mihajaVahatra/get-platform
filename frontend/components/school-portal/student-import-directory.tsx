'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PlusIcon, Search, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  city?: string | null;
  enrolledYear?: string | null;
  user: {
    email: string;
  };
};

const PAGE_SIZE = 20;

export function StudentImportDirectory() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [enrolledYear, setEnrolledYear] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const loadStudents = async () => {
        try {
          const params = new URLSearchParams({
            page: String(page),
            limit: String(PAGE_SIZE),
          });
          if (search.trim()) params.set('search', search.trim());

          const response = await apiClient.get(`/schools/me/students?${params.toString()}`);
          if (cancelled) return;

          setStudents(response.data.data || []);
          setTotalItems(response.data.meta?.total || 0);
          setTotalPages(response.data.meta?.totalPages || 1);
        } catch (error) {
          if (!cancelled) {
            console.error('Erreur chargement étudiants:', error);
            toast.error('Impossible de charger les étudiants');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      void loadStudents();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, refreshKey, search]);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    setLoading(true);
  };

  const changePage = (nextPage: number) => {
    setLoading(true);
    setPage(nextPage);
  };

  const submitEnrollment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setEnrolling(true);
      try {
        await apiClient.post('/schools/me/students/enroll', {
          email,
          enrolledYear: enrolledYear || undefined,
        });
        toast.success('Étudiant inscrit avec succès');
        setEnrollOpen(false);
        setEmail('');
        setEnrolledYear('');
        setSearch('');
        setPage(1);
        setLoading(true);
        setRefreshKey((value) => value + 1);
      } catch (error) {
        console.error('Erreur inscription étudiant:', error);
        const responseMessage = (error as { response?: { data?: { message?: string } } })
          .response?.data?.message;
        toast.error(responseMessage || "Impossible d'inscrire cet étudiant");
      } finally {
        setEnrolling(false);
      }
    })();
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">Étudiants inscrits</h1>
          <p className="mt-1 text-sm text-violet-600">Liste des étudiants inscrits dans votre établissement.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700">
            <UsersRound className="size-4" /> {totalItems} étudiant(s)
          </div>
          <Button onClick={() => setEnrollOpen(true)}><PlusIcon /> Inscrire un étudiant</Button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-3">
          <label className="relative min-w-[250px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-violet-500"
              placeholder="Rechercher par nom ou e-mail..."
            />
          </label>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Chargement des étudiants...</div>
        ) : students.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">Aucun étudiant ne correspond à la recherche.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[11px]">
              <thead className="border-b border-slate-100 text-slate-400">
                <tr>
                  {['Étudiant', 'E-mail', 'Téléphone', 'Ville', 'Année d’inscription', 'Statut'].map((label) => (
                    <th key={label} className="pb-3 font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const name = `${student.firstName} ${student.lastName}`.trim();
                  const initials = `${student.firstName[0] || ''}${student.lastName[0] || ''}`.toUpperCase();

                  return (
                    <tr key={student.id} className="border-b border-slate-50 text-slate-600">
                      <td className="py-3 font-bold text-[#28315e]">
                        <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-violet-100 text-[10px] text-violet-600">{initials}</span>
                        {name}
                      </td>
                      <td>{student.user.email}</td>
                      <td>{student.phone || 'Non renseigné'}</td>
                      <td>{student.city || 'Non renseignée'}</td>
                      <td>{student.enrolledYear || 'Non renseignée'}</td>
                      <td><Status /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <Pagination className="mt-5">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); if (page > 1) changePage(page - 1); }} className={page <= 1 ? 'pointer-events-none opacity-50' : ''} />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <PaginationItem key={pageNumber}>
                  <PaginationLink href="#" isActive={pageNumber === page} onClick={(event) => { event.preventDefault(); changePage(pageNumber); }}>{pageNumber}</PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext href="#" onClick={(event) => { event.preventDefault(); if (page < totalPages) changePage(page + 1); }} className={page >= totalPages ? 'pointer-events-none opacity-50' : ''} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </section>

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <form onSubmit={submitEnrollment}>
            <DialogHeader>
              <DialogTitle>Inscrire un étudiant</DialogTitle>
              <DialogDescription>
                Seuls les comptes étudiant existants peuvent être inscrits. Un transfert vers une autre école nécessite une procédure dédiée.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="enroll-email">E-mail de l’étudiant</Label>
                <Input id="enroll-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enroll-year">Année d’inscription</Label>
                <Input id="enroll-year" value={enrolledYear} onChange={(event) => setEnrolledYear(event.target.value)} placeholder="Ex. 2026–2027" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={enrolling}>{enrolling ? 'Inscription...' : 'Inscrire'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Status() {
  return <span className="inline-block rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">Inscrit</span>;
}
