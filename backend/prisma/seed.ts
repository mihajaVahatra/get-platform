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
  console.log('✅ 3 établissements supplémentaires créés');

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
    update: {},
    create: {
      userId: teacherUser.id,
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
  await prisma.course.upsert({
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
  await prisma.course.upsert({
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
    '✅ 6 étudiants inscrits dans les nouveaux établissements (mot de passe : Etudiant123!)',
  );

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
