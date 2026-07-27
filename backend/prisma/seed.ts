import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
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
      const directKey = [message.senderId, message.recipientId].sort().join(':');
      const now = new Date();
      const newConversationId = randomUUID();
      await prisma.$executeRaw`INSERT INTO "conversations" ("id", "directKey", "lastMessageAt", "createdAt") VALUES (${newConversationId}, ${directKey}, ${now}, ${now}) ON CONFLICT ("directKey") DO UPDATE SET "lastMessageAt" = EXCLUDED."lastMessageAt"`;
      const conversations = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "conversations" WHERE "directKey" = ${directKey}`;
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
