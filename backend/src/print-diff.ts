import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const c = await prisma.commit.findFirst({
    where: { sha: 'd64a1a5557b3caea9469e70b647ff2c9d9def809' }
  });
  console.log('=== Commit Msg ===');
  console.log(c?.message);
  console.log('=== Diff Text ===');
  console.log(c?.diffText);
  await prisma.$disconnect();
}

run();
