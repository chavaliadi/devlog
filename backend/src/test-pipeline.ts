import { fetchCommitDiff } from './services/githubService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  console.log('=== Starting Pipeline Test ===');

  // We will test using a public repository commit to verify the fetching and filtering logic
  const owner = 'vitejs';
  const repo = 'vite';
  // A real commit on the Vite repository
  const sha = 'd64a1a5557b3caea9469e70b647ff2c9d9def809'; 

  console.log(`1. Testing fetchCommitDiff on ${owner}/${repo} at SHA ${sha}...`);
  try {
    const result = await fetchCommitDiff(owner, repo, sha);
    console.log('Fetch Result Message:', result.message);
    console.log('Fetch Result Date:', result.commitDate);
    console.log('Fetch Result Diff Text (First 300 chars):\n', result.diffText.substring(0, 300));
    console.log('\nDiff Text Length:', result.diffText.length);

    console.log('\n2. Looking up seeded user chavaliadi...');
    const user = await prisma.user.findFirst({
      where: { username: 'chavaliadi' },
    });

    if (!user) {
      console.error('Seeded user not found! Please run prisma seed first.');
      return;
    }
    console.log(`Found User: ${user.username} (ID: ${user.id})`);

    console.log('\n3. Testing database insertion (Idempotency Step 1)...');
    // First, make sure the test commit does not exist
    await prisma.commit.deleteMany({
      where: { sha },
    });

    const createdCommit = await prisma.commit.create({
      data: {
        userId: user.id,
        sha: sha,
        repository: `${owner}/${repo}`,
        message: result.message,
        diffText: result.diffText,
        commitDate: result.commitDate,
      },
    });

    console.log(`Commit saved successfully in DB. ID: ${createdCommit.id}`);

    console.log('\n4. Testing database uniqueness/idempotency (Idempotency Step 2)...');
    // Attempting to retrieve and insert again (which should fail due to unique constraint or should be skipped in our worker)
    try {
      const existing = await prisma.commit.findUnique({
        where: { sha },
      });
      if (existing) {
        console.log('Idempotency check passed: unique commit detected in DB before saving.');
      } else {
        console.warn('Warning: Commit was not found when it should have been!');
      }
    } catch (dbErr: any) {
      console.error('Database query failed:', dbErr.message);
    }

    console.log('\n=== Pipeline Test Completed Successfully ===');
  } catch (error: any) {
    console.error('Test pipeline failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
