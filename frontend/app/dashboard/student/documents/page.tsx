'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Download, FileText, LoaderCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DocumentType = 'CV' | 'LETTER' | 'ID' | 'DIPLOMA' | 'PHOTO' | 'OTHER';

type StudentDocument = {
  id: string;
  type: DocumentType;
  name: string;
  fileUrl: string;
  uploadedAt: string;
};

export default function StudentDocumentsPage() {
  const t = useTranslations('StudentDocuments');
  const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    CV: t('documentTypes.CV'),
    LETTER: t('documentTypes.LETTER'),
    ID: t('documentTypes.ID'),
    DIPLOMA: t('documentTypes.DIPLOMA'),
    PHOTO: t('documentTypes.PHOTO'),
    OTHER: t('documentTypes.OTHER'),
  };
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>('CV');
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<StudentDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/students/me/documents');
      setDocuments(response.data.data as StudentDocument[]);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
      setFailed(true);
      toast.error(t('loadErrorToast'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchDocuments());
  }, []);

  const submitUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadFile) return;
    void (async () => {
      try {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('type', uploadType);
        formData.append('name', uploadName || uploadFile.name);
        const response = await apiClient.post(
          '/students/me/documents',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        setDocuments((current) => [
          response.data.data as StudentDocument,
          ...current,
        ]);
        setUploadOpen(false);
        setUploadType('CV');
        setUploadName('');
        setUploadFile(null);
        toast.success(t('addSuccess'));
      } catch (error: unknown) {
        const message = axios.isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message
          : undefined;
        toast.error(message ?? t('addError'));
      } finally {
        setUploading(false);
      }
    })();
  };

  const deleteDocument = async () => {
    if (!documentToDelete) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/students/me/documents/${documentToDelete.id}`);
      setDocuments((current) =>
        current.filter((doc) => doc.id !== documentToDelete.id),
      );
      setDocumentToDelete(null);
      toast.success(t('deleteSuccess'));
    } catch (error) {
      console.error('Erreur suppression document:', error);
      toast.error(t('deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl text-foreground">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <button
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          onClick={(event) => {
            event.preventDefault();
            setUploadOpen(true);
          }}
        >
          {t('addDocument')}
        </button>
      </header>

      {loading ? (
        <Loading label={t('loading')} />
      ) : failed ? (
        <Empty label={t('loadError')} />
      ) : documents.length === 0 ? (
        <Empty label={t('empty')} />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 py-3">
              <FileText className="size-5 shrink-0 text-emerald-500 dark:text-emerald-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{doc.name}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {DOCUMENT_TYPE_LABELS[doc.type]} · {t('addedOn', { date: new Date(doc.uploadedAt).toLocaleDateString('fr-FR') })}
                </p>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={t('download', { name: doc.name })}
                className="min-h-11 min-w-11 rounded p-2 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:bg-indigo-500/15"
              >
                <Download className="size-4" />
              </a>
              <button
                aria-label={t('delete', { name: doc.name })}
                className="min-h-11 min-w-11 rounded p-2 text-muted-foreground hover:bg-rose-50 dark:bg-rose-500/15 hover:text-rose-600 dark:text-rose-300"
                onClick={() => setDocumentToDelete(doc)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <form onSubmit={submitUpload}>
            <DialogHeader>
              <DialogTitle>{t('addDocument')}</DialogTitle>
              <DialogDescription>
                {t('acceptedFormats')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="text-xs font-bold text-[#34406b]">
                {t('documentType')}
                <Select
                  items={Object.entries(DOCUMENT_TYPE_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  value={uploadType}
                  onValueChange={(value) =>
                    value && setUploadType(value as DocumentType)
                  }
                >
                  <SelectTrigger className="mt-1 h-10 w-full font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="text-xs font-bold text-[#34406b]">
                {t('nameOptional')}
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={uploadName}
                  onChange={(event) => setUploadName(event.target.value)}
                  maxLength={160}
                  placeholder={uploadFile?.name}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                {t('fileLabel')} <span className="text-rose-500">*</span>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-[#34406b] hover:bg-slate-50">
                    {t('chooseFile')}
                  </span>
                  <span className="text-[11px] font-normal italic text-muted-foreground">
                    {uploadFile?.name ?? t('noFileChosen')}
                  </span>
                </div>
                <input
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  type="file"
                  required
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setUploadFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={uploading}
              >
                {uploading ? t('adding') : t('add')}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={documentToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDocumentToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteDescription', { name: documentToDelete?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDocumentToDelete(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void deleteDocument()}
            >
              {deleting ? t('deleting') : t('confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">
      {label}
    </p>
  );
}
