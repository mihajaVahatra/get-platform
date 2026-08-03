import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

/**
 * Population nationale de démonstration — réexécutable sans suppression.
 *
 * Démarrage volontairement explicite :
 *   SEED_MODE=national npm run seed:national
 *
 * Toutes les clés, adresses et slugs sont déterministes et préfixés
 * « demo-national ». Un second lancement ignore les lignes déjà créées.
 */

const prisma = new PrismaClient();

const NAMESPACE = 'demo-national-2026';
const ACADEMIC_YEAR_LABEL = '2026-2027 — Démo nationale';
const SCHOOL_SLUG_PREFIX = 'demo-national-2026-';
const DEMO_EMAIL_DOMAIN = 'demo.get.test';
const BATCH_SIZE = 750;
const ENROLLED_STUDENTS = 15_000;
const CANDIDATES = 4_000;

type SchoolDefinition = {
  slug: string;
  name: string;
  city: string;
  region: string;
  type: 'PUBLIC' | 'PRIVATE';
};

type ProgramTemplate = {
  slug: string;
  name: string;
  diploma: string;
  durationYears: number;
  tuitionFees: number;
  department: string;
};

type SchoolRecord = SchoolDefinition & { id: string; index: number };

type ProgramRecord = ProgramTemplate & {
  id: string;
  schoolId: string;
  schoolIndex: number;
  templateIndex: number;
};

type TeacherRecord = {
  id: string;
  userId: string;
  schoolId: string;
  schoolIndex: number;
  schoolTeacherIndex: number;
  teacherSchoolId: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
};

type ClassRecord = {
  id: string;
  schoolId: string;
  programId: string;
  level: number;
  name: string;
  studentCount: number;
};

type EnrolledStudentPlan = {
  id: string;
  userId: string;
  email: string;
  createdAt: Date;
  school: SchoolRecord;
  program: ProgramRecord;
  level: number;
  className: string;
  gender: 'MALE' | 'FEMALE';
  firstName: string;
  lastName: string;
  city: string;
  region: string;
};

type CandidatePlan = {
  id: string;
  userId: string;
  email: string;
  createdAt: Date;
  gender: 'MALE' | 'FEMALE';
  firstName: string;
  lastName: string;
  city: string;
  region: string;
};

const SCHOOL_DEFINITIONS: SchoolDefinition[] = [
  {
    slug: 'universite-antananarivo-ankatso',
    name: 'Université d’Antananarivo — Campus Ankatso',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PUBLIC',
  },
  {
    slug: 'ecole-polytechnique-antananarivo',
    name: 'École Supérieure Polytechnique d’Antananarivo',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-management-madagascar',
    name: 'Institut Supérieur de Management de Madagascar',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PRIVATE',
  },
  {
    slug: 'institut-sciences-techniques-tana',
    name: 'Institut des Sciences et Techniques d’Antananarivo',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PRIVATE',
  },
  {
    slug: 'universite-numerique-madagascar',
    name: 'Université Numérique de Madagascar',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PRIVATE',
  },
  {
    slug: 'ecole-sante-biomedicale-tana',
    name: 'École de Santé et Sciences Biomédicales d’Antananarivo',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PRIVATE',
  },
  {
    slug: 'institut-architecture-urbanisme',
    name: 'Institut d’Architecture et d’Urbanisme de Madagascar',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PUBLIC',
  },
  {
    slug: 'academie-metiers-digital',
    name: 'Académie des Métiers du Digital',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PRIVATE',
  },
  {
    slug: 'ecole-administration-gouvernance',
    name: 'École Nationale d’Administration et de Gouvernance',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-arts-medias-communication',
    name: 'Institut des Arts, Médias et Communication',
    city: 'Antananarivo',
    region: 'Analamanga',
    type: 'PRIVATE',
  },
  {
    slug: 'universite-toamasina',
    name: 'Université de Toamasina — Pôle Sciences et Technologies',
    city: 'Toamasina',
    region: 'Atsinanana',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-ocean-indien-toamasina',
    name: 'Institut de l’Océan Indien et de la Logistique',
    city: 'Toamasina',
    region: 'Atsinanana',
    type: 'PRIVATE',
  },
  {
    slug: 'universite-mahajanga',
    name: 'Université de Mahajanga — Campus Ambondrona',
    city: 'Mahajanga',
    region: 'Boeny',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-agro-environnement-mahajanga',
    name: 'Institut d’Agro-environnement de Mahajanga',
    city: 'Mahajanga',
    region: 'Boeny',
    type: 'PRIVATE',
  },
  {
    slug: 'universite-fianarantsoa',
    name: 'Université de Fianarantsoa — Campus Andrainjato',
    city: 'Fianarantsoa',
    region: 'Haute Matsiatra',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-innovation-fianarantsoa',
    name: 'Institut de l’Innovation et de l’Éducation de Fianarantsoa',
    city: 'Fianarantsoa',
    region: 'Haute Matsiatra',
    type: 'PRIVATE',
  },
  {
    slug: 'universite-toliara',
    name: 'Université de Toliara — Pôle Sud',
    city: 'Toliara',
    region: 'Atsimo-Andrefana',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-tourisme-littoral-toliara',
    name: 'Institut du Tourisme et du Littoral de Toliara',
    city: 'Toliara',
    region: 'Atsimo-Andrefana',
    type: 'PRIVATE',
  },
  {
    slug: 'universite-antsiranana',
    name: 'Université d’Antsiranana — Campus Diego',
    city: 'Antsiranana',
    region: 'Diana',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-maritime-antsiranana',
    name: 'Institut Maritime et Portuaire d’Antsiranana',
    city: 'Antsiranana',
    region: 'Diana',
    type: 'PRIVATE',
  },
  {
    slug: 'universite-antsirabe',
    name: 'Université d’Antsirabe — Vakinankaratra',
    city: 'Antsirabe',
    region: 'Vakinankaratra',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-industrie-antsirabe',
    name: 'Institut Industriel et Technologique d’Antsirabe',
    city: 'Antsirabe',
    region: 'Vakinankaratra',
    type: 'PRIVATE',
  },
  {
    slug: 'ecole-territoires-menabe',
    name: 'École des Territoires et de l’Environnement du Menabe',
    city: 'Morondava',
    region: 'Menabe',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-riziculture-alaotra',
    name: 'Institut de Riziculture et d’Agroéconomie de l’Alaotra',
    city: 'Ambatondrazaka',
    region: 'Alaotra-Mangoro',
    type: 'PUBLIC',
  },
  {
    slug: 'ecole-bleue-vatovavy',
    name: 'École Bleue de Vatovavy',
    city: 'Manakara',
    region: 'Vatovavy',
    type: 'PRIVATE',
  },
  {
    slug: 'institut-sante-atsimo-atsinanana',
    name: 'Institut de Santé Communautaire du Sud-Est',
    city: 'Farafangana',
    region: 'Atsimo-Atsinanana',
    type: 'PUBLIC',
  },
  {
    slug: 'institut-biodiversite-sava',
    name: 'Institut de Biodiversité et des Épices de la Sava',
    city: 'Sambava',
    region: 'Sava',
    type: 'PRIVATE',
  },
  {
    slug: 'ecole-humanites-amoronimania',
    name: 'École des Humanités et des Services d’Amoron’i Mania',
    city: 'Ambositra',
    region: "Amoron'i Mania",
    type: 'PUBLIC',
  },
];

const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    slug: 'informatique-sciences-donnees',
    name: 'Informatique et Sciences des Données',
    diploma: 'Licence',
    durationYears: 3,
    tuitionFees: 2_800_000,
    department: 'Informatique',
  },
  {
    slug: 'gestion-management',
    name: 'Gestion et Management des Organisations',
    diploma: 'Licence',
    durationYears: 3,
    tuitionFees: 2_400_000,
    department: 'Management',
  },
  {
    slug: 'genie-civil-infrastructures',
    name: 'Génie Civil et Infrastructures',
    diploma: 'Ingénieur',
    durationYears: 5,
    tuitionFees: 3_600_000,
    department: 'Ingénierie',
  },
  {
    slug: 'sciences-economiques-finance',
    name: 'Sciences Économiques et Finance',
    diploma: 'Licence',
    durationYears: 3,
    tuitionFees: 2_300_000,
    department: 'Économie',
  },
  {
    slug: 'sciences-sante',
    name: 'Sciences de la Santé et Santé Publique',
    diploma: 'Licence',
    durationYears: 3,
    tuitionFees: 3_100_000,
    department: 'Santé',
  },
  {
    slug: 'droit-administration',
    name: 'Droit, Administration et Politiques Publiques',
    diploma: 'Licence',
    durationYears: 3,
    tuitionFees: 2_200_000,
    department: 'Droit et gouvernance',
  },
];

const SUBJECTS = [
  'Fondements et méthodologie',
  'Outils numériques',
  'Communication professionnelle',
  'Statistiques appliquées',
  'Économie et société',
  'Projet tutoré',
  'Analyse des systèmes',
  'Gestion de projet',
  'Droit et éthique',
  'Recherche documentaire',
  'Innovation et entrepreneuriat',
  'Pratique professionnelle',
  'Atelier de spécialisation',
  'Études de cas',
  'Laboratoire appliqué',
  'Transition écologique',
  'Anglais professionnel',
  'Mémoire et insertion',
] as const;

const FIRST_NAMES_FEMALE = [
  'Aina',
  'Fara',
  'Hasina',
  'Lalao',
  'Mialy',
  'Niry',
  'Saholy',
  'Tiana',
  'Voahangy',
  'Zo',
] as const;

const FIRST_NAMES_MALE = [
  'Andry',
  'Feno',
  'Hery',
  'Kanto',
  'Mamy',
  'Njaka',
  'Rado',
  'Tahina',
  'Toky',
  'Zo',
] as const;

const LAST_NAMES = [
  'Andrianina',
  'Andriamihaja',
  'Raharison',
  'Rajaonarivelo',
  'Rakoto',
  'Rakotondrabe',
  'Ramanantsoa',
  'Randriamihaja',
  'Rasolonjatovo',
  'Razanakoto',
  'Ravelomanana',
  'Razanamasy',
] as const;

function stableId(type: string, value: string | number): string {
  const hash = createHash('sha256')
    .update(`${NAMESPACE}:${type}:${value}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(
    13,
    16,
  )}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function chunks<T>(items: T[], size = BATCH_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function createInBatches<T>(
  items: T[],
  create: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (const batch of chunks(items)) {
    await create(batch);
  }
}

async function assertPersistedIds(
  label: string,
  expectedIds: string[],
  load: (ids: string[]) => Promise<{ id: string }[]>,
): Promise<void> {
  const foundIds = new Set<string>();
  for (const batch of chunks(expectedIds)) {
    const rows = await load(batch);
    for (const row of rows) foundIds.add(row.id);
  }
  const missing = expectedIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `État de seed national incompatible : ${missing.length} ${label} introuvable(s). ` +
        'Le seed est arrêté afin d’éviter des relations incohérentes.',
    );
  }
}

async function reconcileStudentCreatedAt(
  students: Array<{ id: string; createdAt: Date }>,
): Promise<void> {
  const idsByDate = new Map<string, { date: Date; ids: string[] }>();
  for (const student of students) {
    const key = student.createdAt.toISOString();
    const group = idsByDate.get(key) || { date: student.createdAt, ids: [] };
    group.ids.push(student.id);
    idsByDate.set(key, group);
  }
  for (const { date, ids } of idsByDate.values()) {
    await prisma.student.updateMany({
      where: { id: { in: ids } },
      data: { createdAt: date },
    });
  }
}

function identity(index: number): {
  gender: 'MALE' | 'FEMALE';
  firstName: string;
  lastName: string;
} {
  const gender = index % 2 === 0 ? 'FEMALE' : 'MALE';
  const firstNames =
    gender === 'FEMALE' ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE;
  return {
    gender,
    firstName: firstNames[index % firstNames.length],
    lastName: LAST_NAMES[Math.floor(index / 3) % LAST_NAMES.length],
  };
}

function distributedDate(index: number, spanDays: number, start: Date): Date {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + ((index * 17) % spanDays));
  return date;
}

function assertSafeExecutionTarget(): void {
  if (process.env.SEED_MODE !== 'national') {
    throw new Error(
      'Seed national bloqué. Exécutez explicitement : SEED_MODE=national npm run seed:national',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Le seed national est interdit en environnement de production.',
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('DATABASE_URL est requis pour le seed national.');
  const database = new URL(databaseUrl);
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(database.hostname)) {
    throw new Error(
      `Le seed national refuse la base distante « ${database.hostname} ».`,
    );
  }
}

async function main(): Promise<void> {
  assertSafeExecutionTarget();
  console.time('Population nationale');
  console.log('🌱 Population nationale de démonstration : démarrage');

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: { name: 'STUDENT', description: 'Étudiant', isDefault: true },
  });
  const teacherRole = await prisma.role.upsert({
    where: { name: 'TEACHER' },
    update: {},
    create: { name: 'TEACHER', description: 'Professeur' },
  });
  const schoolAdminRole = await prisma.role.upsert({
    where: { name: 'SCHOOL_ADMIN' },
    update: {},
    create: { name: 'SCHOOL_ADMIN', description: "Administrateur d'école" },
  });
  const ministryRole = await prisma.role.upsert({
    where: { name: 'MINISTRY' },
    update: {},
    create: { name: 'MINISTRY', description: 'Administrateur Ministère' },
  });
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN_GET' },
    update: {},
    create: { name: 'ADMIN_GET', description: 'Administrateur plateforme' },
  });

  const demoPassword = await bcrypt.hash('DemoNational2026!', 10);
  await Promise.all([
    prisma.user.upsert({
      where: { email: `ministere.national@${DEMO_EMAIL_DOMAIN}` },
      update: {
        password: demoPassword,
        roleId: ministryRole.id,
        isActive: true,
        isVerified: true,
      },
      create: {
        id: stableId('user', 'ministry'),
        email: `ministere.national@${DEMO_EMAIL_DOMAIN}`,
        password: demoPassword,
        roleId: ministryRole.id,
        isActive: true,
        isVerified: true,
        gender: 'FEMALE',
      },
    }),
    prisma.user.upsert({
      where: { email: `admin.national@${DEMO_EMAIL_DOMAIN}` },
      update: {
        password: demoPassword,
        roleId: adminRole.id,
        isActive: true,
        isVerified: true,
      },
      create: {
        id: stableId('user', 'admin'),
        email: `admin.national@${DEMO_EMAIL_DOMAIN}`,
        password: demoPassword,
        roleId: adminRole.id,
        isActive: true,
        isVerified: true,
        gender: 'MALE',
      },
    }),
  ]);

  const schools = await Promise.all(
    SCHOOL_DEFINITIONS.map(async (definition, index) => {
      const slug = `${SCHOOL_SLUG_PREFIX}${definition.slug}`;
      const contactEmail = `contact.${String(index + 1).padStart(2, '0')}@${DEMO_EMAIL_DOMAIN}`;
      const school = await prisma.school.upsert({
        where: { slug },
        update: {
          name: definition.name,
          city: definition.city,
          region: definition.region,
          type: definition.type,
          description: `Établissement de démonstration national — ${definition.name}.`,
          contactEmail,
          contactPhone: `+261 34 ${String(10 + index).padStart(2, '0')} 20 ${String(
            10 + index,
          ).padStart(2, '0')}`,
          website: `https://${slug}.${DEMO_EMAIL_DOMAIN}`,
          isActive: true,
          deletedAt: null,
        },
        create: {
          id: stableId('school', definition.slug),
          slug,
          name: definition.name,
          city: definition.city,
          region: definition.region,
          country: 'Madagascar',
          type: definition.type,
          description: `Établissement de démonstration national — ${definition.name}.`,
          contactEmail,
          contactPhone: `+261 34 ${String(10 + index).padStart(2, '0')} 20 ${String(
            10 + index,
          ).padStart(2, '0')}`,
          website: `https://${slug}.${DEMO_EMAIL_DOMAIN}`,
          isActive: true,
        },
      });
      return { ...definition, id: school.id, index };
    }),
  );

  const academicYear = await prisma.academicYear.upsert({
    where: { label: ACADEMIC_YEAR_LABEL },
    update: { isCurrent: true },
    create: {
      id: stableId('academic-year', ACADEMIC_YEAR_LABEL),
      label: ACADEMIC_YEAR_LABEL,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2027-07-31T23:59:59.999Z'),
      isCurrent: true,
    },
  });
  const schoolAcademicYears = await Promise.all(
    schools.map((school) =>
      prisma.schoolAcademicYear.upsert({
        where: { schoolId_label: { schoolId: school.id, label: '2026-2027' } },
        update: {
          enrollmentOpensAt: new Date('2026-01-15T00:00:00.000Z'),
          enrollmentClosesAt: new Date('2026-10-15T23:59:59.999Z'),
          isCurrent: true,
        },
        create: {
          id: stableId('school-academic-year', school.id),
          schoolId: school.id,
          label: '2026-2027',
          enrollmentOpensAt: new Date('2026-01-15T00:00:00.000Z'),
          enrollmentClosesAt: new Date('2026-10-15T23:59:59.999Z'),
          isCurrent: true,
        },
      }),
    ),
  );
  const schoolAcademicYearBySchool = new Map(
    schoolAcademicYears.map((year) => [year.schoolId, year.id]),
  );
  const schoolAcademicYearId = (schoolId: string): string => {
    const id = schoolAcademicYearBySchool.get(schoolId);
    if (!id) throw new Error('Année académique établissement introuvable');
    return id;
  };

  const programs: ProgramRecord[] = schools.flatMap((school) =>
    PROGRAM_TEMPLATES.map((template, templateIndex) => ({
      ...template,
      id: stableId('program', `${school.id}:${template.slug}`),
      schoolId: school.id,
      schoolIndex: school.index,
      templateIndex,
    })),
  );
  await createInBatches(programs, (batch) =>
    prisma.schoolProgram.createMany({
      data: batch.map((program) => ({
        id: program.id,
        schoolId: program.schoolId,
        name: program.name,
        diploma: program.diploma,
        durationYears: program.durationYears,
        isActive: true,
      })),
      skipDuplicates: true,
    }),
  );
  await assertPersistedIds(
    'programme(s)',
    programs.map((program) => program.id),
    (ids) =>
      prisma.schoolProgram.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );

  const rooms = schools.flatMap((school) =>
    Array.from({ length: 10 }, (_, roomIndex) => ({
      id: stableId('room', `${school.id}:${roomIndex}`),
      schoolId: school.id,
      name:
        roomIndex < 2
          ? `Amphithéâtre ${roomIndex + 1}`
          : `Salle ${roomIndex - 1}`,
      capacity: roomIndex < 2 ? 220 : 45 + roomIndex * 5,
      type: roomIndex < 2 ? 'AMPHITHEATRE' : 'STANDARD',
      isActive: true,
    })),
  );
  await createInBatches(rooms, (batch) =>
    prisma.room.createMany({ data: batch, skipDuplicates: true }),
  );
  const timeSlots = schools.flatMap((school) =>
    Array.from({ length: 5 }, (_, dayOffset) =>
      ['08:00', '10:00', '14:00', '16:00'].map((startTime, slotIndex) => ({
        id: stableId('time-slot', `${school.id}:${dayOffset + 1}:${startTime}`),
        schoolId: school.id,
        dayOfWeek: dayOffset + 1,
        startTime,
        endTime:
          slotIndex === 3
            ? '18:00'
            : `${String(Number(startTime.slice(0, 2)) + 2).padStart(2, '0')}:00`,
        label: `Créneau ${dayOffset + 1}-${slotIndex + 1}`,
        isActive: true,
      })),
    ).flat(),
  );
  await createInBatches(timeSlots, (batch) =>
    prisma.schoolTimeSlot.createMany({ data: batch, skipDuplicates: true }),
  );
  const subjects = schools.flatMap((school) =>
    SUBJECTS.map((name, subjectIndex) => ({
      id: stableId('subject', `${school.id}:${subjectIndex}`),
      schoolId: school.id,
      name,
      isActive: true,
    })),
  );
  await createInBatches(subjects, (batch) =>
    prisma.schoolSubject.createMany({ data: batch, skipDuplicates: true }),
  );
  await assertPersistedIds(
    'matière(s)',
    subjects.map((subject) => subject.id),
    (ids) =>
      prisma.schoolSubject.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );
  const subjectId = (schoolIndex: number, subjectIndex: number) =>
    stableId('subject', `${schools[schoolIndex].id}:${subjectIndex}`);

  const programBySchoolTemplate = new Map(
    programs.map((program) => [
      `${program.schoolIndex}:${program.templateIndex}`,
      program,
    ]),
  );
  const classCounts = new Map<string, number>();
  const enrolledPlans: EnrolledStudentPlan[] = [];
  for (let index = 0; index < ENROLLED_STUDENTS; index += 1) {
    const schoolIndex = index % schools.length;
    const school = schools[schoolIndex];
    const cohort = Math.floor(index / schools.length);
    const templateIndex = cohort % PROGRAM_TEMPLATES.length;
    const program = programBySchoolTemplate.get(
      `${schoolIndex}:${templateIndex}`,
    );
    if (!program) throw new Error('Programme national introuvable');
    const level =
      (Math.floor(cohort / PROGRAM_TEMPLATES.length) % program.durationYears) +
      1;
    const classKey = `${program.id}:${level}`;
    classCounts.set(classKey, (classCounts.get(classKey) || 0) + 1);
    const person = identity(index);
    const home = schools[(index * 11 + 3) % schools.length];
    enrolledPlans.push({
      id: stableId('student-enrolled', index),
      userId: stableId('user-enrolled', index),
      email: `etu.national.${String(index + 1).padStart(5, '0')}@${DEMO_EMAIL_DOMAIN}`,
      createdAt: distributedDate(
        index,
        520,
        new Date('2025-01-15T00:00:00.000Z'),
      ),
      school,
      program,
      level,
      className: `L${level} — ${program.name}`,
      ...person,
      city: home.city,
      region: home.region,
    });
  }
  const classes: ClassRecord[] = programs.flatMap((program) =>
    Array.from({ length: program.durationYears }, (_, levelOffset) => {
      const level = levelOffset + 1;
      const key = `${program.id}:${level}`;
      return {
        id: stableId('class', key),
        schoolId: program.schoolId,
        programId: program.id,
        level,
        name: `L${level} — ${program.name}`,
        studentCount: classCounts.get(key) || 0,
      };
    }),
  );
  await createInBatches(classes, (batch) =>
    prisma.schoolClass.createMany({
      data: batch.map((schoolClass) => ({
        id: schoolClass.id,
        schoolId: schoolClass.schoolId,
        academicYearId: academicYear.id,
        programId: schoolClass.programId,
        name: schoolClass.name,
        level: schoolClass.level,
        studentCount: schoolClass.studentCount,
        isActive: true,
      })),
      skipDuplicates: true,
    }),
  );
  await assertPersistedIds(
    'classe(s)',
    classes.map((schoolClass) => schoolClass.id),
    (ids) =>
      prisma.schoolClass.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );

  const teacherCounts = schools.map((_, index) => (index < 20 ? 11 : 10));
  const teachers: TeacherRecord[] = [];
  let globalTeacherIndex = 0;
  for (const school of schools) {
    for (
      let schoolTeacherIndex = 0;
      schoolTeacherIndex < teacherCounts[school.index];
      schoolTeacherIndex += 1
    ) {
      const person = identity(globalTeacherIndex + 5_000);
      const teacherId = stableId('teacher', globalTeacherIndex);
      teachers.push({
        id: teacherId,
        userId: stableId('user-teacher', globalTeacherIndex),
        schoolId: school.id,
        schoolIndex: school.index,
        schoolTeacherIndex,
        teacherSchoolId: stableId(
          'teacher-school',
          `${teacherId}:${school.id}`,
        ),
        ...person,
      });
      globalTeacherIndex += 1;
    }
  }
  const schoolAdminUsers = schools.map((school) => ({
    id: stableId('user-school-admin', school.id),
    email: `admin.ecole.${String(school.index + 1).padStart(2, '0')}@${DEMO_EMAIL_DOMAIN}`,
    password: demoPassword,
    roleId: schoolAdminRole.id,
    isActive: true,
    isVerified: true,
    gender: school.index % 2 === 0 ? 'FEMALE' : 'MALE',
  }));
  const teacherUsers = teachers.map((teacher) => ({
    id: teacher.userId,
    email: `prof.national.${String(teacher.schoolIndex * 11 + teacher.schoolTeacherIndex + 1).padStart(3, '0')}@${DEMO_EMAIL_DOMAIN}`,
    password: demoPassword,
    roleId: teacherRole.id,
    isActive: true,
    isVerified: true,
    gender: teacher.gender,
  }));
  const candidatePlans: CandidatePlan[] = Array.from(
    { length: CANDIDATES },
    (_, index) => {
      const person = identity(index + 20_000);
      const home = schools[(index * 13 + 7) % schools.length];
      return {
        id: stableId('student-candidate', index),
        userId: stableId('user-candidate', index),
        email: `candidat.national.${String(index + 1).padStart(5, '0')}@${DEMO_EMAIL_DOMAIN}`,
        createdAt: distributedDate(
          index * 2,
          520,
          new Date('2025-01-15T00:00:00.000Z'),
        ),
        ...person,
        city: home.city,
        region: home.region,
      };
    },
  );
  const studentUsers = [
    ...enrolledPlans.map((student) => ({
      id: student.userId,
      email: student.email,
      password: demoPassword,
      roleId: studentRole.id,
      isActive: true,
      isVerified: true,
      gender: student.gender,
    })),
    ...candidatePlans.map((candidate) => ({
      id: candidate.userId,
      email: candidate.email,
      password: demoPassword,
      roleId: studentRole.id,
      isActive: true,
      isVerified: Number.parseInt(candidate.id.slice(-1), 16) % 2 === 0,
      gender: candidate.gender,
    })),
  ];
  await createInBatches(
    [...schoolAdminUsers, ...teacherUsers, ...studentUsers],
    (batch) => prisma.user.createMany({ data: batch, skipDuplicates: true }),
  );
  await assertPersistedIds(
    'compte(s) utilisateur',
    [...schoolAdminUsers, ...teacherUsers, ...studentUsers].map(
      (user) => user.id,
    ),
    (ids) =>
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );
  await createInBatches(teachers, (batch) =>
    prisma.teacher.createMany({
      data: batch.map((teacher) => ({
        id: teacher.id,
        userId: teacher.userId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        phone: `+261 34 ${String(teacher.schoolIndex + 10).padStart(2, '0')} ${String(
          teacher.schoolTeacherIndex + 10,
        ).padStart(
          2,
          '0',
        )} ${String(teacher.schoolTeacherIndex + 20).padStart(2, '0')}`,
      })),
      skipDuplicates: true,
    }),
  );
  await assertPersistedIds(
    'professeur(s)',
    teachers.map((teacher) => teacher.id),
    (ids) =>
      prisma.teacher.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );
  await createInBatches(teachers, (batch) =>
    prisma.teacherSchool.createMany({
      data: batch.map((teacher) => ({
        id: teacher.teacherSchoolId,
        teacherId: teacher.id,
        schoolId: teacher.schoolId,
        department:
          PROGRAM_TEMPLATES[
            teacher.schoolTeacherIndex % PROGRAM_TEMPLATES.length
          ].department,
        specialty: SUBJECTS[teacher.schoolTeacherIndex % SUBJECTS.length],
        isActive: true,
      })),
      skipDuplicates: true,
    }),
  );
  await assertPersistedIds(
    'affectation(s) professeur',
    teachers.map((teacher) => teacher.teacherSchoolId),
    (ids) =>
      prisma.teacherSchool.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );
  await createInBatches(schools, (batch) =>
    prisma.schoolAdmin.createMany({
      data: batch.map((school) => ({
        id: stableId('school-admin', school.id),
        userId: stableId('user-school-admin', school.id),
        schoolId: school.id,
        permissions: ['OFFERS_MANAGE', 'STUDENTS_MANAGE', 'COURSES_MANAGE'],
      })),
      skipDuplicates: true,
    }),
  );

  const teachersBySchool = new Map<string, TeacherRecord[]>();
  for (const teacher of teachers) {
    const schoolTeachers = teachersBySchool.get(teacher.schoolId) || [];
    schoolTeachers.push(teacher);
    teachersBySchool.set(teacher.schoolId, schoolTeachers);
  }
  const classByProgramLevel = new Map(
    classes.map((schoolClass) => [
      `${schoolClass.programId}:${schoolClass.level}`,
      schoolClass,
    ]),
  );
  const subjectRequirements: {
    id: string;
    schoolId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    teacherSchoolId: string;
    courseIndex: number;
  }[] = [];
  const courses: {
    id: string;
    schoolId: string;
    teacherId: string;
    code: string;
    title: string;
    description: string;
    level: string;
    subjectId: string;
    programId: string;
    programLevel: number;
    group: string;
    credits: number;
    room: string;
    schedule: string;
    subjectRequirementId: string;
  }[] = [];
  const courseIdsByProgramLevel = new Map<string, string[]>();
  const teacherQualifications = new Map<
    string,
    { id: string; teacherSchoolId: string; subjectId: string }
  >();
  for (const program of programs) {
    const schoolTeachers = teachersBySchool.get(program.schoolId);
    if (!schoolTeachers?.length)
      throw new Error('Aucun professeur pour une école');
    for (let courseIndex = 0; courseIndex < SUBJECTS.length; courseIndex += 1) {
      const level = (courseIndex % program.durationYears) + 1;
      const schoolClass = classByProgramLevel.get(`${program.id}:${level}`);
      if (!schoolClass) throw new Error('Classe nationale introuvable');
      const teacher =
        schoolTeachers[
          (program.templateIndex * SUBJECTS.length + courseIndex) %
            schoolTeachers.length
        ];
      const requirementId = stableId(
        'subject-requirement',
        `${program.id}:${courseIndex}`,
      );
      const courseId = stableId('course', `${program.id}:${courseIndex}`);
      const subject = subjectId(program.schoolIndex, courseIndex);
      subjectRequirements.push({
        id: requirementId,
        schoolId: program.schoolId,
        classId: schoolClass.id,
        subjectId: subject,
        teacherId: teacher.id,
        teacherSchoolId: teacher.teacherSchoolId,
        courseIndex,
      });
      const qualificationKey = `${teacher.teacherSchoolId}:${subject}`;
      teacherQualifications.set(qualificationKey, {
        id: stableId('teacher-school-subject', qualificationKey),
        teacherSchoolId: teacher.teacherSchoolId,
        subjectId: subject,
      });
      const room =
        courseIndex % 7 === 0
          ? 'Amphithéâtre 1'
          : `Salle ${(courseIndex % 8) + 1}`;
      const day = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'][courseIndex % 5];
      const start = ['08:00', '10:00', '14:00', '16:00'][
        Math.floor(courseIndex / 5) % 4
      ];
      courses.push({
        id: courseId,
        schoolId: program.schoolId,
        teacherId: teacher.id,
        code: `NAT-${String(program.schoolIndex + 1).padStart(2, '0')}-${String(
          program.templateIndex + 1,
        ).padStart(2, '0')}-${String(courseIndex + 1).padStart(2, '0')}`,
        title: `${SUBJECTS[courseIndex]} — ${program.name}`,
        description: `Cours national de démonstration : ${SUBJECTS[courseIndex]} pour la filière ${program.name}.`,
        level: `Niveau ${level}`,
        subjectId: subject,
        programId: program.id,
        programLevel: level,
        group: 'Groupe A',
        credits: courseIndex % 3 === 0 ? 5 : 4,
        room,
        schedule: `${day} ${start} – ${String(Number(start.slice(0, 2)) + 2).padStart(2, '0')}:00`,
        subjectRequirementId: requirementId,
      });
      const coursePoolKey = `${program.id}:${level}`;
      const coursePool = courseIdsByProgramLevel.get(coursePoolKey) || [];
      coursePool.push(courseId);
      courseIdsByProgramLevel.set(coursePoolKey, coursePool);
    }
  }
  await createInBatches(subjectRequirements, (batch) =>
    prisma.subjectRequirement.createMany({
      data: batch.map((requirement) => ({
        id: requirement.id,
        schoolId: requirement.schoolId,
        academicYearId: academicYear.id,
        classId: requirement.classId,
        subjectId: requirement.subjectId,
        hoursPerWeek: requirement.courseIndex % 3 === 0 ? 4 : 3,
      })),
      skipDuplicates: true,
    }),
  );
  await assertPersistedIds(
    'besoin(s) pédagogique(s)',
    subjectRequirements.map((requirement) => requirement.id),
    (ids) =>
      prisma.subjectRequirement.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );
  await createInBatches([...teacherQualifications.values()], (batch) =>
    prisma.teacherSchoolSubject.createMany({
      data: batch,
      skipDuplicates: true,
    }),
  );
  await createInBatches(subjectRequirements, (batch) =>
    prisma.teacherAssignment.createMany({
      data: batch.map((requirement) => ({
        id: stableId('teacher-assignment', requirement.id),
        subjectRequirementId: requirement.id,
        teacherId: requirement.teacherId,
      })),
      skipDuplicates: true,
    }),
  );
  await createInBatches(courses, (batch) =>
    prisma.course.createMany({ data: batch, skipDuplicates: true }),
  );
  await assertPersistedIds(
    'cours',
    courses.map((course) => course.id),
    (ids) =>
      prisma.course.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );

  await createInBatches(enrolledPlans, (batch) =>
    prisma.student.createMany({
      data: batch.map((student, index) => ({
        id: student.id,
        userId: student.userId,
        firstName: student.firstName,
        lastName: student.lastName,
        createdAt: student.createdAt,
        birthDate: new Date(
          Date.UTC(1998 + (index % 7), index % 12, (index % 27) + 1),
        ),
        bacYear: 2021 + (index % 5),
        bacType: ['Série C', 'Série D', 'Série S'][index % 3],
        city: student.city,
        region: student.region,
        country: 'Madagascar',
        interests: [student.program.name],
        skills: ['Communication', 'Travail en équipe'],
        aspirations: ['Insertion professionnelle'],
        profileCompleted: true,
        enrolledSchoolId: student.school.id,
        enrolledYear: student.className,
        enrollmentStatus: 'ACTIVE',
        programId: student.program.id,
        programLevel: student.level,
        academicYearId: schoolAcademicYearId(student.school.id),
      })),
      skipDuplicates: true,
    }),
  );
  await createInBatches(candidatePlans, (batch) =>
    prisma.student.createMany({
      data: batch.map((candidate, index) => ({
        id: candidate.id,
        userId: candidate.userId,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        createdAt: candidate.createdAt,
        birthDate: new Date(
          Date.UTC(2001 + (index % 5), index % 12, (index % 27) + 1),
        ),
        bacYear: 2024 + (index % 2),
        bacType: ['Série C', 'Série D', 'Série L'][index % 3],
        city: candidate.city,
        region: candidate.region,
        country: 'Madagascar',
        interests: [],
        skills: [],
        aspirations: ['Choisir une formation adaptée'],
        profileCompleted: index % 3 !== 0,
        enrollmentStatus: 'APPLICANT',
      })),
      skipDuplicates: true,
    }),
  );
  await assertPersistedIds(
    'étudiant(s)',
    [...enrolledPlans, ...candidatePlans].map((student) => student.id),
    (ids) =>
      prisma.student.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );
  await reconcileStudentCreatedAt([...enrolledPlans, ...candidatePlans]);

  const offers = programs.map((program) => ({
    id: stableId('offer', program.id),
    schoolId: program.schoolId,
    title: program.name,
    slug: `${SCHOOL_SLUG_PREFIX}${schools[program.schoolIndex].slug}-${program.slug}`,
    description: `Offre d’admission nationale pour ${program.name}.`,
    diploma: program.diploma,
    programId: program.id,
    duration: program.durationYears * 12,
    tuitionFees: program.tuitionFees,
    currency: 'MGA',
    prerequisites: ['Baccalauréat ou équivalent', 'Dossier complet'],
    capacity: 180,
    applicationDeadline: new Date('2026-10-15T23:59:59.999Z'),
    academicYear: '2026-2027',
    isOpen: true,
    isFeatured: program.templateIndex === 0,
  }));
  await createInBatches(offers, (batch) =>
    prisma.offer.createMany({ data: batch, skipDuplicates: true }),
  );
  await assertPersistedIds(
    'offre(s)',
    offers.map((offer) => offer.id),
    (ids) =>
      prisma.offer.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      }),
  );
  const offerByProgramId = new Map(
    offers.map((offer) => [offer.programId, offer.id]),
  );
  const applications: {
    id: string;
    studentId: string;
    offerId: string;
    status: string;
    score: number | null;
    submittedAt: Date;
    decisionDate: Date | null;
  }[] = [];
  for (const [index, student] of enrolledPlans.entries()) {
    const offerId = offerByProgramId.get(student.program.id);
    if (!offerId) throw new Error('Offre nationale introuvable');
    const submittedAt = distributedDate(
      index,
      520,
      new Date('2025-01-15T00:00:00.000Z'),
    );
    applications.push({
      id: stableId('application-enrolled', student.id),
      studentId: student.id,
      offerId,
      status: index % 4 === 0 ? 'ENROLLED' : 'ACCEPTED',
      score: 11 + (index % 9),
      submittedAt,
      decisionDate: new Date(submittedAt.getTime() + 21 * 86_400_000),
    });
  }
  const candidateStatuses = [
    'PENDING',
    'UNDER_REVIEW',
    'TEST_SCHEDULED',
    'INTERVIEW_SCHEDULED',
    'PRESELECTED',
    'WAITLISTED',
    'REJECTED',
  ];
  for (const [index, candidate] of candidatePlans.entries()) {
    for (let choice = 0; choice < 2; choice += 1) {
      const offer = offers[(index * 11 + choice * 37) % offers.length];
      const status =
        candidateStatuses[(index + choice * 3) % candidateStatuses.length];
      const submittedAt = distributedDate(
        index * 2 + choice,
        520,
        new Date('2025-01-15T00:00:00.000Z'),
      );
      applications.push({
        id: stableId('application-candidate', `${candidate.id}:${choice}`),
        studentId: candidate.id,
        offerId: offer.id,
        status,
        score: status === 'REJECTED' ? 7 + (index % 4) : null,
        submittedAt,
        decisionDate:
          status === 'REJECTED'
            ? new Date(submittedAt.getTime() + 30 * 86_400_000)
            : null,
      });
    }
  }
  await createInBatches(applications, (batch) =>
    prisma.application.createMany({ data: batch, skipDuplicates: true }),
  );

  const courseEnrollments: {
    id: string;
    courseId: string;
    studentId: string;
  }[] = [];
  for (const student of enrolledPlans) {
    const coursePool =
      courseIdsByProgramLevel.get(`${student.program.id}:${student.level}`) ||
      [];
    for (const courseId of coursePool.slice(0, 4)) {
      courseEnrollments.push({
        id: stableId('course-enrollment', `${courseId}:${student.id}`),
        courseId,
        studentId: student.id,
      });
    }
  }
  await createInBatches(courseEnrollments, (batch) =>
    prisma.courseEnrollment.createMany({ data: batch, skipDuplicates: true }),
  );

  const subscriptions = schools.map((school) => ({
    id: stableId('subscription', school.id),
    schoolId: school.id,
    plan: school.type === 'PUBLIC' ? 'INSTITUTIONAL' : 'PREMIUM',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.999Z'),
    isActive: true,
    amount: school.type === 'PUBLIC' ? 0 : 1_200_000,
    paymentStatus: school.type === 'PUBLIC' ? 'EXEMPTED' : 'PAID',
  }));
  await createInBatches(subscriptions, (batch) =>
    prisma.schoolSubscription.createMany({ data: batch, skipDuplicates: true }),
  );
  const compliance = schools.flatMap((school) => [
    {
      id: stableId('compliance', `${school.id}:historical`),
      schoolId: school.id,
      checkType: 'REGULAR',
      status: school.index % 4 === 0 ? 'ACTION_REQUIRED' : 'COMPLIANT',
      score: 68 + (school.index % 20),
      remarks: 'Contrôle historique de démonstration.',
      checkedAt: new Date('2025-09-15T00:00:00.000Z'),
    },
    {
      id: stableId('compliance', `${school.id}:current`),
      schoolId: school.id,
      checkType: 'REGULAR',
      status: school.index % 5 === 0 ? 'FOLLOW_UP' : 'COMPLIANT',
      score: 78 + (school.index % 18),
      remarks: 'État courant de démonstration au niveau établissement.',
      checkedAt: new Date('2026-07-15T00:00:00.000Z'),
    },
  ]);
  await createInBatches(compliance, (batch) =>
    prisma.complianceCheck.createMany({ data: batch, skipDuplicates: true }),
  );

  const [
    schoolCount,
    programCount,
    courseCount,
    teacherCount,
    classCount,
    enrolledCount,
    candidateCount,
    applicationCount,
    enrollmentCount,
  ] = await Promise.all([
    prisma.school.count({
      where: { slug: { startsWith: SCHOOL_SLUG_PREFIX } },
    }),
    prisma.schoolProgram.count({
      where: { school: { slug: { startsWith: SCHOOL_SLUG_PREFIX } } },
    }),
    prisma.course.count({
      where: { school: { slug: { startsWith: SCHOOL_SLUG_PREFIX } } },
    }),
    prisma.teacher.count({
      where: { user: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } },
    }),
    prisma.schoolClass.count({
      where: { school: { slug: { startsWith: SCHOOL_SLUG_PREFIX } } },
    }),
    prisma.student.count({
      where: {
        user: { email: { startsWith: 'etu.national.' } },
        enrolledSchoolId: { not: null },
      },
    }),
    prisma.student.count({
      where: {
        user: { email: { startsWith: 'candidat.national.' } },
        enrolledSchoolId: null,
      },
    }),
    prisma.application.count({
      where: {
        student: { user: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } },
      },
    }),
    prisma.courseEnrollment.count({
      where: { student: { user: { email: { startsWith: 'etu.national.' } } } },
    }),
  ]);
  console.table({
    establishments: schoolCount,
    programs: programCount,
    courses: courseCount,
    teachers: teacherCount,
    classes: classCount,
    enrolledStudents: enrolledCount,
    candidates: candidateCount,
    applications: applicationCount,
    courseEnrollments: enrollmentCount,
  });
  console.log(`✅ Compte Ministry : ministere.national@${DEMO_EMAIL_DOMAIN}`);
  console.log(
    '✅ Mot de passe des comptes de démonstration : DemoNational2026!',
  );
  console.timeEnd('Population nationale');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed national interrompu', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
