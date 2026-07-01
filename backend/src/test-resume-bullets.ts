import { PrismaClient } from '@prisma/client';
import { getCommitsForDate } from './services/summaryService';
import { generateResumeBullets } from './services/aiService';

const prisma = new PrismaClient();

async function run() {
  console.log('=== Running Resume Bullets Injected Stats Test ===');
  
  const entryId = 'f10575d2-7d0e-46d6-94cc-a7934a65fe8b';
  
  try {
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: { user: true }
    });

    if (!entry) {
      console.error(`❌ Error: Entry ${entryId} not found. please run test-summary.ts first.`);
      return;
    }

    // Format target date as YYYY-MM-DD
    const date = new Date(entry.date);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;

    console.log(`Calculating stats for date: ${targetDateStr} ...`);
    const commits = await getCommitsForDate(entry.userId, targetDateStr, entry.user.timezone);

    // Collect unique files
    const uniqueFiles = new Set<string>();
    commits.forEach((commit) => {
      if (commit.diffText) {
        const lines = commit.diffText.split('\n');
        lines.forEach((line) => {
          if (line.startsWith('File: ')) {
            const namePart = line.replace('File: ', '').split(' (')[0];
            if (namePart) {
              uniqueFiles.add(namePart.trim());
            }
          }
        });
      }
    });

    const uniqueRepos = Array.from(new Set(commits.map(c => c.repository)));

    const stats = {
      totalCommits: commits.length,
      uniqueRepos,
      totalFilesChanged: uniqueFiles.size,
    };

    console.log('Stats Computed:');
    console.log(`- Total Commits: ${stats.totalCommits}`);
    console.log(`- Unique Repositories: ${stats.uniqueRepos.join(', ')}`);
    console.log(`- Unique Files Changed: ${stats.totalFilesChanged}`);

    console.log('\nGenerating resume bullets from AI...');
    const bullets = await generateResumeBullets(entry.content, stats);

    console.log('\n--- Generated Quantified Resume Bullets: ---');
    console.log(bullets);
    console.log('==========================================');

  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
