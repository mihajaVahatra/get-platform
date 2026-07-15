import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Créer les rôles
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

  const ministryRole = await prisma.role.upsert({
    where: { name: 'MINISTRY' },
    update: {},
    create: { name: 'MINISTRY', description: 'Ministère' },
  });

  const schoolAdminRole = await prisma.role.upsert({
    where: { name: 'SCHOOL_ADMIN' },
    update: {},
    create: { name: 'SCHOOL_ADMIN', description: 'Administrateur d\'école' },
  });

  console.log('✅ Rôles créés');

  // 2. Créer un admin
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@get.mg' },
    update: {},
    create: {
      email: 'admin@get.mg',
      password: adminPassword,
      roleId: adminRole.id,
      isVerified: true,
    },
  });

  console.log('✅ Admin créé');

  // 3. Créer une école exemple
  const school = await prisma.school.upsert({
    where: { slug: 'esmia' },
    update: {},
    create: {
      name: 'ESMIA - École Supérieure de Management',
      slug: 'esmia',
      description: 'Formation en gestion et commerce international.',
      city: 'Antananarivo',
      region: 'Analamanga',
      type: 'PRIVATE',
      isActive: true,
    },
  });

  console.log(`✅ École créée: ${school.name}`);

  // 4. Créer un étudiant test
  const studentPassword = await bcrypt.hash('Student123!', 10);
  const student = await prisma.user.upsert({
    where: { email: 'jean.rakoto@email.com' },
    update: {},
    create: {
      email: 'jean.rakoto@email.com',
      password: studentPassword,
      roleId: studentRole.id,
      isVerified: true,
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

  console.log(`✅ Étudiant test créé: ${student.email}`);

  console.log('🌱 Seeding terminé !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
