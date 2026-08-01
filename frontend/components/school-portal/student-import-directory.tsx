'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PlusIcon, Search, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type StudentDetail = Student & {
  birthDate?: string | null;
  cin?: string | null;
  bacYear?: number | null;
  bacType?: string | null;
  address?: string | null;
  region?: string | null;
  country: string;
  bio?: string | null;
  enrollmentStatus: string;
  programId?: string | null;
  program?: { id: string; name: string } | null;
  programLevel?: number | null;
  academicYearId?: string | null;
  academicYear?: { id: string; label: string } | null;
};

const PAGE_SIZE = 20;
type Program = {
  id: string;
  name: string;
  durationYears: number;
  isActive: boolean;
};
type AcademicYear = {
  id: string;
  label: string;
  enrollmentOpensAt: string;
  enrollmentClosesAt: string;
  isCurrent: boolean;
};

export function StudentImportDirectory() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [studentToWithdraw, setStudentToWithdraw] = useState<Student | null>(null);
  const [withdrawingStudent, setWithdrawingStudent] = useState(false);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailProgramId, setDetailProgramId] = useState('');
  const [detailLevel, setDetailLevel] = useState('');
  const [detailAcademicYearId, setDetailAcademicYearId] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [email, setEmail] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programId, setProgramId] = useState('');
  const [level, setLevel] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [bulkReport, setBulkReport] = useState<{
    succeeded: string[];
    failed: { row: { email?: string }; reason: string }[];
  } | null>(null);

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

          const response = await apiClient.get(
            `/schools/me/students?${params.toString()}`,
          );
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
  useEffect(() => {
    void Promise.all([
      apiClient.get('/schools/me/programs'),
      apiClient.get('/schools/me/academic-years'),
    ])
      .then(([programResponse, yearResponse]) => {
        setPrograms(
          (programResponse.data.data || []).filter(
            (program: Program) => program.isActive,
          ),
        );
        const years = yearResponse.data.data || [];
        setAcademicYears(years);
        setAcademicYearId(
          years.find((year: AcademicYear) => year.isCurrent)?.id || '',
        );
      })
      .catch(() =>
        toast.error('Impossible de charger les options d’inscription'),
      );
  }, [enrollOpen, viewingStudentId]);
  const selectedProgram = programs.find((program) => program.id === programId);
  const selectedYear = academicYears.find((year) => year.id === academicYearId);
  const now = new Date();
  const notYetOpen =
    !!selectedYear && new Date(selectedYear.enrollmentOpensAt) > now;
  const alreadyClosed =
    !!selectedYear && new Date(selectedYear.enrollmentClosesAt) < now;
  const periodOpen = !!selectedYear && !notYetOpen && !alreadyClosed;

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    setLoading(true);
  };

  const withdrawStudent = async () => {
    if (!studentToWithdraw) return;
    setWithdrawingStudent(true);
    try {
      await apiClient.patch(`/schools/me/students/${studentToWithdraw.id}`, {
        status: 'WITHDRAWN',
      });
      toast.success('Inscription clôturée');
      setStudentToWithdraw(null);
      setRefreshKey((value) => value + 1);
    } catch {
      toast.error('Impossible de clôturer l’inscription');
    } finally {
      setWithdrawingStudent(false);
    }
  };

  const closeDetailDialog = () => {
    setViewingStudentId(null);
    setStudentDetail(null);
  };

  useEffect(() => {
    if (!viewingStudentId) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setLoadingDetail(true);
      try {
        const response = await apiClient.get(
          `/schools/me/students/${viewingStudentId}`,
        );
        if (cancelled) return;
        const detail = response.data.data as StudentDetail;
        setStudentDetail(detail);
        setDetailProgramId(detail.programId || '');
        setDetailLevel(detail.programLevel ? String(detail.programLevel) : '');
        setDetailAcademicYearId(detail.academicYearId || '');
      } catch {
        if (!cancelled) {
          toast.error('Impossible de charger la fiche de cet étudiant');
          closeDetailDialog();
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [viewingStudentId]);

  const saveStudentEnrollment = async () => {
    if (!studentDetail) return;
    setSavingDetail(true);
    try {
      await apiClient.patch(`/schools/me/students/${studentDetail.id}`, {
        programId: detailProgramId || undefined,
        level: detailLevel ? Number(detailLevel) : undefined,
        academicYearId: detailAcademicYearId || undefined,
        status: studentDetail.enrollmentStatus,
      });
      toast.success('Inscription mise à jour');
      closeDetailDialog();
      setRefreshKey((value) => value + 1);
    } catch {
      toast.error('Impossible de mettre à jour l’inscription');
    } finally {
      setSavingDetail(false);
    }
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
          programId,
          level: Number(level),
          academicYearId,
        });
        toast.success('Étudiant inscrit avec succès');
        setEnrollOpen(false);
        setEmail('');
        setProgramId('');
        setLevel('');
        setSearch('');
        setPage(1);
        setLoading(true);
        setRefreshKey((value) => value + 1);
      } catch (error) {
        console.error('Erreur inscription étudiant:', error);
        const responseMessage = (
          error as { response?: { data?: { message?: string } } }
        ).response?.data?.message;
        toast.error(responseMessage || "Impossible d'inscrire cet étudiant");
      } finally {
        setEnrolling(false);
      }
    })();
  };
  const importCsv = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const rows = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => {
        const [email, programName, level, academicYearLabel] = line
          .split(',')
          .map((cell) => cell.trim());
        return { email, programName, level: Number(level), academicYearLabel };
      });
    try {
      const response = await apiClient.post(
        '/schools/me/students/enroll/bulk',
        { rows },
      );
      setBulkReport(response.data.data);
      setRefreshKey((value) => value + 1);
      toast.success('Import terminé');
    } catch {
      toast.error("Impossible d'importer le CSV");
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Étudiants inscrits
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Liste des étudiants inscrits dans votre établissement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700">
            <UsersRound className="size-4" /> {totalItems} étudiant(s)
          </div>
          <Button onClick={() => setEnrollOpen(true)}>
            <PlusIcon /> Inscrire un étudiant
          </Button>
          <label>
            <input
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void importCsv(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              onClick={(event) =>
                (
                  event.currentTarget.parentElement?.querySelector(
                    'input',
                  ) as HTMLInputElement
                )?.click()
              }
            >
              Importer CSV
            </Button>
          </label>
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
          <div className="py-12 text-center text-sm text-slate-500">
            Chargement des étudiants...
          </div>
        ) : students.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Aucun étudiant ne correspond à la recherche.
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((student) => {
              const initials =
                `${student.firstName[0] || ''}${student.lastName[0] || ''}`.toUpperCase();
              const name = `${student.firstName} ${student.lastName}`;

              return (
                <div
                  key={student.id}
                  className="rounded-xl border border-slate-100 p-3 text-[11px] text-slate-600"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] text-violet-600">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#28315e]">
                        {name}
                      </p>
                      <p className="truncate text-slate-500">
                        {student.user.email}
                      </p>
                    </div>
                    <Status />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-11 text-slate-500">
                    <span>{student.phone || 'Téléphone non renseigné'}</span>
                    <span>{student.city || 'Ville non renseignée'}</span>
                    <span>
                      {student.enrolledYear || 'Année non renseignée'}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewingStudentId(student.id)}
                    >
                      Voir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setStudentToWithdraw(student)}
                    >
                      Clôturer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <Pagination className="mt-5">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    if (page > 1) changePage(page - 1);
                  }}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === page}
                      onClick={(event) => {
                        event.preventDefault();
                        changePage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    if (page < totalPages) changePage(page + 1);
                  }}
                  className={
                    page >= totalPages ? 'pointer-events-none opacity-50' : ''
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </section>
      {bulkReport && (
        <section className="mt-4 rounded-xl border p-4 text-sm">
          <p className="text-emerald-700">
            {bulkReport.succeeded.length} inscription(s) réussie(s)
          </p>
          {bulkReport.failed.map((failure, index) => (
            <p className="mt-1 text-red-700" key={index}>
              {failure.row.email || 'Ligne'} : {failure.reason}
            </p>
          ))}
        </section>
      )}

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <form onSubmit={submitEnrollment}>
            <DialogHeader>
              <DialogTitle>Inscrire un étudiant</DialogTitle>
              <DialogDescription>
                Seuls les comptes étudiant existants peuvent être inscrits. Un
                transfert vers une autre école nécessite une procédure dédiée.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="enroll-email">E-mail de l’étudiant</Label>
                <Input
                  id="enroll-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {academicYears.length === 0 && (
                <p className="text-sm text-red-600">
                  Configurez d’abord une année académique (avec sa période
                  d’inscription) dans{' '}
                  <a className="underline" href="/dashboard/school/settings">
                    Paramètres
                  </a>
                  .
                </p>
              )}
              {programs.length === 0 ? (
                <p className="text-sm text-red-600">
                  Configurez d’abord vos filières dans{' '}
                  <a className="underline" href="/dashboard/school/settings">
                    Paramètres
                  </a>
                  .
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Filière</Label>
                    <Select
                      items={programs.map((program) => ({
                        value: program.id,
                        label: program.name,
                      }))}
                      value={programId}
                      onValueChange={(value) => {
                        setProgramId(value ?? '');
                        setLevel('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une filière" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Niveau</Label>
                    <Select
                      items={Array.from(
                        { length: selectedProgram?.durationYears || 0 },
                        (_, index) => ({
                          value: String(index + 1),
                          label: `Année ${index + 1}`,
                        }),
                      )}
                      value={level}
                      onValueChange={(value) => setLevel(value ?? '')}
                      disabled={!selectedProgram}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: selectedProgram?.durationYears || 0 },
                          (_, index) => (
                            <SelectItem
                              key={index + 1}
                              value={String(index + 1)}
                            >
                              Année {index + 1}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Année académique</Label>
                    <Select
                      items={academicYears.map((year) => ({
                        value: year.id,
                        label: year.label,
                      }))}
                      value={academicYearId}
                      onValueChange={(value) => setAcademicYearId(value ?? '')}
                      disabled={academicYears.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une année" />
                      </SelectTrigger>
                      <SelectContent>
                        {academicYears.map((year) => (
                          <SelectItem key={year.id} value={year.id}>
                            {year.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedYear && notYetOpen && (
                      <p className="text-sm text-amber-600">
                        Les inscriptions pour {selectedYear.label} ouvriront le{' '}
                        {new Date(
                          selectedYear.enrollmentOpensAt,
                        ).toLocaleDateString('fr-FR')}
                        .
                      </p>
                    )}
                    {selectedYear && alreadyClosed && (
                      <p className="text-sm text-red-600">
                        Inscriptions fermées pour {selectedYear.label} depuis le{' '}
                        {new Date(
                          selectedYear.enrollmentClosesAt,
                        ).toLocaleDateString('fr-FR')}
                        .
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEnrollOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  enrolling ||
                  !programId ||
                  !level ||
                  !academicYearId ||
                  !periodOpen
                }
              >
                {enrolling ? 'Inscription...' : 'Inscrire'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={studentToWithdraw !== null}
        onOpenChange={(open) => {
          if (!open && !withdrawingStudent) setStudentToWithdraw(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer l’inscription</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment clôturer l’inscription de{' '}
              {studentToWithdraw && `${studentToWithdraw.firstName} ${studentToWithdraw.lastName}`} ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={withdrawingStudent}
              onClick={() => setStudentToWithdraw(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={withdrawingStudent}
              onClick={() => void withdrawStudent()}
            >
              {withdrawingStudent ? 'Clôture...' : 'Clôturer l’inscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={viewingStudentId !== null}
        onOpenChange={(open) => {
          if (!open && !savingDetail) closeDetailDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fiche étudiant</DialogTitle>
            <DialogDescription>
              {studentDetail
                ? `${studentDetail.firstName} ${studentDetail.lastName}`
                : 'Chargement de la fiche...'}
            </DialogDescription>
          </DialogHeader>
          {loadingDetail || !studentDetail ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Chargement...
            </p>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-400">E-mail</p>
                  <p className="font-semibold text-[#28315e]">
                    {studentDetail.user.email}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Téléphone</p>
                  <p className="font-semibold text-[#28315e]">
                    {studentDetail.phone || 'Non renseigné'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Adresse</p>
                  <p className="font-semibold text-[#28315e]">
                    {studentDetail.address || 'Non renseignée'},{' '}
                    {studentDetail.city || ''} {studentDetail.region || ''}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Baccalauréat</p>
                  <p className="font-semibold text-[#28315e]">
                    {studentDetail.bacType || 'Non renseigné'}
                    {studentDetail.bacYear ? ` (${studentDetail.bacYear})` : ''}
                  </p>
                </div>
              </div>
              {studentDetail.bio && (
                <div>
                  <p className="text-slate-400">Bio</p>
                  <p className="font-semibold text-[#28315e]">
                    {studentDetail.bio}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                <div className="space-y-2">
                  <Label>Programme</Label>
                  <Select
                    items={programs.map((program) => ({
                      value: program.id,
                      label: program.name,
                    }))}
                    value={detailProgramId}
                    onValueChange={(value) => setDetailProgramId(value ?? '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Programme" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Niveau</Label>
                  <Input
                    type="number"
                    min={1}
                    value={detailLevel}
                    onChange={(event) => setDetailLevel(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Année académique</Label>
                  <Select
                    items={academicYears.map((year) => ({
                      value: year.id,
                      label: year.label,
                    }))}
                    value={detailAcademicYearId}
                    onValueChange={(value) => setDetailAcademicYearId(value ?? '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Année" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingDetail}
              onClick={() => closeDetailDialog()}
            >
              Fermer
            </Button>
            <Button
              type="button"
              disabled={savingDetail || loadingDetail || !studentDetail}
              onClick={() => void saveStudentEnrollment()}
            >
              {savingDetail ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Status() {
  return (
    <span className="inline-block rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
      Inscrit
    </span>
  );
}
