export interface MockCommit {
  sha: string;
  repository: string;
  message: string;
  diffText: string;
  commitDate: Date;
}

export const getMockCommits = (): MockCommit[] => {
  // Let's create commits spread over the last two weeks
  const today = new Date();
  
  const daysAgo = (num: number): Date => {
    const d = new Date(today);
    d.setDate(today.getDate() - num);
    return d;
  };

  return [
    // ----------------------------------------------------
    // Project 1: microservice-auth (Security & Web API)
    // ----------------------------------------------------
    {
      sha: 'a71b2d3c4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t',
      repository: 'chavaliadi/microservice-auth',
      message: 'feat(auth): initial Express API gateway and OAuth 2.0 config',
      commitDate: daysAgo(14), // 14 days ago
      diffText: `File: package.json (modified)
@@ -10,4 +10,8 @@
   "dependencies": {
     "express": "^4.19.2",
+    "dotenv": "^16.4.5",
+    "jsonwebtoken": "^9.0.2",
+    "cors": "^2.8.5"
   }

File: src/index.ts (new)
@@ -0,0 +1,24 @@
+import express from 'express';
+import dotenv from 'dotenv';
+dotenv.config();
+
+const app = express();
+app.use(express.json());
+
+app.get('/api/auth/callback', (req, res) => {
+  const { code } = req.query;
+  res.json({ success: true, code });
+});
+
+app.listen(3000, () => console.log('Auth Gateway listening on port 3000'));
+`
    },
    {
      sha: 'b82c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
      repository: 'chavaliadi/microservice-auth',
      message: 'feat(crypto): implement AES-256-GCM token encryption helpers for credential storage',
      commitDate: daysAgo(12),
      diffText: `File: src/utils/encryption.ts (new)
@@ -0,0 +1,35 @@
+import crypto from 'crypto';
+
+const ALGORITHM = 'aes-256-gcm';
+const IV_LENGTH = 12;
+
+export function encrypt(text: string, key: string): string {
+  const iv = crypto.randomBytes(IV_LENGTH);
+  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
+  let encrypted = cipher.update(text, 'utf8', 'hex');
+  encrypted += cipher.final('hex');
+  const authTag = cipher.getAuthTag().toString('hex');
+  return \`\${iv.toString('hex')}:\${encrypted}:\${authTag}\`;
+}
+
+export function decrypt(encryptedText: string, key: string): string {
+  const [ivHex, encrypted, authTagHex] = encryptedText.split(':');
+  const iv = Buffer.from(ivHex, 'hex');
+  const authTag = Buffer.from(authTagHex, 'hex');
+  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
+  decipher.setAuthTag(authTag);
+  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
+  decrypted += decipher.final('utf8');
+  return decrypted;
+}
+`
    },
    {
      sha: 'c93d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1',
      repository: 'chavaliadi/microservice-auth',
      message: 'feat(middleware): add JWT verification and Redis-backed blacklisting for token revocation',
      commitDate: daysAgo(11),
      diffText: `File: src/middleware/jwtAuth.ts (new)
@@ -0,0 +1,28 @@
+import { Request, Response, NextFunction } from 'express';
+import jwt from 'jsonwebtoken';
+import Redis from 'ioredis';
+
+const redis = new Redis();
+
+export async function verifyToken(req: any, res: Response, next: NextFunction) {
+  const token = req.headers.authorization?.split(' ')[1];
+  if (!token) return res.status(401).json({ error: 'Token missing' });
+
+  // Check redis blacklist
+  const isBlacklisted = await redis.get(\`blacklist:\${token}\`);
+  if (isBlacklisted) return res.status(401).json({ error: 'Token revoked' });
+
+  try {
+    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
+    req.user = decoded;
+    next();
+  } catch (err) {
+    res.status(401).json({ error: 'Invalid token' });
+  }
+}
+`
    },
    {
      sha: 'd04e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2',
      repository: 'chavaliadi/microservice-auth',
      message: 'security(webhooks): add timing-safe HMAC signature verification for API callbacks',
      commitDate: daysAgo(10),
      diffText: `File: src/middleware/verifyWebhook.ts (new)
@@ -0,0 +1,22 @@
+import crypto from 'crypto';
+import { Request, Response, NextFunction } from 'express';
+
+export function verifyHmacSignature(req: any, res: Response, next: NextFunction) {
+  const signature = req.headers['x-hub-signature-256'] as string;
+  if (!signature) return res.status(401).json({ error: 'Signature missing' });
+
+  const secret = process.env.WEBHOOK_SECRET!;
+  const hmac = crypto.createHmac('sha256', secret);
+  const calculatedSignature = 'sha256=' + hmac.update(req.rawBody).digest('hex');
+
+  // Timing safe equal check to prevent side-channel timing attacks
+  const matches = crypto.timingSafeEqual(
+    Buffer.from(signature),
+    Buffer.from(calculatedSignature)
+  );
+
+  if (!matches) return res.status(403).json({ error: 'Signature mismatch' });
+  next();
+}
+`
    },

    // ----------------------------------------------------
    // Project 2: devlog (Systems Engineering & AI Integration)
    // ----------------------------------------------------
    {
      sha: 'e15f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3',
      repository: 'chavaliadi/devlog',
      message: 'feat(db): design database schema with user relations and commit idempotency constraints',
      commitDate: daysAgo(8),
      diffText: `File: prisma/schema.prisma (new)
@@ -0,0 +1,26 @@
+model User {
+  id           String   @id @default(uuid())
+  githubId     String   @unique
+  username     String   @unique
+  accessToken  String
+  timezone     String   @default("Asia/Kolkata")
+  commits      Commit[]
+  entries      Entry[]
+}
+
+model Commit {
+  id          String   @id @default(uuid())
+  userId      String
+  user        User     @relation(fields: [userId], references: [id])
+  sha         String
+  repository  String
+  message     String
+  diffText    String?
+  commitDate  DateTime
+
+  @@unique([repository, sha]) // Prevents duplicate ingestion (idempotency constraint)
+}
+`
    },
    {
      sha: 'f26g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4',
      repository: 'chavaliadi/devlog',
      message: 'feat(queue): integrate BullMQ and Redis for decoupling commit ingestion from HTTP thread',
      commitDate: daysAgo(6),
      diffText: `File: src/queues/commitQueue.ts (new)
@@ -0,0 +1,20 @@
+import { Queue } from 'bullmq';
+import IORedis from 'ioredis';
+
+const redisConnection = new IORedis({
+  host: process.env.REDIS_HOST || 'localhost',
+  port: Number(process.env.REDIS_PORT) || 6379,
+});
+
+export const commitQueue = new Queue('commit-ingestion', {
+  connection: redisConnection,
+  defaultJobOptions: {
+    attempts: 3,
+    backoff: {
+      type: 'exponential',
+      delay: 2000,
+    },
+  },
+});
+`
    },
    {
      sha: 'g37h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5',
      repository: 'chavaliadi/devlog',
      message: 'feat(worker): build background commit queue worker with remote GitHub diff scraping',
      commitDate: daysAgo(5),
      diffText: `File: src/workers/commitWorker.ts (new)
@@ -0,0 +1,28 @@
+import { Worker } from 'bullmq';
+import { PrismaClient } from '@prisma/client';
+
+const prisma = new PrismaClient();
+
+export const commitWorker = new Worker('commit-ingestion', async (job) => {
+  const { userId, sha, repository, message, commitDate } = job.data;
+  console.log(\`[Worker] Fetching commit diff details for \${repository} SHA \${sha}\`);
+
+  // Mock GitHub Diff fetching
+  const diffText = \`File: src/app.ts (modified)
+@@ -5,3 +5,8 @@
+  const data = fetchFromDatabase();
++ // Fix response caching for public portfolio latency optimization
++ const cached = cache.get(data);
++ if (cached) return cached;
+  \`;
+
+  await prisma.commit.create({
+    data: {
+      userId,
+      sha,
+      repository,
+      message,
+      diffText,
+      commitDate: new Date(commitDate),
+    },
+  });
+}, { connection: new IORedis() });
+`
    },
    {
      sha: 'h48i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
      repository: 'chavaliadi/devlog',
      message: 'feat(ai): integrate Groq Llama3 model compiler for daily commit rollup generation',
      commitDate: daysAgo(4),
      diffText: `File: src/services/aiService.ts (modified)
@@ -4,5 +4,18 @@
 export const generateSummary = async (prompt: string): Promise<string> => {
-  // old simple prompt
+  const apiKey = process.env.GROQ_API_KEY;
+  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
+    method: 'POST',
+    headers: {
+      'Authorization': \`Bearer \${apiKey}\`,
+      'Content-Type': 'application/json',
+    },
+    body: JSON.stringify({
+      model: 'llama-3.3-70b-versatile',
+      messages: [
+        { role: 'system', content: 'You are a Senior Technical Writer. Summarize the changes...' },
+        { role: 'user', content: prompt }
+      ]
+    })
+  });
+  return (await response.json()).choices[0].message.content;
 };
+`
    },
    {
      sha: 'i59j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7',
      repository: 'chavaliadi/devlog',
      message: 'feat(cron): add node-cron scheduling triggers for automated timezone-aware nightly summaries',
      commitDate: daysAgo(3),
      diffText: `File: src/services/cron.ts (new)
@@ -0,0 +1,21 @@
+import cron from 'node-cron';
+import { PrismaClient } from '@prisma/client';
+import { generateDailySummary } from './summaryService';
+
+const prisma = new PrismaClient();
+
+// Checks every hour to see if it is 11 PM (23:00) in each user's configured local timezone
+export function initCronJobs() {
+  cron.schedule('0 * * * *', async () => {
+    const users = await prisma.user.findMany();
+    for (const user of users) {
+      const localHour = new Date().toLocaleTimeString('en-US', {
+        timeZone: user.timezone,
+        hour: 'numeric',
+        hour12: false,
+      });
+      if (localHour === '23') {
+        await generateDailySummary(user.id, new Date().toISOString().split('T')[0]);
+      }
+    }
+  });
+}
+`
    },
    {
      sha: 'j60k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8',
      repository: 'chavaliadi/devlog',
      message: 'feat(portfolio): implement recruiter public-gateway API endpoint bypassing OAuth locks',
      commitDate: daysAgo(2),
      diffText: `File: src/index.ts (modified)
@@ -482,4 +482,15 @@
+
+// Public gateway route to bypass signed cookie authorization checks
+app.get('/api/public/entries/:username', async (req, res) => {
+  const { username } = req.params;
+  const user = await prisma.user.findUnique({
+    where: { username },
+    include: { entries: { where: { status: 'published' } } }
+  });
+  if (!user) return res.status(404).json({ error: 'User not found' });
+  res.json({ user, entries: user.entries });
+});
`
    },
    {
      sha: 'k71l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9',
      repository: 'chavaliadi/devlog',
      message: 'feat(search): add endpoint for LLM semantic search and repository theme intelligence',
      commitDate: daysAgo(1),
      diffText: `File: src/index.ts (new endpoint placeholder)
@@ -520,3 +520,12 @@
+// Get repository technical theme distribution and codebase statistics
+app.get('/api/repos/intelligence', requireAuth, async (req, res) => {
+  // Analytics generation logic
+});
+
+// Semantic search query route running context-weighted relevance matching
+app.get('/api/entries/search', requireAuth, async (req, res) => {
+  // Semantic LLM filter
+});
`
    },
    {
      sha: 'l82m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0',
      repository: 'chavaliadi/devlog',
      message: 'refactor(ux): optimize timeline load speed and style layout dashboard cards',
      commitDate: daysAgo(0), // Today
      diffText: `File: src/App.tsx (modified)
@@ -120,4 +120,9 @@
-  const [currentTab, setCurrentTab] = useState('dashboard');
+  const [currentTab, setCurrentTab] = useState('dashboard');
+  // Introduce timeline caching and state-driven animations
+  const [milestones, setMilestones] = useState([]);
+  const [techSummary, setTechSummary] = useState(null);
 `
    }
  ];
};
