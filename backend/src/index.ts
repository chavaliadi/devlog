import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { commitQueue } from './queues/commitQueue';
import { startCommitWorker } from './workers/commitWorker';
import { verifyGitHubWebhook, AuthenticatedRequest } from './middleware/verifyWebhook';
import { initCronJobs } from './config/cron';
import { generateDailySummary } from './services/summaryService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Capture raw body buffer for signature verification
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(cors());

// Health endpoint - checks PostgreSQL and Redis connectivity
app.get('/health', async (req, res) => {
  try {
    // 1. Check PostgreSQL connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';

    // 2. Check Redis connection
    const redisClient = await commitQueue.client;
    const redisPing = await redisClient.ping();
    const redisStatus = redisPing === 'PONG' ? 'connected' : 'error';

    if (redisStatus !== 'connected') {
      res.status(500).json({
        status: 'unhealthy',
        database: dbStatus,
        redis: redisStatus,
      });
      return;
    }

    res.status(200).json({
      status: 'healthy',
      database: dbStatus,
      redis: redisStatus,
    });
  } catch (error: any) {
    console.error('[Health] Health check failed:', error.message);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Test endpoint to enqueue a mock job manually
app.get('/test-queue', async (req, res) => {
  try {
    const jobData = {
      test: true,
      timestamp: new Date().toISOString(),
      payload: 'This is a test job payload to verify Redis + BullMQ connection',
    };

    const job = await commitQueue.add('test-job', jobData);

    res.status(200).json({
      success: true,
      message: 'Test job successfully enqueued.',
      jobId: job.id,
    });
  } catch (error: any) {
    console.error('[Queue-Test] Failed to enqueue job:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GitHub Webhook receiver endpoint
app.post(
  '/webhook/github',
  verifyGitHubWebhook as express.RequestHandler,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const eventType = req.headers['x-github-event'] as string;
      console.log(`[Webhook] Received GitHub event: ${eventType}`);

      if (eventType === 'push') {
        const payload = req.body;
        const commits = payload.commits || [];
        const repository = payload.repository?.full_name;
        const pusher = payload.pusher?.name;
        const ref = payload.ref;

        const enqueuedJobIds: string[] = [];

        for (const commit of commits) {
          const job = await commitQueue.add(
            'github-commit',
            {
              repository,
              commit,
              pusher,
              ref,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 1000,
              },
            }
          );
          if (job.id) {
            enqueuedJobIds.push(job.id);
          }
        }

        console.log(`[Webhook] Enqueued ${enqueuedJobIds.length} commit jobs for push event on ${repository}.`);
        res.status(200).json({
          status: 'accepted',
          message: `${enqueuedJobIds.length} commit jobs enqueued`,
          jobIds: enqueuedJobIds,
        });
        return;
      }

      // Ignore other events for now, but return 200
      res.status(200).json({
        status: 'ignored',
        message: `Event type '${eventType}' is not handled, ignored.`,
      });
    } catch (error: any) {
      console.error('[Webhook] Error handling webhook:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Helper to get default user for single-user endpoints
const getDefaultUser = async () => {
  const defaultUsername = process.env.DEFAULT_DEVELOPER_USERNAME || 'chavaliadi';
  let user = await prisma.user.findFirst({
    where: { username: defaultUsername },
  });
  if (!user) {
    user = await prisma.user.findFirst();
  }
  return user;
};

// 1. GET /api/entries - Get list of daily summaries
app.get('/api/entries', async (req, res) => {
  try {
    const user = await getDefaultUser();
    if (!user) {
      res.status(404).json({ success: false, error: 'No user profiles found in database.' });
      return;
    }

    const entries = await prisma.entry.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
    });

    res.status(200).json({ success: true, entries });
  } catch (error: any) {
    console.error('[API] Failed to fetch entries:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /api/entries/:id - Get single daily summary
app.get('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await prisma.entry.findUnique({
      where: { id },
    });

    if (!entry) {
      res.status(404).json({ success: false, error: 'Entry not found' });
      return;
    }

    res.status(200).json({ success: true, entry });
  } catch (error: any) {
    console.error('[API] Failed to fetch entry:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. PATCH /api/entries/:id - Edit summary content or publish status
app.patch('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, status } = req.body;

    const entry = await prisma.entry.findUnique({
      where: { id },
    });

    if (!entry) {
      res.status(404).json({ success: false, error: 'Entry not found' });
      return;
    }

    const updatedEntry = await prisma.entry.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, entry: updatedEntry });
  } catch (error: any) {
    console.error('[API] Failed to update entry:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. GET /api/commits - Get commits sorted by date
app.get('/api/commits', async (req, res) => {
  try {
    const user = await getDefaultUser();
    if (!user) {
      res.status(404).json({ success: false, error: 'No user profiles found in database.' });
      return;
    }

    const commits = await prisma.commit.findMany({
      where: { userId: user.id },
      orderBy: { commitDate: 'desc' },
    });

    res.status(200).json({ success: true, commits });
  } catch (error: any) {
    console.error('[API] Failed to fetch commits:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. POST /api/entries/trigger-summary - Manually trigger daily summary generation
app.post('/api/entries/trigger-summary', async (req, res) => {
  try {
    const { userId, date } = req.body;

    let targetUserId = userId;
    if (!targetUserId) {
      const user = await getDefaultUser();
      if (!user) {
        res.status(404).json({ success: false, error: 'No user profiles found in database.' });
        return;
      }
      targetUserId = user.id;
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!userProfile) {
      res.status(404).json({ success: false, error: `User with ID '${targetUserId}' not found.` });
      return;
    }

    let targetDateStr = date;
    if (!targetDateStr) {
      const timezone = userProfile.timezone || 'Asia/Kolkata';
      const userDateStr = new Date().toLocaleDateString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const [m, d, y] = userDateStr.split('/');
      targetDateStr = `${y}-${m}-${d}`;
    }

    console.log(`[API] Manual summary generation requested for user '${userProfile.username}' on date '${targetDateStr}'`);
    const result = await generateDailySummary(targetUserId, targetDateStr);

    if (!result.success) {
      res.status(400).json({
        success: false,
        reason: result.reason,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Summary successfully generated.',
      entryId: result.entryId,
      entry: result.entry,
    });
  } catch (error: any) {
    console.error('[API] Manual summary trigger failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. DELETE /api/entries/:id - Delete daily summary
app.delete('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.entry.delete({
      where: { id },
    });
    res.status(200).json({ success: true, message: 'Entry successfully deleted.' });
  } catch (error: any) {
    console.error('[API] Failed to delete entry:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server, initialize prisma connection, and start BullMQ worker
const startServer = async () => {
  try {
    // Test DB connection before starting server
    console.log('[Server] Connecting to database...');
    await prisma.$connect();
    console.log('[Server] Database connected successfully.');

    // Start worker
    startCommitWorker();
 
    // Start hourly timezone cron job checking
    initCronJobs();
 
    app.listen(PORT, () => {
      console.log(`[Server] DevLog Backend is running on http://localhost:${PORT}`);
    });
  } catch (error: any) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
};

startServer();
