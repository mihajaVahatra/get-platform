/**
 * Remédiation (audit QA, 2026-08-03) : `Student` ne portait qu'un seul jeu de
 * champs d'inscription (enrolledSchoolId/programId/programLevel/
 * academicYearId/enrolledYear/enrollmentStatus). Un étudiant accepté dans une
 * 2ᵉ école voyait ces champs écrasés silencieusement par la 2ᵉ école, alors
 * que sa candidature ENROLLED dans la 1ʳᵉ école restait affichée côté école —
 * une inscription "fantôme". La table `student_enrollments` (une ligne par
 * couple étudiant/école) remplace ces champs pour permettre les doubles
 * cursus légitimes (double diplôme).
 *
 * Ce script reconstruit `student_enrollments` à partir d'`Application`
 * (status ACCEPTED/ENROLLED), la seule source qui conserve l'historique
 * complet des inscriptions — contrairement aux anciens champs `Student`, qui
 * ne gardaient que la dernière école écrite. C'est ce qui permet de retrouver
 * une inscription "perdue" comme celle constatée pendant l'audit.
 *
 * En cas de candidatures ACCEPTED/ENROLLED multiples pour la même
 * (étudiant, école), seule la plus récente (decisionDate puis submittedAt)
 * est retenue.
 *
 * Idempotent : upsert par (studentId, schoolId), peut être relancé sans
 * risque.
 *
 * Usage : ts-node prisma/remediation/2026-08-03-backfill-student-enrollments.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function enrollmentLabel(
  programName: string,
  level: number,
  academicYearLabel: string,
): string {
  return `Année ${level} · ${programName} · ${academicYearLabel}`;
}

async function backfill() {
  const applications = await prisma.application.findMany({
    where: {
      status: { in: ['ACCEPTED', 'ENROLLED'] },
      deletedAt: null,
    },
    include: { offer: true },
    orderBy: [{ decisionDate: 'asc' }, { submittedAt: 'asc' }],
  });

  // Une entrée par (studentId, schoolId), la plus récente écrasant les
  // précédentes grâce au tri ci-dessus.
  const latestByStudentSchool = new Map<
    string,
    (typeof applications)[number]
  >();
  for (const application of applications) {
    const key = `${application.studentId}::${application.offer.schoolId}`;
    latestByStudentSchool.set(key, application);
  }

  let created = 0;
  let skipped = 0;

  for (const application of latestByStudentSchool.values()) {
    const { offer } = application;

    if (!offer.programId) {
      console.warn(
        `[non reconstruit] candidature ${application.id} : offre "${offer.title}" sans programme lié.`,
      );
      skipped++;
      continue;
    }

    const [program, academicYear] = await Promise.all([
      prisma.schoolProgram.findFirst({
        where: { id: offer.programId, schoolId: offer.schoolId },
      }),
      prisma.schoolAcademicYear.findFirst({
        where: { schoolId: offer.schoolId, isCurrent: true },
      }),
    ]);

    if (!program || !academicYear) {
      console.warn(
        `[non reconstruit] candidature ${application.id} : programme ou année académique introuvable pour l'école ${offer.schoolId}.`,
      );
      skipped++;
      continue;
    }

    const programLevel = 1;
    const enrolledYear = enrollmentLabel(
      program.name,
      programLevel,
      academicYear.label,
    );

    await prisma.studentEnrollment.upsert({
      where: {
        studentId_schoolId: {
          studentId: application.studentId,
          schoolId: offer.schoolId,
        },
      },
      create: {
        studentId: application.studentId,
        schoolId: offer.schoolId,
        programId: program.id,
        programLevel,
        academicYearId: academicYear.id,
        enrolledYear,
        status: 'ACTIVE',
      },
      update: {
        programId: program.id,
        programLevel,
        academicYearId: academicYear.id,
        enrolledYear,
        status: 'ACTIVE',
      },
    });
    created++;
  }

  console.log(
    `Inscriptions reconstruites : ${created}/${latestByStudentSchool.size} (${skipped} ignorées, à corriger manuellement si besoin).`,
  );
}

backfill()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
