import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { commitQueue } from './queues/commitQueue';
import { startCommitWorker } from './workers/commitWorker';
import { verifyGitHubWebhook, AuthenticatedRequest } from './middleware/verifyWebhook';

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

// Start the server, initialize prisma connection, and start BullMQ worker
const startServer = async () => {
  try {
    // Test DB connection before starting server
    console.log('[Server] Connecting to database...');
    await prisma.$connect();
    console.log('[Server] Database connected successfully.');

    // Start worker
    startCommitWorker();

    app.listen(PORT, () => {
      console.log(`[Server] DevLog Backend is running on http://localhost:${PORT}`);
    });
  } catch (error: any) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
};

startServer();
