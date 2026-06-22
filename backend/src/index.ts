import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieSession from 'cookie-session';
import { PrismaClient } from '@prisma/client';
import { commitQueue } from './queues/commitQueue';
import { startCommitWorker } from './workers/commitWorker';
import { verifyGitHubWebhook, AuthenticatedRequest } from './middleware/verifyWebhook';
import { initCronJobs } from './config/cron';
import { generateDailySummary } from './services/summaryService';
import { requireAuth, AuthRequest } from './middleware/auth';
import { encrypt } from './utils/crypto';

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

// Session Cookie Management (signed, httpOnly, secure-ready)
app.use(
  cookieSession({
    name: 'devlog-session',
    keys: [process.env.SESSION_SECRET || 'devlog_session_secret_temp'],
    maxAge: 24 * 60 * 60 * 1000 * 30, // 30 days
    secure: false, // In production behind HTTPS, set to true
    httpOnly: true,
    sameSite: 'lax',
  })
);

// CORS Lock to configured Frontend Origin with Credentials support
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5170',
    credentials: true,
  })
);

// Health endpoint - checks PostgreSQL and Redis connectivity
app.get('/health', async (req, res) => {
  try {
    // 1. Check PostgreSQL connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';

    // 2. Check Redis connection
    const redisClient = await commitQueue.client;
    const redisPing = await (redisClient as any).ping();
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

// ==========================================
// GitHub OAuth 2.0 Flow Endpoints
// ==========================================

// 1. GET /api/auth/github - Redirect to GitHub Authorize portal
app.get('/api/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    console.error('[OAuth] GITHUB_CLIENT_ID is not configured in .env.');
    res.status(500).json({ error: 'OAuth client configuration error' });
    return;
  }
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user,repo`;
  res.redirect(githubAuthUrl);
});

// 2. GET /api/auth/github/callback - Exchange code, fetch profile, upsert user
app.get('/api/auth/github/callback', async (req: any, res) => {
  const { code } = req.query;

  if (!code) {
    res.status(400).send('Authentication code is missing from GitHub redirect');
    return;
  }

  try {
    // Exchange auth code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to exchange oauth code: ${tokenResponse.statusText}`);
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Access token not returned from GitHub OAuth gateway.');
    }

    // Retrieve user profile information
    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Devlog-App',
      },
    });

    if (!profileResponse.ok) {
      throw new Error(`Failed to fetch user profile: ${profileResponse.statusText}`);
    }

    const githubUser = (await profileResponse.json()) as any;
    const githubId = String(githubUser.id);
    const username = githubUser.login;
    const avatarUrl = githubUser.avatar_url || null;
    let email = githubUser.email || null;

    // Fetch primary email if not public in profile
    if (!email) {
      try {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Devlog-App',
          },
        });
        if (emailsResponse.ok) {
          const emails = (await emailsResponse.json()) as any[];
          const primaryObj = emails.find((e: any) => e.primary);
          if (primaryObj) {
            email = primaryObj.email;
          }
        }
      } catch (err: any) {
        console.warn('[OAuth] Failed to retrieve emails:', err.message);
      }
    }

    // Encrypt token before DB insertion
    const encryptedToken = encrypt(accessToken);

    // Upsert User profile
    const user = await prisma.user.upsert({
      where: { githubId },
      update: {
        username,
        email,
        avatarUrl,
        accessToken: encryptedToken,
      },
      create: {
        githubId,
        username,
        email,
        avatarUrl,
        accessToken: encryptedToken,
        timezone: 'Asia/Kolkata', // Default timezone configuration
      },
    });

    // Establish cookie session
    req.session.userId = user.id;
    console.log(`[OAuth] Successfully authenticated user: ${username} (DB ID: ${user.id})`);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5170';
    res.redirect(frontendUrl);
  } catch (error: any) {
    console.error('[OAuth Callback] Error processing request:', error.message);
    res.status(500).send(`GitHub OAuth Callback Error: ${error.message}`);
  }
});

// 3. GET /api/auth/me - Retrieve current session state
app.get('/api/auth/me', requireAuth as express.RequestHandler, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized session' });
    return;
  }

  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl,
      timezone: req.user.timezone,
    },
  });
});

// 4. POST /api/auth/logout - Sign out session
app.post('/api/auth/logout', (req: any, res) => {
  req.session = null;
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// Secured REST API Routes
// ==========================================

// 1. GET /api/entries - Get list of daily summaries scoped to the session user
app.get('/api/entries', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const entries = await prisma.entry.findMany({
      where: { userId: req.user!.id },
      orderBy: { date: 'desc' },
    });

    res.status(200).json({ success: true, entries });
  } catch (error: any) {
    console.error('[API] Failed to fetch entries:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /api/entries/:id - Get single daily summary
app.get('/api/entries/:id', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const entry = await prisma.entry.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
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
app.patch('/api/entries/:id', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content, status } = req.body;

    const entry = await prisma.entry.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
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

// 4. GET /api/commits - Get commits sorted by date scoped to session user
app.get('/api/commits', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const commits = await prisma.commit.findMany({
      where: { userId: req.user!.id },
      orderBy: { commitDate: 'desc' },
    });

    res.status(200).json({ success: true, commits });
  } catch (error: any) {
    console.error('[API] Failed to fetch commits:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. POST /api/entries/trigger-summary - Manually trigger daily summary generation
app.post('/api/entries/trigger-summary', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const { date } = req.body;
    const targetUserId = req.user!.id;
    const userProfile = req.user!;

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
app.delete('/api/entries/:id', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const entry = await prisma.entry.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!entry) {
      res.status(404).json({ success: false, error: 'Entry not found' });
      return;
    }

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

