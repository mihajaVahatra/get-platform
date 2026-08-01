import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEMO_SEED !== 'true'
  ) {
    throw new Error('Le seed de démonstration est désactivé en production');
  }
  console.log('🌱 Seeding database...');

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: { name: 'STUDENT', description: 'Étudiant', isDefault: true },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN_GET' },
    update: {},
    create: { name: 'ADMIN_GET', description: 'Administrateur GET' },
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

  const teacherRole = await prisma.role.upsert({
    where: { name: 'TEACHER' },
    update: {},
    create: { name: 'TEACHER', description: 'Professeur' },
  });

  console.log('✅ Rôles créés');

  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@get.mg' },
    update: {},
    create: {
      email: 'admin@get.mg',
      password: adminPassword,
      roleId: adminRole.id,
      isVerified: true,
      gender: 'MALE',
    },
  });
  console.log('✅ Admin GET créé: admin@get.mg / Admin123!');

  const schoolAdminPassword = await bcrypt.hash('Mihaja@25!', 10);
  const schoolAdmin = await prisma.user.upsert({
    where: { email: 'schooladmin@get.mg' },
    update: {},
    create: {
      email: 'schooladmin@get.mg',
      password: schoolAdminPassword,
      roleId: schoolAdminRole.id,
      isVerified: true,
      gender: 'FEMALE',
    },
  });
  console.log('✅ School Admin créé: schooladmin@get.mg / Mihaja@25!');

  const school = await prisma.school.upsert({
    where: { slug: 'espa' },
    update: {},
    create: {
      name: "ESPA - École Supérieure Polytechnique d'Antananarivo",
      slug: 'espa',
      description: "École d'ingénieurs publique",
      city: 'Antananarivo',
      region: 'Analamanga',
      country: 'Madagascar',
      website: 'https://espa.mg',
      isActive: true,
    },
  });
  console.log(`✅ École ESPA créée: ${school.name} (ID: ${school.id})`);

  const additionalSchools = [
    {
      name: 'Institut Supérieur de Technologie de Mahajanga',
      slug: 'ist-mahajanga',
      city: 'Mahajanga',
      region: 'Boeny',
      type: 'PUBLIC',
      contactEmail: 'contact@ist-mahajanga.mg',
      contactPhone: '+261 34 44 555 11',
    },
    {
      name: 'INSCAE Antananarivo',
      slug: 'inscae-antananarivo',
      city: 'Antananarivo',
      region: 'Analamanga',
      type: 'PUBLIC',
      contactEmail: 'contact@inscae.mg',
      contactPhone: '+261 20 22 888 99',
    },
    {
      name: 'Université de Toamasina',
      slug: 'universite-toamasina',
      city: 'Toamasina',
      region: 'Atsinanana',
      type: 'PUBLIC',
      contactEmail: 'contact@univ-toamasina.mg',
      contactPhone: '+261 32 55 667 78',
    },
    {
      name: 'Université de Fianarantsoa',
      slug: 'universite-fianarantsoa',
      city: 'Fianarantsoa',
      region: 'Haute Matsiatra',
      type: 'PUBLIC',
      contactEmail: 'contact@univ-fianarantsoa.mg',
      contactPhone: '+261 32 11 223 44',
    },
    {
      name: 'ISCAM - Institut Supérieur de la Communication, des Affaires et du Management',
      slug: 'iscam-antananarivo',
      city: 'Antananarivo',
      region: 'Analamanga',
      type: 'PRIVATE',
      contactEmail: 'contact@iscam.mg',
      contactPhone: '+261 20 22 333 55',
    },
  ];

  const seededSchools = await Promise.all(
    additionalSchools.map((schoolData) =>
      prisma.school.upsert({
        where: { slug: schoolData.slug },
        update: schoolData,
        create: { ...schoolData, country: 'Madagascar', isActive: true },
      }),
    ),
  );
  // seededSchools[0] = IST Mahajanga, [1] = INSCAE, [2] = Université de Toamasina,
  // [3] = Université de Fianarantsoa, [4] = ISCAM
  console.log('✅ 5 établissements supplémentaires créés');

  await prisma.schoolAdmin.upsert({
    where: { userId: schoolAdmin.id },
    update: {
      schoolId: school.id,
      permissions: ['OFFERS_MANAGE', 'STUDENTS_MANAGE', 'PAYMENTS_VIEW'],
    },
    create: {
      userId: schoolAdmin.id,
      schoolId: school.id,
      permissions: ['OFFERS_MANAGE', 'STUDENTS_MANAGE', 'PAYMENTS_VIEW'],
    },
  });

  const demoOffers = [
    {
      schoolId: school.id,
      slug: 'licence-informatique-espa-2026',
      title: 'Licence Informatique',
      description: 'Formation en informatique, algorithmique et développement logiciel.',
      diploma: 'Licence',
      duration: 36,
      tuitionFees: 3500000,
      prerequisites: ['Baccalauréat scientifique', 'Dossier académique'],
      capacity: 120,
      academicYear: '2026-2027',
      isFeatured: true,
    },
    {
      schoolId: school.id,
      slug: 'master-genie-civil-espa-2026',
      title: 'Master Génie Civil',
      description: 'Spécialisation en conception et gestion des infrastructures.',
      diploma: 'Master',
      duration: 24,
      tuitionFees: 4800000,
      prerequisites: ['Licence Génie Civil ou équivalent'],
      capacity: 45,
      academicYear: '2026-2027',
      isFeatured: false,
    },
    {
      schoolId: seededSchools[0].id,
      slug: 'dut-systemes-informatiques-ist-2026',
      title: 'DUT Systèmes Informatiques',
      description: 'Formation professionnalisante en systèmes et réseaux.',
      diploma: 'DUT',
      duration: 24,
      tuitionFees: 2200000,
      prerequisites: ['Baccalauréat'],
      capacity: 80,
      academicYear: '2026-2027',
      isFeatured: true,
    },
    {
      schoolId: seededSchools[1].id,
      slug: 'master-management-inscae-2026',
      title: 'Master Management',
      description: 'Programme de management, stratégie et entrepreneuriat.',
      diploma: 'Master',
      duration: 24,
      tuitionFees: 5200000,
      prerequisites: ['Licence ou équivalent'],
      capacity: 60,
      academicYear: '2026-2027',
      isFeatured: false,
    },
  ];

  await Promise.all(
    demoOffers.map((offer) =>
      prisma.offer.upsert({
        where: { slug: offer.slug },
        update: {
          ...offer,
          isOpen: true,
          applicationDeadline: new Date('2026-12-31T23:59:59.000Z'),
          deletedAt: null,
        },
        create: {
          ...offer,
          currency: 'MGA',
          isOpen: true,
          applicationDeadline: new Date('2026-12-31T23:59:59.000Z'),
        },
      }),
    ),
  );
  console.log('✅ 4 offres de démonstration créées');

  const ministryPassword = await bcrypt.hash('Ministere123!', 10);
  await prisma.user.upsert({
    where: { email: 'ministere@mesupres.gov.mg' },
    update: {
      password: ministryPassword,
      roleId: ministryRole.id,
      isVerified: true,
      gender: 'FEMALE',
    },
    create: {
      email: 'ministere@mesupres.gov.mg',
      password: ministryPassword,
      roleId: ministryRole.id,
      isVerified: true,
      gender: 'FEMALE',
    },
  });
  console.log(
    '✅ Utilisateur Ministère créé: ministere@mesupres.gov.mg / Ministere123!',
  );

  const teacherPassword = await bcrypt.hash('Professeur123!', 10);
  const teacherUser = await prisma.user.upsert({
    where: { email: 'prof.rakoto@espa.mg' },
    update: {
      password: teacherPassword,
      roleId: teacherRole.id,
      isVerified: true,
      gender: 'MALE',
    },
    create: {
      email: 'prof.rakoto@espa.mg',
      password: teacherPassword,
      roleId: teacherRole.id,
      isVerified: true,
      gender: 'MALE',
    },
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: { firstName: 'Nomenjanahary', lastName: 'Rakoto' },
    create: {
      userId: teacherUser.id,
      firstName: 'Nomenjanahary',
      lastName: 'Rakoto',
    },
  });
  await prisma.teacherSchool.upsert({
    where: {
      teacherId_schoolId: { teacherId: teacher.id, schoolId: school.id },
    },
    update: {
      department: 'Informatique',
      specialty: 'Algorithmique',
      isActive: true,
    },
    create: {
      teacherId: teacher.id,
      schoolId: school.id,
      department: 'Informatique',
      specialty: 'Algorithmique',
    },
  });
  await prisma.teacherSchool.upsert({
    where: {
      teacherId_schoolId: {
        teacherId: teacher.id,
        schoolId: seededSchools[0].id,
      },
    },
    update: {
      department: 'Informatique',
      specialty: 'Algorithmique',
      isActive: true,
    },
    create: {
      teacherId: teacher.id,
      schoolId: seededSchools[0].id,
      department: 'Informatique',
      specialty: 'Algorithmique',
    },
  });
  const firstCourse = await prisma.course.upsert({
    where: {
      schoolId_code_group: {
        schoolId: school.id,
        code: 'INFO301',
        group: 'Groupe A',
      },
    },
    update: { teacherId: teacher.id },
    create: {
      schoolId: school.id,
      teacherId: teacher.id,
      code: 'INFO301',
      title: 'Algorithmique et Programmation',
      level: 'Licence 3',
      group: 'Groupe A',
      credits: 6,
      room: 'Salle 2.3',
      schedule: 'Lun 08:00 – 10:00; Mer 08:00 – 10:00',
    },
  });
  const secondCourse = await prisma.course.upsert({
    where: {
      schoolId_code_group: {
        schoolId: seededSchools[0].id,
        code: 'ALGO201',
        group: 'Groupe B',
      },
    },
    update: { teacherId: teacher.id },
    create: {
      schoolId: seededSchools[0].id,
      teacherId: teacher.id,
      code: 'ALGO201',
      title: 'Algorithmique appliquée',
      level: 'Licence 2',
      group: 'Groupe B',
      credits: 4,
      room: 'Salle Informatique 1',
      schedule: 'Mar 13:00 – 16:00',
    },
  });
  await prisma.courseSlot.upsert({
    where: {
      courseId_dayOfWeek_startTime_endTime_room: {
        courseId: firstCourse.id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '10:00',
        room: 'Salle 2.3',
      },
    },
    update: {},
    create: { courseId: firstCourse.id, dayOfWeek: 1, startTime: '08:00', endTime: '10:00', room: 'Salle 2.3' },
  });
  await prisma.courseSlot.upsert({
    where: {
      courseId_dayOfWeek_startTime_endTime_room: {
        courseId: firstCourse.id,
        dayOfWeek: 3,
        startTime: '08:00',
        endTime: '10:00',
        room: 'Salle 2.3',
      },
    },
    update: {},
    create: { courseId: firstCourse.id, dayOfWeek: 3, startTime: '08:00', endTime: '10:00', room: 'Salle 2.3' },
  });
  await prisma.courseSlot.upsert({
    where: {
      courseId_dayOfWeek_startTime_endTime_room: {
        courseId: secondCourse.id,
        dayOfWeek: 2,
        startTime: '13:00',
        endTime: '16:00',
        room: 'Salle Informatique 1',
      },
    },
    update: {},
    create: { courseId: secondCourse.id, dayOfWeek: 2, startTime: '13:00', endTime: '16:00', room: 'Salle Informatique 1' },
  });
  console.log('✅ Professeur créé et affecté à ESPA + IST Mahajanga: prof.rakoto@espa.mg / Professeur123!');

  const studentPassword = await bcrypt.hash('Student123!', 10);
  await prisma.user.upsert({
    where: { email: 'test@gmail.com' },
    update: {},
    create: {
      email: 'test@gmail.com',
      password: studentPassword,
      roleId: studentRole.id,
      isVerified: true,
      gender: 'MALE',
      student: {
        create: {
          firstName: 'Jean',
          lastName: 'Rakoto',
          phone: '+261341234567',
          city: 'Antananarivo',
          region: 'Analamanga',
        },
      },
    },
  });
  console.log('✅ Étudiant candidat créé: test@gmail.com / Student123!');

  const candidatePassword = await bcrypt.hash('Candidat123!', 10);
  const candidate = await prisma.user.upsert({
    where: { email: 'candidat@get.mg' },
    update: {
      password: candidatePassword,
      roleId: studentRole.id,
      isVerified: true,
      gender: 'FEMALE',
    },
    create: {
      email: 'candidat@get.mg',
      password: candidatePassword,
      roleId: studentRole.id,
      isVerified: true,
      gender: 'FEMALE',
    },
  });
  await prisma.student.upsert({
    where: { userId: candidate.id },
    update: {
      firstName: 'Mialy',
      lastName: 'Ranaivo',
      city: 'Antananarivo',
      region: 'Analamanga',
      enrolledSchoolId: null,
      enrolledYear: null,
    },
    create: {
      userId: candidate.id,
      firstName: 'Mialy',
      lastName: 'Ranaivo',
      city: 'Antananarivo',
      region: 'Analamanga',
    },
  });
  console.log(
    '✅ Étudiante non inscrite créée: candidat@get.mg / Candidat123!',
  );

  const enrolledPassword = await bcrypt.hash('Enrolled123!', 10);
  const enrolledStudent = await prisma.user.upsert({
    where: { email: 'enrolled@test.com' },
    update: {},
    create: {
      email: 'enrolled@test.com',
      password: enrolledPassword,
      roleId: studentRole.id,
      isVerified: true,
      gender: 'MALE',
      student: {
        create: {
          firstName: 'Toavina',
          lastName: 'Vahatra',
          phone: '+261 34 234 5678',
          birthDate: new Date('2000-01-01'),
          cin: '1012345678',
          bacYear: 2018,
          bacType: 'Série C',
          city: 'Antananarivo',
          region: 'Analamanga',
          country: 'Madagascar',
          bio: 'Étudiant en 2ème année Informatique',
          interests: ['Informatique', 'Mathématiques', 'IA'],
          skills: ['JavaScript', 'Python', 'SQL'],
          aspirations: ['Devenir ingénieur en IA'],
          profileCompleted: true,
          enrolledSchoolId: school.id,
          enrolledYear: '2ᵉ année Informatique',
        },
      },
    },
  });
  console.log('✅ Étudiant inscrit créé: enrolled@test.com / Enrolled123!');

  const schoolStudents = [
    {
      email: 'lina.ist@get.mg',
      firstName: 'Lina',
      lastName: 'Razanakoto',
      school: seededSchools[0],
      year: '1ʳᵉ année Informatique',
      gender: 'FEMALE',
    },
    {
      email: 'hery.ist@get.mg',
      firstName: 'Hery',
      lastName: 'Andrianina',
      school: seededSchools[0],
      year: '2ᵉ année Génie Civil',
      gender: 'MALE',
    },
    {
      email: 'mamy.inscae@get.mg',
      firstName: 'Mamy',
      lastName: 'Rakotondrabe',
      school: seededSchools[1],
      year: '1ʳᵉ année Management',
      gender: 'MALE',
    },
    {
      email: 'saholy.inscae@get.mg',
      firstName: 'Saholy',
      lastName: 'Rasoanaivo',
      school: seededSchools[1],
      year: '2ᵉ année Finance',
      gender: 'FEMALE',
    },
    {
      email: 'fanja.toamasina@get.mg',
      firstName: 'Fanja',
      lastName: 'Ravelomanana',
      school: seededSchools[2],
      year: '1ʳᵉ année Sciences de la santé',
      gender: 'FEMALE',
    },
    {
      email: 'toky.toamasina@get.mg',
      firstName: 'Toky',
      lastName: 'Randriamihaja',
      school: seededSchools[2],
      year: '2ᵉ année Économie',
      gender: 'MALE',
    },
    {
      email: 'fara.espa@get.mg',
      firstName: 'Fara',
      lastName: 'Rakotoniaina',
      school,
      year: '3ᵉ année Informatique',
      gender: 'FEMALE',
    },
    {
      email: 'njaka.espa@get.mg',
      firstName: 'Njaka',
      lastName: 'Andriamampianina',
      school,
      year: '3ᵉ année Informatique',
      gender: 'MALE',
    },
    {
      email: 'fy.ist@get.mg',
      firstName: 'Fy',
      lastName: 'Rasolonirina',
      school: seededSchools[0],
      year: '2ᵉ année Informatique',
      gender: 'MALE',
    },
  ] as const;

  const enrolledDemoPassword = await bcrypt.hash('Etudiant123!', 10);
  for (const entry of schoolStudents) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        password: enrolledDemoPassword,
        roleId: studentRole.id,
        isVerified: true,
        gender: entry.gender,
      },
      create: {
        email: entry.email,
        password: enrolledDemoPassword,
        roleId: studentRole.id,
        isVerified: true,
        gender: entry.gender,
      },
    });
    await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        firstName: entry.firstName,
        lastName: entry.lastName,
        city: entry.school.city,
        region: entry.school.region,
        enrolledSchoolId: entry.school.id,
        enrolledYear: entry.year,
      },
      create: {
        userId: user.id,
        firstName: entry.firstName,
        lastName: entry.lastName,
        city: entry.school.city,
        region: entry.school.region,
        enrolledSchoolId: entry.school.id,
        enrolledYear: entry.year,
      },
    });
  }
  console.log(
    '✅ 9 étudiants inscrits dans les établissements (mot de passe : Etudiant123!)',
  );

  // ════════════════════════════════════════════
  //  2ᵉ PROFESSEUR (INSCAE + Université de Toamasina)
  // ════════════════════════════════════════════
  const teacher2Password = await bcrypt.hash('Professeur123!', 10);
  const teacher2User = await prisma.user.upsert({
    where: { email: 'prof.andria@inscae.mg' },
    update: {
      password: teacher2Password,
      roleId: teacherRole.id,
      isVerified: true,
      gender: 'FEMALE',
    },
    create: {
      email: 'prof.andria@inscae.mg',
      password: teacher2Password,
      roleId: teacherRole.id,
      isVerified: true,
      gender: 'FEMALE',
    },
  });
  const teacher2 = await prisma.teacher.upsert({
    where: { userId: teacher2User.id },
    update: { firstName: 'Voahangy', lastName: 'Andrianarisoa' },
    create: {
      userId: teacher2User.id,
      firstName: 'Voahangy',
      lastName: 'Andrianarisoa',
    },
  });
  await prisma.teacherSchool.upsert({
    where: {
      teacherId_schoolId: {
        teacherId: teacher2.id,
        schoolId: seededSchools[1].id,
      },
    },
    update: {
      department: 'Management',
      specialty: 'Gestion des organisations',
      isActive: true,
    },
    create: {
      teacherId: teacher2.id,
      schoolId: seededSchools[1].id,
      department: 'Management',
      specialty: 'Gestion des organisations',
    },
  });
  await prisma.teacherSchool.upsert({
    where: {
      teacherId_schoolId: {
        teacherId: teacher2.id,
        schoolId: seededSchools[2].id,
      },
    },
    update: {
      department: 'Économie',
      specialty: 'Microéconomie',
      isActive: true,
    },
    create: {
      teacherId: teacher2.id,
      schoolId: seededSchools[2].id,
      department: 'Économie',
      specialty: 'Microéconomie',
    },
  });
  console.log(
    '✅ 2ᵉ professeur créé et affecté à INSCAE + Université de Toamasina: prof.andria@inscae.mg / Professeur123!',
  );

  // ════════════════════════════════════════════
  //  COURS SUPPLÉMENTAIRES
  // ════════════════════════════════════════════
  const thirdCourse = await prisma.course.upsert({
    where: {
      schoolId_code_group: {
        schoolId: school.id,
        code: 'BDD301',
        group: 'Groupe A',
      },
    },
    update: { teacherId: teacher.id },
    create: {
      schoolId: school.id,
      teacherId: teacher.id,
      code: 'BDD301',
      title: 'Bases de données',
      level: 'Licence 3',
      group: 'Groupe A',
      credits: 5,
      room: 'Salle 2.5',
      schedule: 'Jeu 10:00 – 12:00',
    },
  });
  const mgtCourse = await prisma.course.upsert({
    where: {
      schoolId_code_group: {
        schoolId: seededSchools[1].id,
        code: 'MGT201',
        group: 'Groupe A',
      },
    },
    update: { teacherId: teacher2.id },
    create: {
      schoolId: seededSchools[1].id,
      teacherId: teacher2.id,
      code: 'MGT201',
      title: 'Management des organisations',
      level: 'Master 1',
      group: 'Groupe A',
      credits: 5,
      room: 'Amphi B',
      schedule: 'Mar 09:00 – 12:00',
    },
  });
  const ecoCourse = await prisma.course.upsert({
    where: {
      schoolId_code_group: {
        schoolId: seededSchools[2].id,
        code: 'ECO101',
        group: 'Groupe A',
      },
    },
    update: { teacherId: teacher2.id },
    create: {
      schoolId: seededSchools[2].id,
      teacherId: teacher2.id,
      code: 'ECO101',
      title: 'Microéconomie',
      level: 'Licence 1',
      group: 'Groupe A',
      credits: 4,
      room: 'Salle 101',
      schedule: 'Jeu 14:00 – 16:00',
    },
  });
  await prisma.courseSlot.upsert({
    where: {
      courseId_dayOfWeek_startTime_endTime_room: {
        courseId: thirdCourse.id,
        dayOfWeek: 4,
        startTime: '10:00',
        endTime: '12:00',
        room: 'Salle 2.5',
      },
    },
    update: {},
    create: { courseId: thirdCourse.id, dayOfWeek: 4, startTime: '10:00', endTime: '12:00', room: 'Salle 2.5' },
  });
  await prisma.courseSlot.upsert({
    where: {
      courseId_dayOfWeek_startTime_endTime_room: {
        courseId: mgtCourse.id,
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '12:00',
        room: 'Amphi B',
      },
    },
    update: {},
    create: { courseId: mgtCourse.id, dayOfWeek: 2, startTime: '09:00', endTime: '12:00', room: 'Amphi B' },
  });
  await prisma.courseSlot.upsert({
    where: {
      courseId_dayOfWeek_startTime_endTime_room: {
        courseId: ecoCourse.id,
        dayOfWeek: 4,
        startTime: '14:00',
        endTime: '16:00',
        room: 'Salle 101',
      },
    },
    update: {},
    create: { courseId: ecoCourse.id, dayOfWeek: 4, startTime: '14:00', endTime: '16:00', room: 'Salle 101' },
  });
  console.log('✅ 3 cours supplémentaires créés (BDD301, MGT201, ECO101)');

  // ════════════════════════════════════════════
  //  INSCRIPTIONS AUX COURS
  // ════════════════════════════════════════════
  const studentIdByEmail = async (email: string) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const student = await prisma.student.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return student.id;
  };

  const enrollmentPlan = [
    { courseId: firstCourse.id, email: 'enrolled@test.com' },
    { courseId: firstCourse.id, email: 'fara.espa@get.mg' },
    { courseId: firstCourse.id, email: 'njaka.espa@get.mg' },
    { courseId: thirdCourse.id, email: 'fara.espa@get.mg' },
    { courseId: thirdCourse.id, email: 'njaka.espa@get.mg' },
    { courseId: secondCourse.id, email: 'lina.ist@get.mg' },
    { courseId: secondCourse.id, email: 'hery.ist@get.mg' },
    { courseId: secondCourse.id, email: 'fy.ist@get.mg' },
    { courseId: mgtCourse.id, email: 'mamy.inscae@get.mg' },
    { courseId: mgtCourse.id, email: 'saholy.inscae@get.mg' },
    { courseId: ecoCourse.id, email: 'fanja.toamasina@get.mg' },
    { courseId: ecoCourse.id, email: 'toky.toamasina@get.mg' },
  ];
  for (const enrollment of enrollmentPlan) {
    const studentId = await studentIdByEmail(enrollment.email);
    await prisma.courseEnrollment.upsert({
      where: {
        courseId_studentId: { courseId: enrollment.courseId, studentId },
      },
      update: {},
      create: { courseId: enrollment.courseId, studentId },
    });
  }
  console.log(`✅ ${enrollmentPlan.length} inscriptions aux cours créées`);

  // ════════════════════════════════════════════
  //  CHAPITRES ET RESSOURCES (DOCUMENTS DE COURS)
  // ════════════════════════════════════════════
  const chapterDefs = [
    {
      course: firstCourse,
      position: 1,
      title: 'Introduction à l’algorithmique',
      description: 'Notions de base : variables, boucles, conditions.',
      isPublished: true,
      resources: [
        { title: 'Support de cours - Chapitre 1', type: 'PDF', url: 'https://example.com/docs/info301-chap1.pdf' },
        { title: 'Exercices corrigés', type: 'PDF', url: 'https://example.com/docs/info301-chap1-exercices.pdf' },
      ],
    },
    {
      course: firstCourse,
      position: 2,
      title: 'Structures de données',
      description: 'Tableaux, listes chaînées, piles et files.',
      isPublished: false,
      resources: [
        { title: 'Slides - Structures de données', type: 'SLIDES', url: 'https://example.com/docs/info301-chap2.pptx' },
      ],
    },
    {
      course: secondCourse,
      position: 1,
      title: 'Complexité algorithmique',
      description: 'Analyse de la complexité temporelle et spatiale.',
      isPublished: true,
      resources: [
        { title: 'Support de cours - Complexité', type: 'PDF', url: 'https://example.com/docs/algo201-chap1.pdf' },
        { title: 'Vidéo - Notation Big O', type: 'VIDEO', url: 'https://example.com/videos/algo201-bigo.mp4' },
      ],
    },
    {
      course: thirdCourse,
      position: 1,
      title: 'Modèle relationnel',
      description: 'Introduction aux bases de données relationnelles.',
      isPublished: true,
      resources: [
        { title: 'Support de cours - Modèle relationnel', type: 'PDF', url: 'https://example.com/docs/bdd301-chap1.pdf' },
      ],
    },
    {
      course: mgtCourse,
      position: 1,
      title: 'Fondamentaux du management',
      description: 'Théories des organisations et styles de management.',
      isPublished: true,
      resources: [
        { title: 'Support de cours - Management', type: 'PDF', url: 'https://example.com/docs/mgt201-chap1.pdf' },
      ],
    },
    {
      course: ecoCourse,
      position: 1,
      title: 'Offre et demande',
      description: 'Mécanismes de marché et équilibre.',
      isPublished: true,
      resources: [
        { title: 'Support de cours - Microéconomie', type: 'PDF', url: 'https://example.com/docs/eco101-chap1.pdf' },
      ],
    },
  ];
  for (const def of chapterDefs) {
    const chapter = await prisma.courseChapter.upsert({
      where: {
        courseId_position: { courseId: def.course.id, position: def.position },
      },
      update: {
        title: def.title,
        description: def.description,
        isPublished: def.isPublished,
        publishedAt: def.isPublished ? new Date() : null,
      },
      create: {
        courseId: def.course.id,
        position: def.position,
        title: def.title,
        description: def.description,
        isPublished: def.isPublished,
        publishedAt: def.isPublished ? new Date() : null,
      },
    });
    for (const resource of def.resources) {
      const existingResource = await prisma.courseResource.findFirst({
        where: { chapterId: chapter.id, title: resource.title },
      });
      if (!existingResource) {
        await prisma.courseResource.create({
          data: {
            chapterId: chapter.id,
            title: resource.title,
            url: resource.url,
            type: resource.type,
          },
        });
      }
    }
  }
  console.log('✅ Chapitres et ressources de cours (documents) créés');

  // ════════════════════════════════════════════
  //  ÉVALUATIONS ET NOTES
  // ════════════════════════════════════════════
  const evaluationDefs = [
    {
      course: firstCourse,
      title: 'Contrôle continu 1',
      type: 'CONTROLE_CONTINU',
      scheduledAt: new Date('2026-06-15T08:00:00.000Z'),
      coefficient: 1,
      gradeStudents: ['enrolled@test.com', 'fara.espa@get.mg', 'njaka.espa@get.mg'],
    },
    {
      course: firstCourse,
      title: 'Examen final',
      type: 'EXAMEN',
      scheduledAt: new Date('2026-09-10T08:00:00.000Z'),
      coefficient: 2,
      gradeStudents: [] as string[],
    },
    {
      course: secondCourse,
      title: 'Contrôle continu 1',
      type: 'CONTROLE_CONTINU',
      scheduledAt: new Date('2026-06-20T13:00:00.000Z'),
      coefficient: 1,
      gradeStudents: ['lina.ist@get.mg', 'hery.ist@get.mg'],
    },
    {
      course: secondCourse,
      title: 'Examen final',
      type: 'EXAMEN',
      scheduledAt: new Date('2026-09-15T13:00:00.000Z'),
      coefficient: 2,
      gradeStudents: [] as string[],
    },
    {
      course: thirdCourse,
      title: 'TP noté',
      type: 'TP',
      scheduledAt: new Date('2026-06-25T10:00:00.000Z'),
      coefficient: 1,
      gradeStudents: ['fara.espa@get.mg'],
    },
    {
      course: mgtCourse,
      title: 'Étude de cas',
      type: 'CONTROLE_CONTINU',
      scheduledAt: new Date('2026-06-18T09:00:00.000Z'),
      coefficient: 1,
      gradeStudents: ['mamy.inscae@get.mg', 'saholy.inscae@get.mg'],
    },
    {
      course: ecoCourse,
      title: 'Contrôle continu 1',
      type: 'CONTROLE_CONTINU',
      scheduledAt: new Date('2026-06-22T14:00:00.000Z'),
      coefficient: 1,
      gradeStudents: ['fanja.toamasina@get.mg'],
    },
    {
      course: ecoCourse,
      title: 'Examen final',
      type: 'EXAMEN',
      scheduledAt: new Date('2026-09-20T14:00:00.000Z'),
      coefficient: 2,
      gradeStudents: [] as string[],
    },
  ];
  for (const def of evaluationDefs) {
    let evaluation = await prisma.evaluation.findFirst({
      where: { courseId: def.course.id, title: def.title },
    });
    if (!evaluation) {
      evaluation = await prisma.evaluation.create({
        data: {
          courseId: def.course.id,
          title: def.title,
          type: def.type,
          scheduledAt: def.scheduledAt,
          coefficient: def.coefficient,
        },
      });
    }
    for (const email of def.gradeStudents) {
      const studentId = await studentIdByEmail(email);
      const value = Math.round((10 + Math.random() * 9) * 10) / 10;
      await prisma.grade.upsert({
        where: { evaluationId_studentId: { evaluationId: evaluation.id, studentId } },
        update: {},
        create: { evaluationId: evaluation.id, studentId, value, comment: 'Bon travail' },
      });
    }
  }
  console.log('✅ Évaluations et notes créées (examens finaux à venir non notés)');

  // ════════════════════════════════════════════
  //  DEVOIRS ET SOUMISSIONS
  // ════════════════════════════════════════════
  const assignmentDefs = [
    {
      course: firstCourse,
      title: 'Devoir 1 - Algorithmes de tri',
      instructions: 'Implémentez un tri par insertion et un tri rapide.',
      dueAt: new Date('2026-07-20T23:59:00.000Z'),
      publishedAt: new Date('2026-07-01T08:00:00.000Z'),
      submissions: [
        { email: 'enrolled@test.com', grade: 15, feedback: 'Bon travail, attention à la complexité.' },
        { email: 'fara.espa@get.mg', grade: null as number | null, feedback: null as string | null },
      ],
    },
    {
      course: secondCourse,
      title: 'Devoir 1 - Analyse de complexité',
      instructions: 'Calculez la complexité des algorithmes fournis.',
      dueAt: new Date('2026-07-25T23:59:00.000Z'),
      publishedAt: new Date('2026-07-05T08:00:00.000Z'),
      submissions: [
        { email: 'lina.ist@get.mg', grade: 14, feedback: 'Bien argumenté.' },
        { email: 'hery.ist@get.mg', grade: null as number | null, feedback: null as string | null },
      ],
    },
    {
      course: mgtCourse,
      title: 'Étude de cas - Entreprise locale',
      instructions: 'Analysez la structure organisationnelle d’une PME malgache.',
      dueAt: new Date('2026-08-10T23:59:00.000Z'),
      publishedAt: new Date('2026-07-10T09:00:00.000Z'),
      submissions: [
        { email: 'mamy.inscae@get.mg', grade: null as number | null, feedback: null as string | null },
      ],
    },
    {
      course: ecoCourse,
      title: 'Exercice - Courbes d’offre et de demande',
      instructions: 'Tracez et commentez les courbes.',
      dueAt: new Date('2026-08-05T23:59:00.000Z'),
      publishedAt: new Date('2026-07-12T14:00:00.000Z'),
      submissions: [
        { email: 'fanja.toamasina@get.mg', grade: 16, feedback: 'Excellent.' },
      ],
    },
  ];
  for (const def of assignmentDefs) {
    let assignment = await prisma.assignment.findFirst({
      where: { courseId: def.course.id, title: def.title },
    });
    if (!assignment) {
      assignment = await prisma.assignment.create({
        data: {
          courseId: def.course.id,
          title: def.title,
          instructions: def.instructions,
          dueAt: def.dueAt,
          publishedAt: def.publishedAt,
        },
      });
    }
    for (const submission of def.submissions) {
      const studentId = await studentIdByEmail(submission.email);
      await prisma.assignmentSubmission.upsert({
        where: {
          assignmentId_studentId: { assignmentId: assignment.id, studentId },
        },
        update: {},
        create: {
          assignmentId: assignment.id,
          studentId,
          contentUrl: 'https://example.com/submissions/demo.pdf',
          grade: submission.grade ?? undefined,
          feedback: submission.feedback ?? undefined,
        },
      });
    }
  }
  console.log('✅ Devoirs et soumissions créés (certains restent à corriger)');

  // ════════════════════════════════════════════
  //  ANNONCES DE COURS
  // ════════════════════════════════════════════
  const announcementDefs = [
    {
      course: firstCourse,
      authorId: teacherUser.id,
      title: 'Rappel : devoir à rendre',
      body: 'N’oubliez pas de rendre le devoir sur les algorithmes de tri avant le 20 juillet.',
    },
    {
      course: secondCourse,
      authorId: teacherUser.id,
      title: 'Changement de salle',
      body: 'Le cours du mardi aura lieu en Salle Informatique 2 exceptionnellement.',
    },
    {
      course: mgtCourse,
      authorId: teacher2User.id,
      title: 'Étude de cas à préparer',
      body: 'Merci de lire le cas fourni avant la prochaine séance.',
    },
    {
      course: ecoCourse,
      authorId: teacher2User.id,
      title: 'Séance de rattrapage',
      body: 'Une séance de soutien aura lieu vendredi à 14h.',
    },
  ];
  for (const def of announcementDefs) {
    const existingAnnouncement = await prisma.announcement.findFirst({
      where: { courseId: def.course.id, title: def.title },
    });
    if (!existingAnnouncement) {
      await prisma.announcement.create({
        data: {
          schoolId: def.course.schoolId,
          authorId: def.authorId,
          courseId: def.course.id,
          targetType: 'COURSE_STUDENTS',
          targetClasses: [],
          title: def.title,
          body: def.body,
        },
      });
    }
  }
  console.log('✅ Annonces de cours créées');

  // ════════════════════════════════════════════
  //  DOCUMENTS ÉTUDIANTS
  // ════════════════════════════════════════════
  // NB: les types valides du modèle Document sont CV, LETTER, ID, DIPLOMA, PHOTO, OTHER
  // (cf. frontend/app/dashboard/student/documents/page.tsx) — CIN/BAC ne sont pas des types valides.
  await prisma.document.updateMany({ where: { type: 'CIN' }, data: { type: 'ID' } });
  await prisma.document.updateMany({ where: { type: 'BAC' }, data: { type: 'DIPLOMA' } });
  const documentDefs = [
    { email: 'enrolled@test.com', type: 'ID', name: 'CIN_Toavina.pdf', isVerified: true },
    { email: 'enrolled@test.com', type: 'DIPLOMA', name: 'Releve_Bac_Toavina.pdf', isVerified: true },
    { email: 'fara.espa@get.mg', type: 'ID', name: 'CIN_Fara.pdf', isVerified: false },
    { email: 'mamy.inscae@get.mg', type: 'ID', name: 'CIN_Mamy.pdf', isVerified: true },
    { email: 'fanja.toamasina@get.mg', type: 'DIPLOMA', name: 'Releve_Bac_Fanja.pdf', isVerified: false },
  ];
  for (const doc of documentDefs) {
    const studentId = await studentIdByEmail(doc.email);
    const existingDocument = await prisma.document.findFirst({
      where: { studentId, name: doc.name },
    });
    if (!existingDocument) {
      await prisma.document.create({
        data: {
          studentId,
          type: doc.type,
          name: doc.name,
          fileUrl: `https://example.com/documents/${doc.name}`,
          fileSize: 204800,
          mimeType: 'application/pdf',
          isVerified: doc.isVerified,
          verifiedAt: doc.isVerified ? new Date() : null,
          verifiedBy: doc.isVerified ? admin.id : null,
        },
      });
    }
  }
  console.log('✅ Documents étudiants créés');

  // ══════════════════════════════════════════════════════════════
  //  GÉNÉRATION MASSIVE : profs, cours, cohortes d'étudiants,
  //  candidats et offres — pour un jeu de données réaliste et fourni
  // ══════════════════════════════════════════════════════════════
  const MALE_FIRST_NAMES = [
    'Tojo', 'Njaka', 'Fetra', 'Andry', 'Faly', 'Tahina', 'Rivo', 'Heriniaina',
    'Solofo', 'Hery', 'Toky', 'Rado', 'Nomena', 'Tovo', 'Aro', 'Dimby', 'Feno',
    'Naina', 'Ando', 'Fy', 'Zo', 'Sedera', 'Harilala', 'Miary', 'Tahiry',
    'Rindra', 'Lanto', 'Mahefa', 'Iavotriniaina', 'Onja',
  ];
  const FEMALE_FIRST_NAMES = [
    'Mialy', 'Voninkazo', 'Arisoa', 'Volatiana', 'Sitraka', 'Tiana', 'Lala',
    'Fanja', 'Saholy', 'Nirina', 'Vola', 'Fara', 'Njiva', 'Miora', 'Zoly',
    'Baholy', 'Vero', 'Nomeny', 'Malala', 'Fenosoa', 'Harinosy', 'Tantely',
    'Lova', 'Sahondra', 'Aina', 'Hanta', 'Norotiana', 'Bako', 'Sariaka', 'Elia',
  ];
  const LAST_NAMES = [
    'Rakotonirina', 'Rakotomalala', 'Rasoanaivo', 'Randrianasolo', 'Andriamahefa',
    'Ravaomanana', 'Razafindrakoto', 'Rabemananjara', 'Ratsimbazafy', 'Rajaonarison',
    'Andriantsoa', 'Rasolofoniaina', 'Ramanantsoa', 'Razanadrakoto', 'Andrianjafy',
    'Rakotobe', 'Rasolonjatovo', 'Andriamanantsoa', 'Ravelojaona', 'Rakotoson',
    'Rajemisa', 'Andriamihaja', 'Rasoamanana', 'Ratovoson', 'Andriamparany',
    'Rakotoarisoa', 'Razafindramanana', 'Rasendrasoa', 'Andrianirina', 'Rabetsitonta',
    'Rakotozafy', 'Ranaivoson', 'Andriamiadana', 'Rasoazanamiadana', 'Rakotoarivelo',
    'Ravololomanana', 'Andriamanjato', 'Razafimahatratra', 'Rakotondramanana',
    'Andrianaivo',
  ];
  const CITY_POOL = [
    { city: 'Antananarivo', region: 'Analamanga' },
    { city: 'Mahajanga', region: 'Boeny' },
    { city: 'Toamasina', region: 'Atsinanana' },
    { city: 'Fianarantsoa', region: 'Haute Matsiatra' },
    { city: 'Toliara', region: 'Atsimo-Andrefana' },
    { city: 'Antsiranana', region: 'DIANA' },
    { city: 'Antsirabe', region: 'Vakinankaratra' },
    { city: 'Morondava', region: 'Menabe' },
  ];
  const BAC_TYPES = ['Série A', 'Série C', 'Série D', 'Série OSE (Technique)'];
  const INTERESTS_POOL = [
    'Informatique', 'Mathématiques', 'IA', 'Robotique', 'Réseaux',
    'Entrepreneuriat', 'Finance', 'Marketing', 'Droit', 'Santé publique',
    'Agriculture', 'Environnement', 'Génie civil', 'Électronique', 'Design',
    'Musique', 'Sport', 'Langues', 'Communication', 'Économie',
  ];
  const SKILLS_POOL = [
    'JavaScript', 'Python', 'SQL', 'Excel', 'Comptabilité', 'Anglais',
    'Communication', 'Gestion de projet', 'AutoCAD', 'Photoshop', 'Rédaction',
    'Analyse de données', 'Réseaux sociaux', 'Prise de parole en public', 'Négociation',
  ];
  const ASPIRATIONS_POOL = [
    'Devenir ingénieur', 'Travailler dans une ONG', 'Créer sa propre entreprise',
    'Intégrer une banque', 'Travailler à l’international', 'Devenir enseignant',
    'Rejoindre une multinationale', 'Travailler dans le secteur public',
    'Devenir consultant', 'Poursuivre un doctorat',
  ];
  const pick = <T,>(arr: readonly T[], seed: number): T => arr[seed % arr.length];
  const pad = (n: number, len: number) => Math.abs(n).toString().padStart(len, '0');
  const genPhone = (seed: number) => {
    const prefix = pick(['032', '033', '034', '038'], seed);
    return `+261 ${prefix.slice(1)} ${pad((seed * 37) % 100, 2)} ${pad((seed * 91) % 1000, 3)} ${pad((seed * 53) % 100, 2)}`;
  };
  const genCin = (seed: number) => Array.from({ length: 12 }, (_, i) => pad((seed * (i + 3) * 7) % 10, 1)).join('');
  const genBirthDate = (seed: number, minAge: number, maxAge: number) => {
    const age = minAge + (seed % (maxAge - minAge + 1));
    const year = 2026 - age;
    const month = (seed % 12) + 1;
    const day = (seed % 27) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  };
  const buildProfile = (
    seed: number,
    opts: { minAge: number; maxAge: number; bacYearRange: [number, number]; finishing: boolean },
  ) => {
    const bacYear = opts.bacYearRange[0] + (seed % (opts.bacYearRange[1] - opts.bacYearRange[0] + 1));
    const cityEntry = pick(CITY_POOL, seed + 3);
    const bio = opts.finishing
      ? `Étudiant(e) en fin de cursus, à la recherche d’un premier emploi ou d’un stage dans son domaine.`
      : `Bachelier(ère) ${bacYear}, motivé(e) à poursuivre des études supérieures.`;
    return {
      phone: genPhone(seed),
      birthDate: genBirthDate(seed, opts.minAge, opts.maxAge),
      cin: genCin(seed),
      bacYear,
      bacType: pick(BAC_TYPES, seed + 1),
      address: `Lot ${pad((seed * 17) % 900, 3)} ${pick(['Ankorondrano', 'Analakely', 'Isotry', 'Ambohipo', 'Andraharo', 'Tsaralalana'], seed + 6)}`,
      city: cityEntry.city,
      region: cityEntry.region,
      country: 'Madagascar',
      bio,
      interests: [pick(INTERESTS_POOL, seed), pick(INTERESTS_POOL, seed + 5), pick(INTERESTS_POOL, seed + 9)].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      skills: [pick(SKILLS_POOL, seed + 2), pick(SKILLS_POOL, seed + 7)].filter((v, i, a) => a.indexOf(v) === i),
      aspirations: [pick(ASPIRATIONS_POOL, seed + 4)],
    };
  };

  // ────────────────────────────────────────────
  //  9 PROFESSEURS SUPPLÉMENTAIRES (total ≥ 10)
  // ────────────────────────────────────────────
  const bulkTeacherPassword = await bcrypt.hash('Professeur123!', 10);
  const newTeacherDefs = [
    { email: 'prof.andry.ratsim@espa.mg', firstName: 'Andry', lastName: 'Ratsimbazafy', gender: 'MALE', schoolId: school.id, department: 'Génie Civil', specialty: 'Structures et bâtiments' },
    { email: 'prof.fetra.ravao@espa.mg', firstName: 'Fetra', lastName: 'Ravaomanana', gender: 'FEMALE', schoolId: school.id, department: 'Informatique', specialty: 'Réseaux et sécurité' },
    { email: 'prof.tojo.rasolo@ist-mahajanga.mg', firstName: 'Tojo', lastName: 'Rasolofoniaina', gender: 'MALE', schoolId: seededSchools[0].id, department: 'Informatique', specialty: 'Développement web' },
    { email: 'prof.onja.andriamanjato@ist-mahajanga.mg', firstName: 'Onja', lastName: 'Andriamanjato', gender: 'FEMALE', schoolId: seededSchools[0].id, department: 'Génie Civil', specialty: 'Topographie' },
    { email: 'prof.voninkazo.razafind@inscae.mg', firstName: 'Voninkazo', lastName: 'Razafindrakoto', gender: 'FEMALE', schoolId: seededSchools[1].id, department: 'Finance', specialty: 'Comptabilité et audit' },
    { email: 'prof.solofo.andriantsoa@inscae.mg', firstName: 'Solofo', lastName: 'Andriantsoa', gender: 'MALE', schoolId: seededSchools[1].id, department: 'Marketing', specialty: 'Marketing digital' },
    { email: 'prof.sitraka.ramanantsoa@univ-toamasina.mg', firstName: 'Sitraka', lastName: 'Ramanantsoa', gender: 'MALE', schoolId: seededSchools[2].id, department: 'Sciences de la santé', specialty: 'Biologie médicale' },
    { email: 'prof.faly.rajaon@univ-fianarantsoa.mg', firstName: 'Faly', lastName: 'Rajaonarison', gender: 'MALE', schoolId: seededSchools[3].id, department: 'Agronomie', specialty: 'Agroécologie' },
    { email: 'prof.malala.rakotoson@iscam.mg', firstName: 'Malala', lastName: 'Rakotoson', gender: 'FEMALE', schoolId: seededSchools[4].id, department: 'Communication', specialty: 'Communication digitale' },
  ] as const;

  const teacherRecords = new Map<string, { id: string; userId: string }>();
  for (const def of newTeacherDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: { password: bulkTeacherPassword, roleId: teacherRole.id, isVerified: true, gender: def.gender },
      create: { email: def.email, password: bulkTeacherPassword, roleId: teacherRole.id, isVerified: true, gender: def.gender },
    });
    const teacherRecord = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: { firstName: def.firstName, lastName: def.lastName },
      create: { userId: user.id, firstName: def.firstName, lastName: def.lastName },
    });
    await prisma.teacherSchool.upsert({
      where: { teacherId_schoolId: { teacherId: teacherRecord.id, schoolId: def.schoolId } },
      update: { department: def.department, specialty: def.specialty, isActive: true },
      create: { teacherId: teacherRecord.id, schoolId: def.schoolId, department: def.department, specialty: def.specialty },
    });
    teacherRecords.set(def.email, { id: teacherRecord.id, userId: user.id });
  }
  console.log(`✅ ${newTeacherDefs.length} professeurs supplémentaires créés (total 11 professeurs) — mot de passe : Professeur123!`);
  const tId = (email: string) => teacherRecords.get(email)!.id;

  // ────────────────────────────────────────────
  //  ~47 COURS SUPPLÉMENTAIRES (total ≥ 50 types de cours)
  // ────────────────────────────────────────────
  const courseDefs = [
    // ESPA — Informatique (prof. Rakoto)
    { schoolId: school.id, teacherId: teacher.id, code: 'INFO101', title: 'Introduction à la programmation', level: 'Licence 1', credits: 4 },
    { schoolId: school.id, teacherId: teacher.id, code: 'INFO102', title: "Mathématiques pour l'informatique", level: 'Licence 1', credits: 4 },
    { schoolId: school.id, teacherId: teacher.id, code: 'INFO201', title: 'Structures de données avancées', level: 'Licence 2', credits: 5 },
    { schoolId: school.id, teacherId: teacher.id, code: 'INFO401', title: 'Intelligence artificielle', level: 'Master 1', credits: 6 },
    // ESPA — Informatique (prof. Fetra)
    { schoolId: school.id, teacherId: tId('prof.fetra.ravao@espa.mg'), code: 'INFO202', title: 'Réseaux informatiques', level: 'Licence 2', credits: 5 },
    { schoolId: school.id, teacherId: tId('prof.fetra.ravao@espa.mg'), code: 'INFO302', title: 'Sécurité des systèmes', level: 'Licence 3', credits: 5 },
    { schoolId: school.id, teacherId: tId('prof.fetra.ravao@espa.mg'), code: 'INFO303', title: 'Cloud computing', level: 'Licence 3', credits: 5 },
    { schoolId: school.id, teacherId: tId('prof.fetra.ravao@espa.mg'), code: 'INFO402', title: 'Génie logiciel', level: 'Master 1', credits: 6 },
    // ESPA — Génie Civil (prof. Andry)
    { schoolId: school.id, teacherId: tId('prof.andry.ratsim@espa.mg'), code: 'GC101', title: 'Résistance des matériaux', level: 'Licence 1', credits: 4 },
    { schoolId: school.id, teacherId: tId('prof.andry.ratsim@espa.mg'), code: 'GC201', title: 'Topographie', level: 'Licence 2', credits: 5 },
    { schoolId: school.id, teacherId: tId('prof.andry.ratsim@espa.mg'), code: 'GC301', title: 'Béton armé', level: 'Licence 3', credits: 5 },
    { schoolId: school.id, teacherId: tId('prof.andry.ratsim@espa.mg'), code: 'GC401', title: 'Structures métalliques', level: 'Master 1', credits: 6 },
    { schoolId: school.id, teacherId: tId('prof.andry.ratsim@espa.mg'), code: 'GC402', title: 'Hydraulique', level: 'Master 1', credits: 6 },
    // IST Mahajanga — Informatique (prof. Rakoto)
    { schoolId: seededSchools[0].id, teacherId: teacher.id, code: 'INFOIST101', title: 'Algorithmique de base', level: 'Licence 1', credits: 4 },
    { schoolId: seededSchools[0].id, teacherId: teacher.id, code: 'INFOIST302', title: "Systèmes d'exploitation", level: 'Licence 3', credits: 5 },
    // IST Mahajanga — Informatique (prof. Tojo)
    { schoolId: seededSchools[0].id, teacherId: tId('prof.tojo.rasolo@ist-mahajanga.mg'), code: 'INFOIST201', title: 'Programmation orientée objet', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[0].id, teacherId: tId('prof.tojo.rasolo@ist-mahajanga.mg'), code: 'INFOIST301', title: 'Développement web', level: 'Licence 3', credits: 5 },
    { schoolId: seededSchools[0].id, teacherId: tId('prof.tojo.rasolo@ist-mahajanga.mg'), code: 'INFOIST401', title: 'Développement mobile', level: 'Licence Professionnelle', credits: 6 },
    { schoolId: seededSchools[0].id, teacherId: tId('prof.tojo.rasolo@ist-mahajanga.mg'), code: 'INFOIST402', title: 'Cybersécurité appliquée', level: 'Licence Professionnelle', credits: 6 },
    // IST Mahajanga — Génie Civil (prof. Onja)
    { schoolId: seededSchools[0].id, teacherId: tId('prof.onja.andriamanjato@ist-mahajanga.mg'), code: 'GCIST101', title: 'Dessin technique', level: 'Licence 1', credits: 4 },
    { schoolId: seededSchools[0].id, teacherId: tId('prof.onja.andriamanjato@ist-mahajanga.mg'), code: 'GCIST201', title: 'Topographie appliquée', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[0].id, teacherId: tId('prof.onja.andriamanjato@ist-mahajanga.mg'), code: 'GCIST301', title: 'Chantier et sécurité', level: 'Licence 3', credits: 5 },
    { schoolId: seededSchools[0].id, teacherId: tId('prof.onja.andriamanjato@ist-mahajanga.mg'), code: 'GCIST302', title: 'Matériaux de construction', level: 'Licence 3', credits: 5 },
    // INSCAE — Management (prof. Andria)
    { schoolId: seededSchools[1].id, teacherId: teacher2.id, code: 'MGT101', title: 'Introduction au management', level: 'Licence 1', credits: 4 },
    { schoolId: seededSchools[1].id, teacherId: teacher2.id, code: 'MGT302', title: 'Gestion des ressources humaines', level: 'Licence 3', credits: 5 },
    { schoolId: seededSchools[1].id, teacherId: teacher2.id, code: 'MGT401', title: "Stratégie d'entreprise", level: 'Master 1', credits: 6 },
    { schoolId: seededSchools[1].id, teacherId: teacher2.id, code: 'MGT402', title: 'Entrepreneuriat', level: 'Master 2', credits: 6 },
    // INSCAE — Finance (prof. Voninkazo)
    { schoolId: seededSchools[1].id, teacherId: tId('prof.voninkazo.razafind@inscae.mg'), code: 'FIN101', title: 'Comptabilité générale', level: 'Licence 1', credits: 4 },
    { schoolId: seededSchools[1].id, teacherId: tId('prof.voninkazo.razafind@inscae.mg'), code: 'FIN201', title: 'Analyse financière', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[1].id, teacherId: tId('prof.voninkazo.razafind@inscae.mg'), code: 'FIN301', title: 'Gestion de portefeuille', level: 'Licence 3', credits: 5 },
    { schoolId: seededSchools[1].id, teacherId: tId('prof.voninkazo.razafind@inscae.mg'), code: 'FIN401', title: 'Ingénierie financière', level: 'Master 1', credits: 6 },
    // INSCAE — Marketing (prof. Solofo)
    { schoolId: seededSchools[1].id, teacherId: tId('prof.solofo.andriantsoa@inscae.mg'), code: 'MKT201', title: 'Marketing fondamental', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[1].id, teacherId: tId('prof.solofo.andriantsoa@inscae.mg'), code: 'MKT301', title: 'Marketing digital', level: 'Licence 3', credits: 5 },
    // Université de Toamasina — Économie (prof. Andria)
    { schoolId: seededSchools[2].id, teacherId: teacher2.id, code: 'ECO201', title: 'Macroéconomie', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[2].id, teacherId: teacher2.id, code: 'ECO301', title: 'Économie du développement', level: 'Licence 3', credits: 5 },
    // Université de Toamasina — Santé (prof. Sitraka)
    { schoolId: seededSchools[2].id, teacherId: tId('prof.sitraka.ramanantsoa@univ-toamasina.mg'), code: 'SANTE101', title: 'Anatomie', level: 'Licence 1', credits: 5 },
    { schoolId: seededSchools[2].id, teacherId: tId('prof.sitraka.ramanantsoa@univ-toamasina.mg'), code: 'SANTE201', title: 'Physiologie', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[2].id, teacherId: tId('prof.sitraka.ramanantsoa@univ-toamasina.mg'), code: 'SANTE301', title: 'Santé publique', level: 'Licence 3', credits: 5 },
    // Université de Fianarantsoa — Agronomie (prof. Faly)
    { schoolId: seededSchools[3].id, teacherId: tId('prof.faly.rajaon@univ-fianarantsoa.mg'), code: 'AGRO101', title: 'Botanique', level: 'Licence 1', credits: 4 },
    { schoolId: seededSchools[3].id, teacherId: tId('prof.faly.rajaon@univ-fianarantsoa.mg'), code: 'AGRO201', title: 'Agroécologie', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[3].id, teacherId: tId('prof.faly.rajaon@univ-fianarantsoa.mg'), code: 'AGRO301', title: 'Élevage et zootechnie', level: 'Licence 3', credits: 5 },
    { schoolId: seededSchools[3].id, teacherId: tId('prof.faly.rajaon@univ-fianarantsoa.mg'), code: 'AGRO401', title: 'Développement rural', level: 'Master 1', credits: 6 },
    // ISCAM — Communication (prof. Malala)
    { schoolId: seededSchools[4].id, teacherId: tId('prof.malala.rakotoson@iscam.mg'), code: 'COM101', title: 'Techniques de communication', level: 'Licence 1', credits: 4 },
    { schoolId: seededSchools[4].id, teacherId: tId('prof.malala.rakotoson@iscam.mg'), code: 'COM201', title: 'Relations publiques', level: 'Licence 2', credits: 5 },
    { schoolId: seededSchools[4].id, teacherId: tId('prof.malala.rakotoson@iscam.mg'), code: 'COM301', title: 'Communication digitale', level: 'Licence 3', credits: 5 },
    { schoolId: seededSchools[4].id, teacherId: tId('prof.malala.rakotoson@iscam.mg'), code: 'COM401', title: 'Stratégie de communication', level: 'Master 1', credits: 6 },
  ];

  const TIME_BLOCKS = [
    { start: '08:00', end: '10:00' },
    { start: '10:00', end: '12:00' },
    { start: '13:00', end: '15:00' },
    { start: '15:00', end: '17:00' },
  ];
  const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const coursesByCode: Record<string, { id: string; schoolId: string; room: string | null }> = {
    INFO301: firstCourse,
    ALGO201: secondCourse,
    BDD301: thirdCourse,
    MGT201: mgtCourse,
    ECO101: ecoCourse,
  };
  for (let i = 0; i < courseDefs.length; i++) {
    const def = courseDefs[i];
    const room = `Salle ${(i % 12) + 1}`;
    const dayOfWeek = (i % 5) + 1;
    const tb = TIME_BLOCKS[i % TIME_BLOCKS.length];
    const course = await prisma.course.upsert({
      where: { schoolId_code_group: { schoolId: def.schoolId, code: def.code, group: 'Groupe A' } },
      update: { teacherId: def.teacherId, title: def.title, level: def.level, credits: def.credits },
      create: {
        schoolId: def.schoolId,
        teacherId: def.teacherId,
        code: def.code,
        title: def.title,
        description: `Cours de ${def.title} (${def.level}).`,
        level: def.level,
        group: 'Groupe A',
        credits: def.credits,
        room,
        schedule: `${DAY_NAMES[i % DAY_NAMES.length]} ${tb.start} – ${tb.end}`,
      },
    });
    await prisma.courseSlot.upsert({
      where: {
        courseId_dayOfWeek_startTime_endTime_room: {
          courseId: course.id, dayOfWeek, startTime: tb.start, endTime: tb.end, room,
        },
      },
      update: {},
      create: { courseId: course.id, dayOfWeek, startTime: tb.start, endTime: tb.end, room },
    });
    coursesByCode[def.code] = course;
  }
  console.log(`✅ ${courseDefs.length} cours supplémentaires créés (total ${Object.keys(coursesByCode).length} types de cours)`);

  // ────────────────────────────────────────────
  //  COHORTES D'ÉTUDIANTS (~112 étudiants, profils complets, par cursus/niveau)
  // ────────────────────────────────────────────
  const tracks = [
    { schoolTag: 'espa', schoolId: school.id, trackTag: 'info', cursus: 'Informatique', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['INFO101', 'INFO102'], count: 4, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['INFO201', 'INFO202'], count: 4, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['INFO301', 'INFO302', 'INFO303', 'BDD301'], count: 4, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
      { tag: 'm1', label: 'Master 1', courseCodes: ['INFO401', 'INFO402'], count: 3, minAge: 22, maxAge: 25, bacYearRange: [2021, 2023], finishing: false },
    ]},
    { schoolTag: 'espa', schoolId: school.id, trackTag: 'gc', cursus: 'Génie Civil', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['GC101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['GC201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['GC301'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
      { tag: 'm1', label: 'Master 1', courseCodes: ['GC401', 'GC402'], count: 2, minAge: 22, maxAge: 25, bacYearRange: [2021, 2023], finishing: false },
    ]},
    { schoolTag: 'ist', schoolId: seededSchools[0].id, trackTag: 'info', cursus: 'Informatique', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['INFOIST101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['INFOIST201', 'ALGO201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['INFOIST301', 'INFOIST302'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
      { tag: 'lp', label: 'Licence Professionnelle', courseCodes: ['INFOIST401', 'INFOIST402'], count: 2, minAge: 21, maxAge: 24, bacYearRange: [2022, 2023], finishing: true },
    ]},
    { schoolTag: 'ist', schoolId: seededSchools[0].id, trackTag: 'gc', cursus: 'Génie Civil', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['GCIST101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['GCIST201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['GCIST301', 'GCIST302'], count: 2, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
    ]},
    { schoolTag: 'inscae', schoolId: seededSchools[1].id, trackTag: 'mgmt', cursus: 'Management', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['MGT101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['MGT302'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
      { tag: 'm1', label: 'Master 1', courseCodes: ['MGT201', 'MGT401'], count: 2, minAge: 22, maxAge: 25, bacYearRange: [2021, 2023], finishing: false },
      { tag: 'm2', label: 'Master 2', courseCodes: ['MGT402'], count: 2, minAge: 23, maxAge: 26, bacYearRange: [2020, 2022], finishing: true },
    ]},
    { schoolTag: 'inscae', schoolId: seededSchools[1].id, trackTag: 'finance', cursus: 'Finance', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['FIN101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['FIN201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['FIN301'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
      { tag: 'm1', label: 'Master 1', courseCodes: ['FIN401'], count: 2, minAge: 22, maxAge: 25, bacYearRange: [2021, 2023], finishing: false },
    ]},
    { schoolTag: 'inscae', schoolId: seededSchools[1].id, trackTag: 'mkt', cursus: 'Marketing', levels: [
      { tag: 'l2', label: 'Licence 2', courseCodes: ['MKT201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['MKT301'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
    ]},
    { schoolTag: 'toamasina', schoolId: seededSchools[2].id, trackTag: 'eco', cursus: 'Économie', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['ECO101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['ECO201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['ECO301'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
    ]},
    { schoolTag: 'toamasina', schoolId: seededSchools[2].id, trackTag: 'sante', cursus: 'Sciences de la santé', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['SANTE101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['SANTE201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['SANTE301'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
    ]},
    { schoolTag: 'fianarantsoa', schoolId: seededSchools[3].id, trackTag: 'agro', cursus: 'Agronomie', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['AGRO101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['AGRO201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['AGRO301'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
      { tag: 'm1', label: 'Master 1', courseCodes: ['AGRO401'], count: 2, minAge: 22, maxAge: 25, bacYearRange: [2021, 2023], finishing: false },
    ]},
    { schoolTag: 'iscam', schoolId: seededSchools[4].id, trackTag: 'com', cursus: 'Communication', levels: [
      { tag: 'l1', label: 'Licence 1', courseCodes: ['COM101'], count: 3, minAge: 18, maxAge: 20, bacYearRange: [2025, 2026], finishing: false },
      { tag: 'l2', label: 'Licence 2', courseCodes: ['COM201'], count: 3, minAge: 19, maxAge: 21, bacYearRange: [2024, 2025], finishing: false },
      { tag: 'l3', label: 'Licence 3', courseCodes: ['COM301'], count: 3, minAge: 20, maxAge: 23, bacYearRange: [2023, 2024], finishing: true },
      { tag: 'm1', label: 'Master 1', courseCodes: ['COM401'], count: 2, minAge: 22, maxAge: 25, bacYearRange: [2021, 2023], finishing: false },
    ]},
  ];

  const bulkStudentPassword = await bcrypt.hash('Etudiant2026!', 10);
  let globalSeed = 1000;
  let generatedStudentCount = 0;
  const bulkEnrollments: { courseId: string; studentId: string }[] = [];
  const bulkGradeTargets: { courseCode: string; studentId: string; seed: number }[] = [];

  for (const track of tracks) {
    for (const level of track.levels) {
      for (let i = 1; i <= level.count; i++) {
        globalSeed += 7;
        const gender = globalSeed % 2 === 0 ? 'MALE' : 'FEMALE';
        const firstName = pick(gender === 'MALE' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES, globalSeed);
        const lastName = pick(LAST_NAMES, globalSeed + 11);
        const email = `etu.${track.schoolTag}.${track.trackTag}.${level.tag}.${i}@get.mg`;
        const profile = buildProfile(globalSeed, {
          minAge: level.minAge,
          maxAge: level.maxAge,
          bacYearRange: level.bacYearRange as [number, number],
          finishing: level.finishing,
        });
        const user = await prisma.user.upsert({
          where: { email },
          update: { password: bulkStudentPassword, roleId: studentRole.id, isVerified: true, gender },
          create: { email, password: bulkStudentPassword, roleId: studentRole.id, isVerified: true, gender },
        });
        const student = await prisma.student.upsert({
          where: { userId: user.id },
          update: {
            firstName,
            lastName,
            ...profile,
            profileCompleted: true,
            enrolledSchoolId: track.schoolId,
            enrolledYear: `${level.label} ${track.cursus}`,
          },
          create: {
            userId: user.id,
            firstName,
            lastName,
            ...profile,
            profileCompleted: true,
            enrolledSchoolId: track.schoolId,
            enrolledYear: `${level.label} ${track.cursus}`,
          },
        });
        generatedStudentCount++;
        for (const code of level.courseCodes) {
          const course = coursesByCode[code];
          if (!course) continue;
          bulkEnrollments.push({ courseId: course.id, studentId: student.id });
          bulkGradeTargets.push({ courseCode: code, studentId: student.id, seed: globalSeed });
        }
      }
    }
  }
  await prisma.courseEnrollment.createMany({ data: bulkEnrollments, skipDuplicates: true });
  console.log(
    `✅ ${generatedStudentCount} étudiants supplémentaires créés avec profils complets (${bulkEnrollments.length} inscriptions aux cours) — mot de passe : Etudiant2026!`,
  );

  // ────────────────────────────────────────────
  //  ÉVALUATIONS ET NOTES SIMULÉES SUR TOUS LES COURS
  // ────────────────────────────────────────────
  const CC_TITLE = 'Contrôle continu 1';
  const EXAM_TITLE = 'Examen final';
  const targetsByCourse = new Map<string, { studentId: string; seed: number }[]>();
  for (const target of bulkGradeTargets) {
    if (!targetsByCourse.has(target.courseCode)) targetsByCourse.set(target.courseCode, []);
    targetsByCourse.get(target.courseCode)!.push({ studentId: target.studentId, seed: target.seed });
  }
  let simulatedGradeCount = 0;
  for (const [code, targets] of targetsByCourse) {
    const course = coursesByCode[code];
    if (!course) continue;
    let ccEvaluation = await prisma.evaluation.findFirst({ where: { courseId: course.id, title: CC_TITLE } });
    if (!ccEvaluation) {
      ccEvaluation = await prisma.evaluation.create({
        data: {
          courseId: course.id,
          title: CC_TITLE,
          type: 'CONTROLE_CONTINU',
          scheduledAt: new Date('2026-06-10T08:00:00.000Z'),
          coefficient: 1,
        },
      });
    }
    const examEvaluation = await prisma.evaluation.findFirst({ where: { courseId: course.id, title: EXAM_TITLE } });
    if (!examEvaluation) {
      await prisma.evaluation.create({
        data: {
          courseId: course.id,
          title: EXAM_TITLE,
          type: 'EXAMEN',
          scheduledAt: new Date('2026-09-25T08:00:00.000Z'),
          coefficient: 2,
        },
      });
    }
    for (const target of targets) {
      const value = Math.round((7 + (target.seed % 12)) * 10) / 10;
      await prisma.grade.upsert({
        where: { evaluationId_studentId: { evaluationId: ccEvaluation.id, studentId: target.studentId } },
        update: {},
        create: {
          evaluationId: ccEvaluation.id,
          studentId: target.studentId,
          value,
          comment: value >= 10 ? 'Admis' : 'À rattraper',
        },
      });
      simulatedGradeCount++;
    }
  }
  console.log(
    `✅ ${simulatedGradeCount} notes simulées sur ${targetsByCourse.size} cours (contrôle continu noté, examen final à venir)`,
  );

  // ────────────────────────────────────────────
  //  ~17 OFFRES SUPPLÉMENTAIRES (total ≥ 20)
  // ────────────────────────────────────────────
  const moreOffers = [
    { schoolId: school.id, slug: 'licence-genie-civil-espa-2026', title: 'Licence Génie Civil', description: 'Formation en conception et construction d’ouvrages.', diploma: 'Licence', duration: 36, tuitionFees: 3200000, prerequisites: ['Baccalauréat scientifique'], capacity: 90, academicYear: '2026-2027', isFeatured: false },
    { schoolId: school.id, slug: 'master-informatique-ia-espa-2026', title: 'Master Informatique - Intelligence Artificielle', description: 'Spécialisation en IA, machine learning et data science.', diploma: 'Master', duration: 24, tuitionFees: 5200000, prerequisites: ['Licence Informatique ou équivalent'], capacity: 40, academicYear: '2026-2027', isFeatured: true },
    { schoolId: school.id, slug: 'licence-reseaux-securite-espa-2026', title: 'Licence Réseaux et Sécurité', description: 'Administration réseaux et cybersécurité.', diploma: 'Licence', duration: 36, tuitionFees: 3400000, prerequisites: ['Baccalauréat scientifique'], capacity: 60, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[0].id, slug: 'dut-genie-civil-ist-2026', title: 'DUT Génie Civil', description: 'Formation professionnalisante en bâtiment et travaux publics.', diploma: 'DUT', duration: 24, tuitionFees: 2400000, prerequisites: ['Baccalauréat'], capacity: 70, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[0].id, slug: 'licence-pro-dev-web-ist-2026', title: 'Licence Professionnelle Développement Web', description: 'Formation courte et intensive au développement web.', diploma: 'Licence Professionnelle', duration: 12, tuitionFees: 1800000, prerequisites: ['DUT Informatique ou équivalent'], capacity: 50, academicYear: '2026-2027', isFeatured: true },
    { schoolId: seededSchools[1].id, slug: 'licence-finance-inscae-2026', title: 'Licence Finance', description: 'Fondamentaux de la finance d’entreprise et des marchés.', diploma: 'Licence', duration: 36, tuitionFees: 4200000, prerequisites: ['Baccalauréat'], capacity: 80, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[1].id, slug: 'licence-marketing-inscae-2026', title: 'Licence Marketing', description: 'Stratégie marketing, communication et vente.', diploma: 'Licence', duration: 36, tuitionFees: 4000000, prerequisites: ['Baccalauréat'], capacity: 70, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[1].id, slug: 'master-entrepreneuriat-inscae-2026', title: 'Master Entrepreneuriat', description: 'Création et gestion de start-up.', diploma: 'Master', duration: 24, tuitionFees: 5600000, prerequisites: ['Licence ou équivalent'], capacity: 35, academicYear: '2026-2027', isFeatured: true },
    { schoolId: seededSchools[1].id, slug: 'licence-rh-inscae-2026', title: 'Licence Gestion des Ressources Humaines', description: 'Gestion du capital humain en entreprise.', diploma: 'Licence', duration: 36, tuitionFees: 4100000, prerequisites: ['Baccalauréat'], capacity: 60, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[2].id, slug: 'licence-economie-toamasina-2026', title: 'Licence Économie', description: 'Analyse économique et politiques publiques.', diploma: 'Licence', duration: 36, tuitionFees: 2600000, prerequisites: ['Baccalauréat'], capacity: 90, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[2].id, slug: 'licence-sciences-sante-toamasina-2026', title: 'Licence Sciences de la Santé', description: 'Formation initiale aux sciences de la santé.', diploma: 'Licence', duration: 36, tuitionFees: 3000000, prerequisites: ['Baccalauréat scientifique'], capacity: 100, academicYear: '2026-2027', isFeatured: true },
    { schoolId: seededSchools[2].id, slug: 'master-economie-dev-toamasina-2026', title: 'Master Économie du Développement', description: 'Économie appliquée au développement.', diploma: 'Master', duration: 24, tuitionFees: 3800000, prerequisites: ['Licence Économie ou équivalent'], capacity: 30, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[3].id, slug: 'licence-agronomie-fianarantsoa-2026', title: 'Licence Agronomie', description: 'Sciences agronomiques et production végétale.', diploma: 'Licence', duration: 36, tuitionFees: 2500000, prerequisites: ['Baccalauréat scientifique'], capacity: 70, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[3].id, slug: 'master-developpement-rural-fianarantsoa-2026', title: 'Master Développement Rural', description: 'Politiques et projets de développement rural.', diploma: 'Master', duration: 24, tuitionFees: 3400000, prerequisites: ['Licence Agronomie ou équivalent'], capacity: 25, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[4].id, slug: 'licence-communication-iscam-2026', title: 'Licence Communication', description: 'Communication institutionnelle et médias.', diploma: 'Licence', duration: 36, tuitionFees: 3900000, prerequisites: ['Baccalauréat'], capacity: 65, academicYear: '2026-2027', isFeatured: true },
    { schoolId: seededSchools[4].id, slug: 'master-communication-strategique-iscam-2026', title: 'Master Communication Stratégique', description: 'Stratégies de communication avancées.', diploma: 'Master', duration: 24, tuitionFees: 5000000, prerequisites: ['Licence Communication ou équivalent'], capacity: 30, academicYear: '2026-2027', isFeatured: false },
    { schoolId: seededSchools[4].id, slug: 'licence-relations-publiques-iscam-2026', title: 'Licence Relations Publiques', description: 'Relations presse, événementiel et image de marque.', diploma: 'Licence', duration: 36, tuitionFees: 3700000, prerequisites: ['Baccalauréat'], capacity: 55, academicYear: '2026-2027', isFeatured: false },
  ];
  await Promise.all(
    moreOffers.map((offer) =>
      prisma.offer.upsert({
        where: { slug: offer.slug },
        update: { ...offer, isOpen: true, applicationDeadline: new Date('2026-12-31T23:59:59.000Z'), deletedAt: null },
        create: { ...offer, currency: 'MGA', isOpen: true, applicationDeadline: new Date('2026-12-31T23:59:59.000Z') },
      }),
    ),
  );
  const allOffers = await prisma.offer.findMany({ select: { id: true } });
  console.log(`✅ ${moreOffers.length} offres supplémentaires créées (total ${allOffers.length} offres)`);

  // ────────────────────────────────────────────
  //  ~55 CANDIDATS NON INSCRITS (total ≥ 50), profils complets + candidatures
  // ────────────────────────────────────────────
  const candidatePassword2 = await bcrypt.hash('Candidat2026!', 10);
  const APPLICATION_STATUSES = [
    'PENDING', 'PRESELECTED', 'TEST_SCHEDULED', 'TEST_COMPLETED',
    'INTERVIEW_SCHEDULED', 'ACCEPTED', 'REJECTED', 'WAITLISTED',
  ];
  const slugify = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let generatedCandidateCount = 0;
  let applicationCount = 0;
  for (let idx = 1; idx <= 55; idx++) {
    const seed = 5000 + idx * 13;
    const gender = seed % 2 === 0 ? 'MALE' : 'FEMALE';
    const firstName = pick(gender === 'MALE' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES, seed);
    const lastName = pick(LAST_NAMES, seed + 3);
    const email = `${slugify(firstName)}.${slugify(lastName)}${idx}@get.mg`;
    const profile = buildProfile(seed, { minAge: 18, maxAge: 22, bacYearRange: [2023, 2026], finishing: false });
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: candidatePassword2, roleId: studentRole.id, isVerified: true, gender },
      create: { email, password: candidatePassword2, roleId: studentRole.id, isVerified: true, gender },
    });
    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: { firstName, lastName, ...profile, profileCompleted: true, enrolledSchoolId: null, enrolledYear: null },
      create: { userId: user.id, firstName, lastName, ...profile, profileCompleted: true },
    });
    generatedCandidateCount++;
    const offer = pick(allOffers, seed);
    const status = pick(APPLICATION_STATUSES, idx);
    const hasScore = status !== 'PENDING' && status !== 'PRESELECTED';
    const application = await prisma.application.upsert({
      where: { studentId_offerId: { studentId: student.id, offerId: offer.id } },
      update: {},
      create: {
        studentId: student.id,
        offerId: offer.id,
        status,
        score: hasScore ? Math.round((40 + (seed % 55)) * 10) / 10 : null,
      },
    });
    const existingTimeline = await prisma.applicationTimeline.findFirst({
      where: { applicationId: application.id, status },
    });
    if (!existingTimeline) {
      await prisma.applicationTimeline.create({
        data: { applicationId: application.id, status, createdBy: admin.id },
      });
    }
    applicationCount++;
  }
  console.log(
    `✅ ${generatedCandidateCount} candidats non inscrits créés avec profils complets et candidatures (${applicationCount}) — mot de passe : Candidat2026!`,
  );

  // ══════════════════════════════════════════════════════════════
  //  MATIÈRES, FILIÈRES, ANNÉES ACADÉMIQUES, PAIEMENTS, ANNONCES D'ÉCOLE
  //  (données consommées par le portail école : people-directory,
  //  course-directory, student-import-directory, page paiements)
  // ══════════════════════════════════════════════════════════════
  const schoolIdByTag: Record<string, string> = {
    espa: school.id,
    ist: seededSchools[0].id,
    inscae: seededSchools[1].id,
    toamasina: seededSchools[2].id,
    fianarantsoa: seededSchools[3].id,
    iscam: seededSchools[4].id,
  };

  // ────────────────────────────────────────────
  //  MATIÈRES (SchoolSubject) + AFFECTATIONS PROF ↔ MATIÈRE
  // ────────────────────────────────────────────
  const subjectDefsBySchool: Record<string, string[]> = {
    espa: ['Informatique', 'Génie Civil', 'Mathématiques', 'Réseaux et Sécurité', 'Structures et bâtiments'],
    ist: ['Informatique', 'Génie Civil', 'Développement Web', 'Topographie'],
    inscae: ['Management', 'Finance', 'Marketing', 'Comptabilité', 'Entrepreneuriat'],
    toamasina: ['Économie', 'Sciences de la Santé', 'Biologie'],
    fianarantsoa: ['Agronomie', 'Agroécologie', 'Élevage'],
    iscam: ['Communication', 'Relations Publiques', 'Marketing Digital'],
  };
  const subjectIdsByTag: Record<string, Map<string, string>> = {};
  for (const [tag, names] of Object.entries(subjectDefsBySchool)) {
    const map = new Map<string, string>();
    for (const name of names) {
      const subject = await prisma.schoolSubject.upsert({
        where: { schoolId_name: { schoolId: schoolIdByTag[tag], name } },
        update: {},
        create: { schoolId: schoolIdByTag[tag], name },
      });
      map.set(name, subject.id);
    }
    subjectIdsByTag[tag] = map;
  }
  console.log('✅ Matières créées pour les 6 établissements');

  const teacherSubjectAssignments = [
    { teacherId: teacher.id, schoolTag: 'espa', subjects: ['Informatique', 'Mathématiques'] },
    { teacherId: teacher.id, schoolTag: 'ist', subjects: ['Informatique'] },
    { teacherId: teacher2.id, schoolTag: 'inscae', subjects: ['Management', 'Entrepreneuriat'] },
    { teacherId: teacher2.id, schoolTag: 'toamasina', subjects: ['Économie'] },
    { teacherId: tId('prof.andry.ratsim@espa.mg'), schoolTag: 'espa', subjects: ['Génie Civil', 'Structures et bâtiments'] },
    { teacherId: tId('prof.fetra.ravao@espa.mg'), schoolTag: 'espa', subjects: ['Informatique', 'Réseaux et Sécurité'] },
    { teacherId: tId('prof.tojo.rasolo@ist-mahajanga.mg'), schoolTag: 'ist', subjects: ['Informatique', 'Développement Web'] },
    { teacherId: tId('prof.onja.andriamanjato@ist-mahajanga.mg'), schoolTag: 'ist', subjects: ['Génie Civil', 'Topographie'] },
    { teacherId: tId('prof.voninkazo.razafind@inscae.mg'), schoolTag: 'inscae', subjects: ['Finance', 'Comptabilité'] },
    { teacherId: tId('prof.solofo.andriantsoa@inscae.mg'), schoolTag: 'inscae', subjects: ['Marketing'] },
    { teacherId: tId('prof.sitraka.ramanantsoa@univ-toamasina.mg'), schoolTag: 'toamasina', subjects: ['Sciences de la Santé', 'Biologie'] },
    { teacherId: tId('prof.faly.rajaon@univ-fianarantsoa.mg'), schoolTag: 'fianarantsoa', subjects: ['Agronomie', 'Agroécologie'] },
    { teacherId: tId('prof.malala.rakotoson@iscam.mg'), schoolTag: 'iscam', subjects: ['Communication', 'Marketing Digital'] },
  ];
  let subjectLinkCount = 0;
  for (const assignment of teacherSubjectAssignments) {
    const teacherSchool = await prisma.teacherSchool.findUnique({
      where: {
        teacherId_schoolId: { teacherId: assignment.teacherId, schoolId: schoolIdByTag[assignment.schoolTag] },
      },
    });
    if (!teacherSchool) continue;
    for (const subjectName of assignment.subjects) {
      const subjectId = subjectIdsByTag[assignment.schoolTag].get(subjectName);
      if (!subjectId) continue;
      await prisma.teacherSchoolSubject.upsert({
        where: { teacherSchoolId_subjectId: { teacherSchoolId: teacherSchool.id, subjectId } },
        update: {},
        create: { teacherSchoolId: teacherSchool.id, subjectId },
      });
      subjectLinkCount++;
    }
  }
  console.log(`✅ ${subjectLinkCount} affectations matière ↔ professeur créées`);

  // ────────────────────────────────────────────
  //  FILIÈRES (SchoolProgram)
  // ────────────────────────────────────────────
  const programDefsBySchool: Record<string, { name: string; diploma: string; durationYears: number }[]> = {
    espa: [
      { name: 'Licence Informatique', diploma: 'Licence', durationYears: 3 },
      { name: 'Licence Génie Civil', diploma: 'Licence', durationYears: 3 },
      { name: 'Master Informatique', diploma: 'Master', durationYears: 2 },
      { name: 'Master Génie Civil', diploma: 'Master', durationYears: 2 },
    ],
    ist: [
      { name: 'DUT Informatique', diploma: 'DUT', durationYears: 2 },
      { name: 'DUT Génie Civil', diploma: 'DUT', durationYears: 2 },
      { name: 'Licence Professionnelle Informatique', diploma: 'Licence Professionnelle', durationYears: 1 },
    ],
    inscae: [
      { name: 'Licence Management', diploma: 'Licence', durationYears: 3 },
      { name: 'Licence Finance', diploma: 'Licence', durationYears: 3 },
      { name: 'Licence Marketing', diploma: 'Licence', durationYears: 3 },
      { name: 'Master Entrepreneuriat', diploma: 'Master', durationYears: 2 },
    ],
    toamasina: [
      { name: 'Licence Économie', diploma: 'Licence', durationYears: 3 },
      { name: 'Licence Sciences de la Santé', diploma: 'Licence', durationYears: 3 },
      { name: 'Master Économie du Développement', diploma: 'Master', durationYears: 2 },
    ],
    fianarantsoa: [
      { name: 'Licence Agronomie', diploma: 'Licence', durationYears: 3 },
      { name: 'Master Développement Rural', diploma: 'Master', durationYears: 2 },
    ],
    iscam: [
      { name: 'Licence Communication', diploma: 'Licence', durationYears: 3 },
      { name: 'Master Communication Stratégique', diploma: 'Master', durationYears: 2 },
    ],
  };
  let programCount = 0;
  for (const [tag, programs] of Object.entries(programDefsBySchool)) {
    for (const p of programs) {
      await prisma.schoolProgram.upsert({
        where: { schoolId_name: { schoolId: schoolIdByTag[tag], name: p.name } },
        update: { diploma: p.diploma, durationYears: p.durationYears, isActive: true },
        create: { schoolId: schoolIdByTag[tag], name: p.name, diploma: p.diploma, durationYears: p.durationYears },
      });
      programCount++;
    }
  }
  console.log(`✅ ${programCount} filières (SchoolProgram) créées`);

  // ────────────────────────────────────────────
  //  ANNÉES ACADÉMIQUES (SchoolAcademicYear)
  // ────────────────────────────────────────────
  for (const schoolId of Object.values(schoolIdByTag)) {
    await prisma.schoolAcademicYear.upsert({
      where: { schoolId_label: { schoolId, label: '2025-2026' } },
      update: {},
      create: {
        schoolId,
        label: '2025-2026',
        enrollmentOpensAt: new Date('2025-03-01T00:00:00.000Z'),
        enrollmentClosesAt: new Date('2025-09-30T23:59:59.000Z'),
        isCurrent: false,
      },
    });
    await prisma.schoolAcademicYear.upsert({
      where: { schoolId_label: { schoolId, label: '2026-2027' } },
      update: { isCurrent: true },
      create: {
        schoolId,
        label: '2026-2027',
        enrollmentOpensAt: new Date('2026-03-01T00:00:00.000Z'),
        enrollmentClosesAt: new Date('2026-09-30T23:59:59.000Z'),
        isCurrent: true,
      },
    });
  }
  console.log('✅ Années académiques créées (2025-2026 et 2026-2027) pour les 6 établissements');

  // ────────────────────────────────────────────
  //  PAIEMENTS, TRANSACTIONS ET REMBOURSEMENTS
  // ────────────────────────────────────────────
  const allApplicationsForPayment = await prisma.application.findMany({
    select: { id: true, studentId: true, status: true, offer: { select: { tuitionFees: true } } },
  });
  const PAYMENT_METHODS = ['ORANGE_MONEY', 'MVOLA', 'CARD', 'BANK_TRANSFER'];
  let paymentSeed = 9000;
  let paymentsCreated = 0;
  for (const application of allApplicationsForPayment) {
    paymentSeed += 13;
    let status: string | null = null;
    if (application.status === 'ACCEPTED') {
      status = paymentSeed % 5 === 0 ? 'REFUNDED' : 'COMPLETED';
    } else if (application.status === 'TEST_SCHEDULED' || application.status === 'INTERVIEW_SCHEDULED') {
      status = 'PENDING';
    } else if (application.status === 'REJECTED' && paymentSeed % 3 === 0) {
      status = 'FAILED';
    }
    if (!status) continue;
    const amount = application.offer.tuitionFees;
    const reference = `PAY-DEMO-${paymentSeed}`;
    const method = pick(PAYMENT_METHODS, paymentSeed);
    const isPaid = status === 'COMPLETED' || status === 'REFUNDED';
    const payment = await prisma.payment.upsert({
      where: { reference },
      update: {},
      create: {
        applicationId: application.id,
        studentId: application.studentId,
        amount,
        currency: 'MGA',
        method,
        status,
        reference,
        commission: Math.round(amount * 0.05),
        paidAt: isPaid ? new Date('2026-07-15T10:00:00.000Z') : null,
        receiptUrl: isPaid ? `https://example.com/receipts/${reference}.pdf` : null,
        expiresAt: status === 'PENDING' ? new Date('2026-08-15T23:59:59.000Z') : null,
      },
    });
    if (isPaid) {
      const existingTransaction = await prisma.transaction.findUnique({ where: { paymentId: payment.id } });
      if (!existingTransaction) {
        await prisma.transaction.create({
          data: {
            paymentId: payment.id,
            type: 'PAYMENT',
            amount,
            provider: method,
            providerTransactionId: `TXN-${reference}`,
            status: 'SUCCESS',
            completedAt: new Date('2026-07-15T10:05:00.000Z'),
          },
        });
      }
    }
    if (status === 'REFUNDED') {
      const existingRefund = await prisma.refund.findUnique({ where: { paymentId: payment.id } });
      if (!existingRefund) {
        await prisma.refund.create({
          data: {
            paymentId: payment.id,
            amount,
            reason: 'Désistement du candidat',
            status: 'COMPLETED',
            processedAt: new Date('2026-07-20T09:00:00.000Z'),
          },
        });
      }
    }
    paymentsCreated++;
  }
  console.log(`✅ ${paymentsCreated} paiements simulés créés (avec transactions et remboursements)`);

  // ────────────────────────────────────────────
  //  ANNONCES D'ÉCOLE (hors cours) + NOTIFICATIONS
  // ────────────────────────────────────────────
  const classAnnouncementDefs = [
    { tag: 'espa', enrolledYear: 'Licence 3 Informatique', title: 'Forum des métiers - Informatique', body: 'Un forum de recrutement aura lieu le 15 septembre pour les étudiants finissants.' },
    { tag: 'ist', enrolledYear: 'Licence 3 Informatique', title: 'Stage de fin d’études', body: 'Les conventions de stage sont à déposer avant le 30 août.' },
    { tag: 'inscae', enrolledYear: 'Licence 3 Management', title: 'Salon de l’emploi INSCAE', body: 'Rencontrez des recruteurs le 20 septembre à l’amphithéâtre principal.' },
    { tag: 'toamasina', enrolledYear: 'Licence 3 Économie', title: 'Remise des diplômes', body: 'La cérémonie de remise des diplômes est fixée au 10 octobre.' },
    { tag: 'fianarantsoa', enrolledYear: 'Licence 3 Agronomie', title: 'Visite de terrain', body: 'Une sortie pédagogique est prévue la semaine prochaine.' },
    { tag: 'iscam', enrolledYear: 'Licence 3 Communication', title: 'Concours de communication', body: 'Inscrivez-vous au concours inter-écoles avant le 5 septembre.' },
  ];
  let announcementNotifCount = 0;
  for (const def of classAnnouncementDefs) {
    const schoolId = schoolIdByTag[def.tag];
    const existingAnnouncement = await prisma.announcement.findFirst({
      where: { schoolId, title: def.title, targetType: 'CLASSES' },
    });
    if (existingAnnouncement) continue;
    const students = await prisma.student.findMany({
      where: { enrolledSchoolId: schoolId, enrolledYear: def.enrolledYear },
      select: { userId: true },
    });
    const announcement = await prisma.announcement.create({
      data: {
        schoolId,
        authorId: admin.id,
        title: def.title,
        body: def.body,
        targetType: 'CLASSES',
        targetClasses: [def.enrolledYear],
      },
    });
    for (const student of students) {
      const notification = await prisma.notification.create({
        data: {
          userId: student.userId,
          type: 'IN_APP',
          title: def.title,
          body: def.body,
          sentAt: new Date(),
          deliveredAt: new Date(),
          isRead: false,
        },
      });
      await prisma.announcementRecipient.create({
        data: { announcementId: announcement.id, userId: student.userId, notificationId: notification.id },
      });
      announcementNotifCount++;
    }
  }
  console.log(
    `✅ ${classAnnouncementDefs.length} annonces d'école créées avec ${announcementNotifCount} notifications`,
  );

  // ────────────────────────────────────────────
  //  DOCUMENTS ÉTUDIANTS — couverture large (tous étudiants inscrits et candidats)
  // ────────────────────────────────────────────
  const allStudentsForDocs = await prisma.student.findMany({
    select: { id: true, firstName: true, lastName: true, enrolledSchoolId: true },
  });
  const existingDocs = await prisma.document.findMany({ select: { studentId: true, name: true } });
  const existingDocKeys = new Set(existingDocs.map((d) => `${d.studentId}::${d.name}`));

  const DOC_TYPES_ENROLLED = [
    { type: 'ID', suffix: 'CIN' },
    { type: 'DIPLOMA', suffix: 'Releve_Bac' },
  ];
  const DOC_TYPES_CANDIDATE = [
    { type: 'CV', suffix: 'CV' },
    { type: 'LETTER', suffix: 'Lettre_Motivation' },
    { type: 'ID', suffix: 'CIN' },
    { type: 'PHOTO', suffix: 'Photo_Identite' },
  ];
  const documentsToCreate: {
    id: string; studentId: string; type: string; name: string; fileUrl: string;
    fileSize: number; mimeType: string; isVerified: boolean; verifiedAt: Date | null; verifiedBy: string | null;
  }[] = [];
  let docSeed = 3000;
  for (const student of allStudentsForDocs) {
    const defs = student.enrolledSchoolId ? DOC_TYPES_ENROLLED : DOC_TYPES_CANDIDATE;
    for (const def of defs) {
      docSeed += 5;
      const name = `${def.suffix}_${student.firstName}${student.lastName}.pdf`;
      const key = `${student.id}::${name}`;
      if (existingDocKeys.has(key)) continue;
      const isVerified = student.enrolledSchoolId ? docSeed % 4 !== 0 : docSeed % 3 === 0;
      documentsToCreate.push({
        id: randomUUID(),
        studentId: student.id,
        type: def.type,
        name,
        fileUrl: `https://example.com/documents/${encodeURIComponent(name)}`,
        fileSize: 150000 + (docSeed % 200) * 1024,
        mimeType: def.type === 'PHOTO' ? 'image/jpeg' : 'application/pdf',
        isVerified,
        verifiedAt: isVerified ? new Date('2026-07-10T09:00:00.000Z') : null,
        verifiedBy: isVerified ? admin.id : null,
      });
      existingDocKeys.add(key);
    }
  }
  if (documentsToCreate.length) {
    await prisma.document.createMany({ data: documentsToCreate });
  }
  console.log(`✅ ${documentsToCreate.length} documents étudiants supplémentaires créés (couverture large)`);

  const demoMessages = [
    {
      senderId: schoolAdmin.id,
      recipientId: enrolledStudent.id,
      subject: 'Réinscription 2025–2026',
      body: 'Bonjour Toavina, la réinscription en ligne est ouverte jusqu’au 30 juin. N’oubliez pas de déposer les documents demandés.',
    },
    {
      senderId: admin.id,
      recipientId: enrolledStudent.id,
      subject: 'Bienvenue dans votre espace étudiant',
      body: 'Votre inscription à ESPA est bien enregistrée. Vous pouvez désormais consulter votre parcours, vos documents et vos messages.',
    },
  ];

  for (const message of demoMessages) {
    const existingMessage = await prisma.message.findFirst({
      where: {
        senderId: message.senderId,
        recipientId: message.recipientId,
        subject: message.subject,
      },
    });

    if (!existingMessage) {
      const directKey = [message.senderId, message.recipientId]
        .sort()
        .join(':');
      const now = new Date();
      const newConversationId = randomUUID();
      await prisma.$executeRaw`INSERT INTO "conversations" ("id", "directKey", "lastMessageAt", "createdAt") VALUES (${newConversationId}, ${directKey}, ${now}, ${now}) ON CONFLICT ("directKey") DO UPDATE SET "lastMessageAt" = EXCLUDED."lastMessageAt"`;
      const conversations = await prisma.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "conversations" WHERE "directKey" = ${directKey}`;
      const conversationId = conversations[0].id;
      await prisma.$executeRaw`INSERT INTO "conversation_participants" ("conversationId", "userId") VALUES (${conversationId}, ${message.senderId}), (${conversationId}, ${message.recipientId}) ON CONFLICT DO NOTHING`;
      await prisma.$executeRaw`INSERT INTO "messages" ("id", "conversationId", "senderId", "recipientId", "subject", "body", "isRead", "createdAt") VALUES (${randomUUID()}, ${conversationId}, ${message.senderId}, ${message.recipientId}, ${message.subject}, ${message.body}, false, ${now})`;
    }
  }
  console.log('✅ Messages de démonstration créés pour enrolled@test.com');

  const finalCounts = await Promise.all([
    prisma.school.count(),
    prisma.teacher.count(),
    prisma.course.count(),
    prisma.student.count({ where: { enrolledSchoolId: { not: null } } }),
    prisma.student.count({ where: { enrolledSchoolId: null } }),
    prisma.offer.count(),
    prisma.courseEnrollment.count(),
    prisma.grade.count(),
    prisma.application.count(),
  ]);
  const [
    schoolCount, teacherCount, courseCount, enrolledCount,
    candidateCount, offerCount, enrollmentCount, gradeCount, applicationCount2,
  ] = finalCounts;

  console.log('\n========== 📊 VOLUMES DE LA BASE DE DÉMONSTRATION ==========');
  console.log(`Établissements        : ${schoolCount}`);
  console.log(`Professeurs           : ${teacherCount}`);
  console.log(`Types de cours        : ${courseCount}`);
  console.log(`Étudiants inscrits    : ${enrolledCount}`);
  console.log(`Candidats non inscrits: ${candidateCount}`);
  console.log(`Offres de formation   : ${offerCount}`);
  console.log(`Inscriptions aux cours: ${enrollmentCount}`);
  console.log(`Notes enregistrées    : ${gradeCount}`);
  console.log(`Candidatures          : ${applicationCount2}`);
  console.log('==============================================================\n');

  console.log('========== 🔑 COMPTES DE DÉMONSTRATION ==========');
  console.log('Admin GET                 : admin@get.mg / Admin123!');
  console.log('School Admin (ESPA)       : schooladmin@get.mg / Mihaja@25!');
  console.log('Ministère                 : ministere@mesupres.gov.mg / Ministere123!');
  console.log('Prof (ESPA + IST)         : prof.rakoto@espa.mg / Professeur123!');
  console.log('Prof (INSCAE + Toamasina) : prof.andria@inscae.mg / Professeur123!');
  console.log('9 autres profs, mot de passe commun : Professeur123!');
  console.log('  prof.andry.ratsim@espa.mg, prof.fetra.ravao@espa.mg,');
  console.log('  prof.tojo.rasolo@ist-mahajanga.mg, prof.onja.andriamanjato@ist-mahajanga.mg,');
  console.log('  prof.voninkazo.razafind@inscae.mg, prof.solofo.andriantsoa@inscae.mg,');
  console.log('  prof.sitraka.ramanantsoa@univ-toamasina.mg, prof.faly.rajaon@univ-fianarantsoa.mg,');
  console.log('  prof.malala.rakotoson@iscam.mg');
  console.log('Candidat (test)           : test@gmail.com / Student123!');
  console.log('Candidate non inscrite    : candidat@get.mg / Candidat123!');
  console.log('Étudiant inscrit ESPA     : enrolled@test.com / Enrolled123!');
  console.log('9 étudiants nommés (IST/INSCAE/Toamasina/ESPA), mot de passe : Etudiant123!');
  console.log(
    `${enrolledCount - 10} étudiants générés (profils complets, tous cursus/écoles), mot de passe : Etudiant2026!`,
  );
  console.log('  → emails au format etu.<ecole>.<cursus>.<niveau>.<n>@get.mg (ex: etu.espa.info.l3.1@get.mg)');
  console.log(`${candidateCount} candidats non inscrits (profils complets + candidature), mot de passe : Candidat2026!`);
  console.log('  → emails au format <prenom>.<nom><n>@get.mg (voir table "students" pour la liste complète)');
  console.log('==================================================\n');

  console.log('🌱 Seeding terminé !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
