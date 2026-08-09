'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { FileUp, LoaderCircle, UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Course = {
  id: string;
  code: string;
  title: string;
  school: { name: string };
};

type Assignment = {
  id: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  submission: { id: string; submittedAt: string; grade: number | null } | null;
};

export default function AssignmentsPage() {
  const t = useTranslations('StudentAssignments');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadedAssignmentsCourseId, setLoadedAssignmentsCourseId] =
    useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get('/students/me/courses')
      .then((response) => {
        const loadedCourses = response.data.data as Course[];
        setCourses(loadedCourses);
        setSelectedCourseId(loadedCourses[0]?.id ?? '');
      })
      .catch(() => setMessage(t('loadCoursesError')))
      .finally(() => setLoadingCourses(false));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }
    apiClient
      .get(`/students/me/courses/${selectedCourseId}/assignments`)
      .then((response) => {
        setAssignments(response.data.data as Assignment[]);
        setLoadedAssignmentsCourseId(selectedCourseId);
      })
      .catch(() => {
        setAssignments([]);
        setLoadedAssignmentsCourseId(selectedCourseId);
        setMessage(t('loadAssignmentsError'));
      });
  }, [selectedCourseId]);

  const loadingAssignments =
    Boolean(selectedCourseId) && selectedCourseId !== loadedAssignmentsCourseId;

  const uploadSubmission = async (
    assignment: Assignment,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || assignment.submission?.grade != null) return;

    setUploadingId(assignment.id);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(
        `/students/me/assignments/${assignment.id}/submit`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setAssignments((current) =>
        current.map((item) =>
          item.id === assignment.id
            ? {
                ...item,
                submission: {
                  id: item.submission?.id ?? 'submitted',
                  submittedAt: new Date().toISOString(),
                  grade: null,
                },
              }
            : item,
        ),
      );
      setMessage(t('submitSuccess'));
    } catch (error: unknown) {
      const errorMessage = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setMessage(errorMessage ?? t('submitError'));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl text-foreground">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </header>

      {message && (
        <p className="mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 px-4 py-3 text-sm text-indigo-800">
          {message}
        </p>
      )}

      {loadingCourses ? (
        <Loading label={t('loadingCourses')} />
      ) : courses.length === 0 ? (
        <Empty label={t('noCourses')} />
      ) : (
        <>
          <div className="mb-5 max-w-md text-sm font-semibold">
            {t('courseLabel')}
            <Select
              items={courses.map((course) => ({
                value: course.id,
                label: `${course.title} · ${course.school.name}`,
              }))}
              value={selectedCourseId}
              onValueChange={(value) => setSelectedCourseId(value ?? '')}
            >
              <SelectTrigger className="mt-2 w-full rounded-xl">
                <SelectValue placeholder={t('selectCourse')} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title} · {course.school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingAssignments ? (
            <Loading label={t('loadingAssignments')} />
          ) : assignments.length === 0 ? (
            <Empty label={t('noAssignments')} />
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const isGraded = assignment.submission?.grade != null;
                const isLate = Boolean(
                  assignment.dueAt && new Date(assignment.dueAt) < new Date(),
                );
                return (
                  <article
                    key={assignment.id}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-bold">{assignment.title}</h2>
                        {assignment.instructions && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                            {assignment.instructions}
                          </p>
                        )}
                        {assignment.dueAt && (
                          <p
                            className={`mt-3 text-xs font-semibold ${isLate ? 'text-orange-600 dark:text-orange-300' : 'text-muted-foreground'}`}
                          >
                            {t('dueOn', { date: new Date(assignment.dueAt).toLocaleString('fr-FR') })}
                            {isLate ? t('lateAccepted') : ''}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {isGraded ? (
                          <span className="inline-flex rounded-lg bg-emerald-50 dark:bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            {t('graded', { grade: assignment.submission?.grade ?? 0 })}
                          </span>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                            {uploadingId === assignment.id ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : assignment.submission ? (
                              <FileUp className="size-4" />
                            ) : (
                              <UploadCloud className="size-4" />
                            )}
                            {uploadingId === assignment.id
                              ? t('uploading')
                              : assignment.submission
                                ? t('replaceFile')
                                : t('submitFile')}
                            <input
                              type="file"
                              className="sr-only"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              disabled={uploadingId === assignment.id}
                              onChange={(event) => uploadSubmission(assignment, event)}
                            />
                          </label>
                        )}
                        {assignment.submission && !isGraded && (
                          <p className="mt-2 text-right text-xs text-muted-foreground">
                            {t('submittedOn', {
                              date: new Date(assignment.submission.submittedAt).toLocaleString('fr-FR'),
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
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
  return <p className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">{label}</p>;
}
