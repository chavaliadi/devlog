import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    console.log('Querying the last 10 commits in the database...');
    const commits = await prisma.commit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        sha: true,
        repository: true,
        message: true,
        aiSummary: true,
        createdAt: true,
      }
    });

    if (commits.length === 0) {
      console.log('No commits found in the database.');
      return;
    }

    commits.forEach((c) => {
      console.log(`- SHA: ${c.sha.substring(0, 8)} | Repo: ${c.repository}`);
      console.log(`  Msg: ${c.message}`);
      console.log(`  AI Summary: ${c.aiSummary ? `"${c.aiSummary}"` : 'NULL (Not generated)'}`);
      console.log('---');
    });

  } catch (err: any) {
    console.error('Error querying commits:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
