import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Rôles
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
    create: { name: 'SCHOOL_ADMIN', description: 'Administrateur d\'école' },
  });

  console.log('✅ Rôles créés');

  // Admin GET (MALE)
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
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
  console.log('✅ Admin GET créé');

  // School Admin (FEMALE)
  const schoolAdminPassword = await bcrypt.hash('Mihaja@25!', 10);
  await prisma.user.upsert({
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
  console.log('✅ School Admin créé');

  // Étudiant test (MALE)
  const studentPassword = await bcrypt.hash('Student123!', 10);
  const student = await prisma.user.upsert({
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
  console.log(`✅ Étudiant test créé: ${student.email}`);

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
