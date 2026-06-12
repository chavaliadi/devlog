import crypto from 'crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

const SERVER_URL = 'http://localhost:5005';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'devlog_webhook_secret_temp';

async function runTest() {
  console.log('=== Starting Webhook Integration & Idempotency Test ===');

  // 1. Check if the backend server is running
  console.log(`Checking backend server health at ${SERVER_URL}/health...`);
  try {
    const healthRes = await fetch(`${SERVER_URL}/health`);
    if (!healthRes.ok) {
      throw new Error(`Server returned status ${healthRes.status}`);
    }
    const healthData = await healthRes.json();
    console.log('Server Health Status:', JSON.stringify(healthData));
  } catch (err: any) {
    console.error(
      `Error connecting to server: ${err.message}.\nPlease run "npm run dev" in another terminal before starting this test.`
    );
    process.exit(1);
  }

  // 2. Define mock push webhook payload
  const sha = 'd64a1a5557b3caea9469e70b647ff2c9d9def809'; // Valid commit SHA on vitejs/vite
  const repository = 'vitejs/vite';

  const webhookPayload = {
    ref: 'refs/heads/main',
    pusher: {
      name: 'chavaliadi',
      email: 'adithya3218@gmail.com',
    },
    repository: {
      name: 'vite',
      full_name: repository,
      owner: {
        login: 'vitejs',
      },
    },
    commits: [
      {
        id: sha,
        message: 'fix(css): support external CSS with lightningcss (#18389)',
        timestamp: '2026-06-11T10:09:16.000Z',
        author: {
          name: 'Evan You',
          email: 'evan@vitejs.dev',
          username: 'yyx990803',
        },
      },
    ],
  };

  // 3. Clear existing test commit from the database to ensure a clean starting point
  console.log(`Clearing pre-existing commit ${sha} from database...`);
  await prisma.commit.deleteMany({
    where: {
      repository,
      sha,
    },
  });

  // 4. Calculate HMAC signature
  const bodyString = JSON.stringify(webhookPayload);
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(bodyString);
  const signature = `sha256=${hmac.digest('hex')}`;

  console.log('Generated webhook signature:', signature);

  // 5. Send mock webhook request (Insertion Attempt 1)
  console.log('\nSending first push event webhook request (new commit)...');
  const res1 = await fetch(`${SERVER_URL}/webhook/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-github-event': 'push',
      'x-hub-signature-256': signature,
    },
    body: bodyString,
  });

  if (!res1.ok) {
    console.error(`Webhook endpoint failed with status ${res1.status}:`, await res1.text());
    process.exit(1);
  }

  const result1 = await res1.json() as any;
  console.log('Webhook Response 1:', JSON.stringify(result1));

  // 6. Wait for worker processing
  const waitMs = 5000;
  console.log(`Waiting ${waitMs / 1000}s for BullMQ worker to fetch & save commit...`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  // 7. Verify the commit was saved to DB
  let dbCommit = await prisma.commit.findUnique({
    where: {
      repository_sha: {
        repository,
        sha,
      },
    },
  });

  if (dbCommit) {
    console.log('✅ Success: Commit was successfully saved in database.');
    console.log('Saved Message:', dbCommit.message);
    console.log('Filtered Diff Text (First 200 chars):\n', dbCommit.diffText?.substring(0, 200));
  } else {
    console.error('❌ Failure: Commit was not found in the database.');
    process.exit(1);
  }

  // 8. Send duplicate webhook request to verify DB-level idempotency
  console.log('\nSending duplicate push event webhook request to test idempotency...');
  const res2 = await fetch(`${SERVER_URL}/webhook/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-github-event': 'push',
      'x-hub-signature-256': signature,
    },
    body: bodyString,
  });

  if (!res2.ok) {
    console.error(`Webhook endpoint failed with status ${res2.status}:`, await res2.text());
    process.exit(1);
  }

  const result2 = await res2.json() as any;
  console.log('Webhook Response 2:', JSON.stringify(result2));

  console.log(`Waiting ${waitMs / 1000}s for BullMQ worker to process duplicate...`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  // 9. Assert no duplicate entries exist in DB
  const commitsCount = await prisma.commit.count({
    where: {
      repository,
      sha,
    },
  });

  console.log(`Commits found in database matching SHA: ${commitsCount}`);
  if (commitsCount === 1) {
    console.log('✅ Success: Idempotency verified. Exactly 1 commit record exists in the DB.');
  } else {
    console.error(`❌ Failure: Found ${commitsCount} commit records in DB. Duplicate inserted!`);
    process.exit(1);
  }

  console.log('\n=== All Webhook & Idempotency Pipeline Tests Passed ===');
  await prisma.$disconnect();
}

runTest();
