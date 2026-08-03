import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'enrolled@test.com' },
    include: { student: { include: { schoolEnrollments: { include: { school: true } } } } },
  });
  console.log(JSON.stringify(user?.student, null, 2));
}

main().finally(() => prisma.$disconnect());
