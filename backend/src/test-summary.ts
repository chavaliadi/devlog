import { PrismaClient } from '@prisma/client';
import { generateDailySummary } from './services/summaryService';

const prisma = new PrismaClient();

async function runTest() {
  console.log('=== Starting AI Summary Service Verification Test ===');

  // 1. Get default developer user
  const defaultUsername = process.env.DEFAULT_DEVELOPER_USERNAME || 'chavaliadi';
  console.log(`Searching for default user '${defaultUsername}'...`);
  let user = await prisma.user.findFirst({
    where: { username: defaultUsername },
  });

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    console.error('❌ Error: No user profiles found in the database. Please seed first (npm run prisma:seed or equivalent).');
    process.exit(1);
  }

  console.log(`Found user: ${user.username} (ID: ${user.id})`);

  // 2. Check if there are commits in the database
  const commitsCount = await prisma.commit.count({
    where: { userId: user.id },
  });
  console.log(`Total commits in DB for this user: ${commitsCount}`);

  // Default target date corresponding to Evan You's test-pipeline commit
  let targetDate = '2026-06-11'; 

  if (commitsCount === 0) {
    console.log('No commits found in DB. Inserting a mock commit for testing...');
    const mockCommit = await prisma.commit.create({
      data: {
        userId: user.id,
        sha: 'd64a1a5557b3caea9469e70b647ff2c9d9def809',
        repository: 'vitejs/vite',
        message: 'fix(css): support external CSS with lightningcss (#18389)',
        diffText: `File: package.json (modified)
@@ -10,4 +10,5 @@
   "dependencies": {
-    "lightningcss": "^1.22.0"
+    "lightningcss": "^1.25.0"
   }
 
File: src/node/plugins/css.ts (modified)
@@ -102,3 +102,6 @@
   if (useLightningCSS) {
-    return compileWithLightning(cssContent);
+    // Support external CSS imports correctly
+    return compileWithLightningExternal(cssContent);
   }`,
        commitDate: new Date('2026-06-11T10:09:16.000Z'),
      },
    });
    console.log('Inserted mock commit:', mockCommit.sha);
  } else {
    // If commits exist, let's find the latest commit date to summarize
    const latestCommit = await prisma.commit.findFirst({
      where: { userId: user.id },
      orderBy: { commitDate: 'desc' },
    });
    if (latestCommit) {
      const userDateStr = latestCommit.commitDate.toLocaleDateString('en-US', {
        timeZone: user.timezone || 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const [m, d, y] = userDateStr.split('/');
      targetDate = `${y}-${m}-${d}`;
    }
  }

  console.log(`\nGenerating summary for date: ${targetDate}...`);

  try {
    const result = await generateDailySummary(user.id, targetDate);
    
    if (result.success && result.entry) {
      console.log('\n✅ Success! AI Daily Summary Generated and Saved.');
      console.log('==================================================');
      console.log(`Entry ID: ${result.entryId}`);
      console.log(`Date: ${result.entry.date.toISOString()}`);
      console.log(`Status: ${result.entry.status}`);
      console.log('\n--- Generated Markdown Devlog Output: ---');
      console.log(result.entry.content);
      console.log('==================================================');
    } else {
      console.error('❌ Failed to generate summary:', result);
    }
  } catch (err: any) {
    console.error('❌ AI Summary Service execution failed with error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
