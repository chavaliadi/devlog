import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { redisConnectionConfig } from '../config/redis';
import { fetchCommitDiff } from '../services/githubService';

const prisma = new PrismaClient();

interface WebhookCommit {
  id: string; // SHA
  message: string;
  timestamp: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
}

interface WebhookJobData {
  repository: string; // owner/repo
  commits: WebhookCommit[];
  pusher: string;
  ref: string;
}

export const startCommitWorker = () => {
  const worker = new Worker(
    'commit-queue',
    async (job: Job<WebhookJobData>) => {
      console.log(`[Worker] Starting job ${job.id} of type ${job.name}...`);
      const { repository, commits, pusher } = job.data;

      if (!repository || !commits || commits.length === 0) {
        console.warn(`[Worker] Job ${job.id} contains insufficient data. Skipping.`);
        return { success: false, reason: 'Insufficient data' };
      }

      // 1. Parse repository owner and name
      const parts = repository.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid repository format: ${repository}`);
      }
      const [owner, repoName] = parts;

      // 2. Identify the target User in our database
      // Check repository owner or pusher name
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: owner },
            { username: pusher },
          ],
        },
      });

      if (!user) {
        console.warn(
          `[Worker] No matching user found for owner '${owner}' or pusher '${pusher}'. Falling back to default user.`
        );
        // Fallback to first available user or seeded user 'chavaliadi'
        user = await prisma.user.findFirst({
          where: { username: 'chavaliadi' },
        });

        if (!user) {
          throw new Error('Database contains no users to associate with incoming commits.');
        }
      }

      console.log(`[Worker] Processing commits for user: ${user.username} (ID: ${user.id})`);

      // Determine the GitHub token to use (prefer OAuth token, fallback to PAT)
      const userToken = user.accessToken && user.accessToken !== 'placeholder_access_token'
        ? user.accessToken
        : undefined;

      let processedCount = 0;
      let skippedCount = 0;

      // 3. Process commits sequentially
      for (const commit of commits) {
        const sha = commit.id;
        console.log(`[Worker] Processing commit SHA: ${sha}`);

        // 3.1 Idempotency Check: check if commit already exists
        const existingCommit = await prisma.commit.findUnique({
          where: { sha },
        });

        if (existingCommit) {
          console.log(`[Worker] Commit ${sha} already processed (found in DB). Skipping.`);
          skippedCount++;
          continue;
        }

        try {
          // 3.2 Fetch diff details from GitHub API
          const fetchedDetails = await fetchCommitDiff(owner, repoName, sha, userToken);

          // 3.3 Persist commit to PostgreSQL
          await prisma.commit.create({
            data: {
              userId: user.id,
              sha: sha,
              repository: repository,
              message: fetchedDetails.message,
              diffText: fetchedDetails.diffText,
              commitDate: fetchedDetails.commitDate,
            },
          });

          console.log(`[Worker] Successfully saved commit ${sha} to database.`);
          processedCount++;
        } catch (error: any) {
          console.error(`[Worker] Error processing commit ${sha}:`, error.message);
          // Re-throw if it's a transient connection/rate limit error to allow BullMQ to retry the job
          if (error.message.includes('403') || error.message.includes('rate limit') || error.message.includes('fetch failed')) {
            throw error;
          }
          // For other errors, skip and log to avoid poison pill blocking the queue
          skippedCount++;
        }
      }

      console.log(
        `[Worker] Job ${job.id} completed. Processed: ${processedCount}, Skipped/Duplicates: ${skippedCount}`
      );

      return {
        success: true,
        processedCount,
        skippedCount,
      };
    },
    {
      connection: redisConnectionConfig,
    }
  );

  worker.on('active', (job) => {
    console.log(`[Worker] Job ${job.id} is now active.`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed successfully. Result:`, result);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
  });

  console.log('[Worker] BullMQ commit-processing worker initialized and listening...');
  return worker;
};
