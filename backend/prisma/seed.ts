import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a default developer user profile
  const developer = await prisma.user.upsert({
    where: { username: 'chavaliadi' },
    update: {
      email: 'adithya3218@gmail.com',
      avatarUrl: 'https://github.com/chavaliadi.png',
      timezone: 'Asia/Kolkata',
    },
    create: {
      githubId: '63385732', // Mock githubId or standard placeholder
      username: 'chavaliadi',
      email: 'adithya3218@gmail.com',
      avatarUrl: 'https://github.com/chavaliadi.png',
      accessToken: 'placeholder_access_token', // Fallback to GITHUB_PAT in worker
      timezone: 'Asia/Kolkata',
    },
  });

  console.log(`Successfully seeded developer user:`, developer);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
