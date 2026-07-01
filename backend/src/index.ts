import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieSession from 'cookie-session';
import { PrismaClient } from '@prisma/client';
import { commitQueue } from './queues/commitQueue';
import { startCommitWorker } from './workers/commitWorker';
import { verifyGitHubWebhook, AuthenticatedRequest } from './middleware/verifyWebhook';
import { initCronJobs, lastCronRun } from './config/cron';
import { generateDailySummary } from './services/summaryService';
import { requireAuth, AuthRequest } from './middleware/auth';
import { encrypt, decrypt } from './utils/crypto';
import { fetchCommitDiff } from './services/githubService';
import { summarizeCommit, generateResumeBullets } from './services/aiService';

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
        const repository = payload.repository?.full_name;

        if (!repository) {
          res.status(400).json({ error: 'Missing repository field' });
          return;
        }

        // Check if this repository is tracked by any user in Devlog
        const trackedRepo = await prisma.repository.findFirst({
          where: {
            fullName: repository,
            isTracked: true,
          },
        });

        if (!trackedRepo) {
          console.log(`[Webhook] Repository '${repository}' is not tracked by any user in Devlog. Skipping commit ingestion.`);
          res.status(200).json({
            status: 'ignored',
            message: `Repository '${repository}' is not actively tracked in Devlog.`,
          });
          return;
        }

        const commits = payload.commits || [];
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
      const errorMsg = tokenData.error_description || tokenData.error || JSON.stringify(tokenData);
      throw new Error(`Access token not returned from GitHub OAuth gateway. Reason: ${errorMsg}`);
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

    // Look up user by githubId or username to handle seed data transitions safely
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { githubId },
          { username }
        ]
      }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId, // Update placeholder/mock ID if it was seeded
          username,
          email,
          avatarUrl,
          accessToken: encryptedToken,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          githubId,
          username,
          email,
          avatarUrl,
          accessToken: encryptedToken,
          timezone: 'Asia/Kolkata', // Default timezone configuration
        },
      });
    }

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

// Helper to convert date to local string in a timezone (YYYY-MM-DD)
const formatDateInTimezone = (date: Date, timezone: string): string => {
  try {
    const formatted = date.toLocaleDateString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [m, d, y] = formatted.split('/');
    return `${y}-${m}-${d}`;
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
};

// 5. GET /api/public/entries/:username - Fetch recruiter guest portfolio profile & statistics
app.get('/api/public/entries/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      res.status(404).json({ success: false, error: `User '${username}' not found.` });
      return;
    }

    // 1. Fetch entries (Published only)
    const entries = await prisma.entry.findMany({
      where: {
        userId: user.id,
        status: 'published',
      },
      orderBy: { date: 'desc' },
    });

    // 2. Fetch all commits to compile stats
    const commits = await prisma.commit.findMany({
      where: { userId: user.id },
      select: { commitDate: true },
      orderBy: { commitDate: 'desc' },
    });

    const totalCommits = commits.length;

    // 3. Group commits by repo to select top 3 active repositories
    const repoGroups = await prisma.commit.groupBy({
      by: ['repository'],
      where: { userId: user.id },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const totalRepositories = repoGroups.length;
    const topRepositories = repoGroups.slice(0, 3).map((rg) => rg.repository);

    // 4. Calculate Active Days & Streak
    const timezone = user.timezone || 'Asia/Kolkata';
    const localDates = Array.from(
      new Set(commits.map((c) => formatDateInTimezone(c.commitDate, timezone)))
    ).sort((a, b) => b.localeCompare(a));

    const activeDays = localDates.length;

    let currentStreak = 0;
    if (localDates.length > 0) {
      const todayStr = formatDateInTimezone(new Date(), timezone);
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateInTimezone(yesterday, timezone);

      const latestLocal = localDates[0];
      const hasCommitToday = latestLocal === todayStr;
      const hasCommitYesterday = latestLocal === yesterdayStr;

      if (hasCommitToday || hasCommitYesterday) {
        currentStreak = 1;
        let prevDate = new Date(latestLocal + 'T00:00:00Z');

        for (let i = 1; i < localDates.length; i++) {
          const currentDate = new Date(localDates[i] + 'T00:00:00Z');
          const diffTime = Math.abs(prevDate.getTime() - currentDate.getTime());
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            currentStreak++;
            prevDate = currentDate;
          } else {
            break;
          }
        }
      }
    }

    // 5. Fetch and clean latest 5 commits for Recent Activity feed
    const recentCommits = await prisma.commit.findMany({
      where: { userId: user.id },
      orderBy: { commitDate: 'desc' },
      take: 5,
    });

    const recentActivity = recentCommits.map((commit) => {
      let message = commit.message.trim();
      if (message.length > 0) {
        message = message.charAt(0).toUpperCase() + message.slice(1);
      }
      if (message.length > 100) {
        message = message.substring(0, 97) + '...';
      }
      return {
        sha: commit.sha.substring(0, 8),
        repository: commit.repository,
        message,
        date: commit.commitDate.toISOString(),
      };
    });

    // 6. Return structured unauthenticated payload (completely excluding private email and token details)
    res.status(200).json({
      success: true,
      profile: {
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
      stats: {
        totalCommits,
        totalRepositories,
        topRepositories,
        activeDays,
        currentStreak,
      },
      recentActivity,
      entries,
    });
  } catch (error: any) {
    console.error('[API] Public portfolio fetch failed:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// Secured REST API Routes
// ==========================================

// Repository Management Routes
app.get('/api/repos', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const repos = await prisma.repository.findMany({
      where: { userId: req.user!.id },
      orderBy: { fullName: 'asc' },
    });
    res.status(200).json({ success: true, repositories: repos });
  } catch (error: any) {
    console.error('[API] Failed to fetch repositories:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/repos/sync-all', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!user.accessToken || user.accessToken === 'placeholder_access_token') {
      res.status(400).json({ success: false, error: 'GitHub account not connected or missing token.' });
      return;
    }

    const token = decrypt(user.accessToken);
    let page = 1;
    let allRepos: any[] = [];

    while (true) {
      const url = `https://api.github.com/user/repos?sort=updated&per_page=100&page=${page}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Devlog-App',
          'Accept': 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub repos API returned status ${response.status}`);
      }

      const repos = (await response.json()) as any[];
      if (!Array.isArray(repos) || repos.length === 0) {
        break;
      }

      allRepos.push(...repos);
      if (repos.length < 100) {
        break;
      }
      page++;
    }

    // Save/update repos in DB
    const syncedRepos = [];
    for (const repo of allRepos) {
      const dbRepo = await prisma.repository.upsert({
        where: {
          userId_fullName: {
            userId: user.id,
            fullName: repo.full_name,
          },
        },
        update: {
          language: repo.language || null,
          stars: repo.stargazers_count || 0,
        },
        create: {
          userId: user.id,
          fullName: repo.full_name,
          isTracked: false,
          language: repo.language || null,
          stars: repo.stargazers_count || 0,
        },
      });
      syncedRepos.push(dbRepo);
    }

    res.status(200).json({
      success: true,
      message: `Successfully synchronized ${syncedRepos.length} repositories from GitHub.`,
      count: syncedRepos.length,
      repositories: syncedRepos,
    });
  } catch (error: any) {
    console.error('[API] Failed to sync repositories:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/repos/:id/toggle', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const repo = await prisma.repository.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!repo) {
      res.status(404).json({ success: false, error: 'Repository not found' });
      return;
    }

    const updated = await prisma.repository.update({
      where: { id },
      data: {
        isTracked: !repo.isTracked,
      },
    });

    res.status(200).json({ success: true, repository: updated });
  } catch (error: any) {
    console.error('[API] Failed to toggle repository:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// System Health Dashboard API Route (authenticated for privacy of queue logs)
app.get('/api/health', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    // 1. Database Connection check & latency
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // 2. Redis Connection check & latency
    const redisStart = Date.now();
    const redisClient = await commitQueue.client;
    const redisPing = await (redisClient as any).ping();
    const redisLatency = Date.now() - redisStart;
    const redisStatus = redisPing === 'PONG' ? 'connected' : 'unreachable';

    // 3. BullMQ queue introspection
    const counts = await commitQueue.getJobCounts('waiting', 'active', 'completed', 'failed');

    // 4. Ingestion workers status (Active checks)
    const activeWorkers = await commitQueue.getWorkers();

    res.status(200).json({
      success: true,
      status: 'healthy',
      database: {
        status: 'connected',
        latencyMs: dbLatency,
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatency,
      },
      queue: {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        totalWorkers: activeWorkers.length,
      },
      cron: {
        timezone: 'Asia/Kolkata', // default timezone
        lastCheckAt: lastCronRun ? lastCronRun.toISOString() : null,
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API Health] Health diagnostic failed:', error.message);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

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

// 4b. POST /api/commits/sync - Fetch recent repos and commits from GitHub and ingest them
app.post('/api/commits/sync', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!user.accessToken || user.accessToken === 'placeholder_access_token') {
      res.status(400).json({ success: false, error: 'GitHub account not connected or missing token.' });
      return;
    }

    const token = decrypt(user.accessToken);

    // Fetch user's tracked repositories from the database
    const trackedRepos = await prisma.repository.findMany({
      where: {
        userId: user.id,
        isTracked: true,
      },
    });

    if (trackedRepos.length === 0) {
      res.status(200).json({
        success: true,
        message: 'Sync skipped. No repositories are actively tracked. Please toggle tracked repositories in settings.',
        count: 0,
      });
      return;
    }

    let syncedCommitsCount = 0;
    
    // Process repos sequentially to avoid rate limiting or slamming the DB
    for (const repo of trackedRepos) {
      const repoFullName = repo.fullName; // owner/repo
      const [repoOwner, repoName] = repoFullName.split('/');

      // Fetch recent commits for this user from this repo (up to 5 commits per repo)
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/commits?author=${user.username}&per_page=5`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Devlog-App',
            'Accept': 'application/vnd.github+json',
          },
        }
      );

      if (!commitsResponse.ok) {
        console.warn(`[API Sync] Failed to fetch commits for ${repoFullName}:`, commitsResponse.statusText);
        continue;
      }

      const githubCommits = (await commitsResponse.json()) as any[];
      if (!Array.isArray(githubCommits)) continue;

      for (const commitObj of githubCommits) {
        const sha = commitObj.sha;

        // Check if commit already exists in database
        const existing = await prisma.commit.findUnique({
          where: {
            repository_sha: {
              repository: repoFullName,
              sha,
            },
          },
        });

        if (existing) {
          continue; // Already ingested
        }

        try {
          // Fetch detailed commit diff using our helper service
          const details = await fetchCommitDiff(repoOwner, repoName, sha, token);

          // Generate commit-level AI summary (WHY, not just WHAT)
          let aiSummary: string | null = null;
          try {
            if (details.diffText && details.diffText !== 'No file changes found in this commit.' && !details.diffText.includes('All files in this commit were ignored')) {
              aiSummary = await summarizeCommit(details.message, details.diffText);
            }
          } catch (aiErr: any) {
            console.warn(`[API Sync] Failed to generate AI summary for commit ${sha}:`, aiErr.message);
          }

          // Save commit to database
          await prisma.commit.create({
            data: {
              userId: user.id,
              sha,
              repository: repoFullName,
              message: details.message,
              diffText: details.diffText,
              aiSummary: aiSummary,
              commitDate: details.commitDate,
            },
          });
          syncedCommitsCount++;
        } catch (err: any) {
          console.error(`[API Sync] Failed to ingest commit ${sha}:`, err.message);
        }
      }

      // Update last sync time for this repository
      await prisma.repository.update({
        where: { id: repo.id },
        data: { lastSyncAt: new Date() },
      });
    }

    res.status(200).json({
      success: true,
      message: `Sync completed. Ingested ${syncedCommitsCount} new commits.`,
      count: syncedCommitsCount,
    });
  } catch (error: any) {
    console.error('[API Sync] Commit sync failed:', error.message);
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

// 7. POST /api/entries/:id/resume-bullets - Generate resume bullet points from entry content
app.post('/api/entries/:id/resume-bullets', requireAuth as express.RequestHandler, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const entry = await prisma.entry.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!entry) {
      res.status(404).json({ success: false, error: 'Daily log entry not found' });
      return;
    }

    if (!entry.content) {
      res.status(400).json({ success: false, error: 'Entry content is empty' });
      return;
    }

    const bullets = await generateResumeBullets(entry.content);

    res.status(200).json({
      success: true,
      bullets,
    });
  } catch (error: any) {
    console.error('[API] Resume bullet generation failed:', error.message);
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

