import { Worker, Job } from 'bullmq';
import { PrismaClient, Prisma } from '@prisma/client';
import { redisConnectionConfig } from '../config/redis';
import { fetchCommitDiff } from '../services/githubService';
import { decrypt } from '../utils/crypto';
import { summarizeCommit } from '../services/aiService';

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
  commit: WebhookCommit;
  pusher: string;
  ref: string;
}

export const startCommitWorker = () => {
  const worker = new Worker(
    'commit-queue',
    async (job: Job<WebhookJobData>) => {
      console.log(`[Worker] Starting job ${job.id} of type ${job.name}...`);
      const { repository, commit, pusher } = job.data;

      if (!repository || !commit) {
        console.warn(`[Worker] Job ${job.id} contains insufficient data. Skipping.`);
        return { success: false, reason: 'Insufficient data' };
      }

      const sha = commit.id;
      console.log(`[Worker] Processing single commit: ${sha} in repo: ${repository}`);

      // 1. Parse repository owner and name
      const parts = repository.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid repository format: ${repository}`);
      }
      const [owner, repoName] = parts;

      // 2. Identify the target User in our database
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: owner },
            { username: pusher },
          ],
        },
      });

      if (!user) {
        const defaultUsername = process.env.DEFAULT_DEVELOPER_USERNAME || 'chavaliadi';
        console.warn(
          `[Worker] No matching user found for owner '${owner}' or pusher '${pusher}'. Falling back to default user '${defaultUsername}'.`
        );
        user = await prisma.user.findFirst({
          where: { username: defaultUsername },
        });

        if (!user) {
          console.warn(`[Worker] User '${defaultUsername}' not found. Falling back to the first user in the database.`);
          user = await prisma.user.findFirst();
        }

        if (!user) {
          throw new Error('Database contains no users to associate with incoming commits.');
        }
      }

      console.log(`[Worker] Associating commit with user: ${user.username} (ID: ${user.id})`);

      // Determine the GitHub token to use (prefer OAuth token, fallback to PAT)
      const userToken = user.accessToken && user.accessToken !== 'placeholder_access_token'
        ? decrypt(user.accessToken)
        : undefined;

      // 3. Fast check-before-insert (performance optimization)
      const existingCommit = await prisma.commit.findUnique({
        where: {
          repository_sha: {
            repository,
            sha,
          },
        },
      });

      if (existingCommit) {
        console.log(`[Worker] Commit ${sha} already processed (found in DB via lookup). Skipping.`);
        return { success: true, status: 'skipped', reason: 'duplicate' };
      }

      try {
        // 4. Fetch diff details from GitHub API
        const fetchedDetails = await fetchCommitDiff(owner, repoName, sha, userToken);

        // 4b. Generate commit-level AI summary (WHY, not just WHAT)
        let aiSummary: string | null = null;
        try {
          if (fetchedDetails.diffText && fetchedDetails.diffText !== 'No file changes found in this commit.' && !fetchedDetails.diffText.includes('All files in this commit were ignored')) {
            aiSummary = await summarizeCommit(fetchedDetails.message, fetchedDetails.diffText);
          }
        } catch (aiErr: any) {
          console.warn(`[Worker] Failed to generate AI summary for commit ${sha}:`, aiErr.message);
        }

        // 5. Persist commit to PostgreSQL
        await prisma.commit.create({
          data: {
            userId: user.id,
            sha: sha,
            repository: repository,
            message: fetchedDetails.message,
            diffText: fetchedDetails.diffText,
            aiSummary: aiSummary,
            commitDate: fetchedDetails.commitDate,
          },
        });

        console.log(`[Worker] Successfully saved commit ${sha} to database.`);
        return { success: true, status: 'processed', sha };
      } catch (error: any) {
        // 6. DB-level uniqueness constraint check (handling race condition)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          console.log(
            `[Worker] Unique constraint violation caught for ${repository} / ${sha} (P2002). Treating as idempotent success.`
          );
          return { success: true, status: 'skipped', reason: 'duplicate_race_condition' };
        }

        console.error(`[Worker] Error processing commit ${sha}:`, error.message);

        // Re-throw transient errors (rate limit, fetch failed) so BullMQ will retry
        if (
          error.message.includes('403') ||
          error.message.includes('rate limit') ||
          error.message.includes('fetch failed')
        ) {
          throw error;
        }

        // Return failure but don't retry non-transient issues (poison pills)
        return { success: false, error: error.message };
      }
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
