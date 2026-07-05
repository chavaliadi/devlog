import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

const SERVER_URL = 'http://localhost:5005';

async function runTest() {
  console.log('=== Starting Repo Intelligence & Semantic Search Local Test ===');

  // 1. Authenticate in Demo Mode
  console.log(`\n1. Authenticating via Demo login at ${SERVER_URL}/api/auth/demo...`);
  let sessionCookie = '';
  try {
    const loginRes = await fetch(`${SERVER_URL}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!loginRes.ok) {
      throw new Error(`Demo login failed with status ${loginRes.status}`);
    }
    const loginData = await loginRes.json() as any;
    console.log('Demo Login User details:', JSON.stringify(loginData.user));
    
    // Extract session cookies (both payload and signature)
    const rawCookies = loginRes.headers.get('set-cookie');
    if (rawCookies) {
      const cookieParts = rawCookies.split(',');
      const parsedCookies = cookieParts.map(c => c.split(';')[0].trim());
      sessionCookie = parsedCookies.join('; ');
      console.log('Successfully captured session cookies.');
    } else {
      throw new Error('No cookie returned from login endpoint.');
    }
  } catch (err: any) {
    console.error(`Error connecting to server: ${err.message}.\nPlease run the backend dev server ("npm run dev" in another terminal) before running this test.`);
    process.exit(1);
  }

  // 2. Sync mock commits
  console.log(`\n2. Triggering mock commit sync at ${SERVER_URL}/api/commits/sync...`);
  const syncRes = await fetch(`${SERVER_URL}/api/commits/sync`, {
    method: 'POST',
    headers: {
      'Cookie': sessionCookie,
      'Content-Type': 'application/json',
    },
  });
  if (!syncRes.ok) {
    console.error('Commit sync failed:', await syncRes.text());
    process.exit(1);
  }
  const syncData = await syncRes.json() as any;
  console.log('Sync result:', syncData.message);

  // 3. Fetch Repository Intelligence
  console.log(`\n3. Fetching Repository Intelligence stats...`);
  const intelRes = await fetch(`${SERVER_URL}/api/repos/intelligence`, {
    headers: { 'Cookie': sessionCookie },
  });
  if (!intelRes.ok) {
    console.error('Failed to fetch intelligence stats:', await intelRes.text());
    process.exit(1);
  }
  const intelData = await intelRes.json() as any;
  console.log('--- Technical Skills Breakdown ---');
  console.log(JSON.stringify(intelData.intelligence.skills, null, 2));
  console.log('\n--- Codebase Metrics ---');
  console.log(JSON.stringify(intelData.intelligence.metrics, null, 2));
  console.log('\n--- Detected Architectural Patterns ---');
  intelData.intelligence.patterns.forEach((pat: any) => {
    console.log(`- ${pat.name}: ${pat.description}`);
  });
  console.log('\n--- LLM Profile Evaluation Summary ---');
  console.log(`"${intelData.intelligence.evaluation}"`);

  // 4. Fetch Engineering Timeline
  console.log(`\n4. Fetching Engineering Timeline milestones...`);
  const timelineRes = await fetch(`${SERVER_URL}/api/repos/timeline`, {
    headers: { 'Cookie': sessionCookie },
  });
  if (!timelineRes.ok) {
    console.error('Failed to fetch timeline:', await timelineRes.text());
    process.exit(1);
  }
  const timelineData = await timelineRes.json() as any;
  console.log(`Detected milestones: ${timelineData.timeline.length}`);
  timelineData.timeline.forEach((item: any) => {
    console.log(`[${item.date}] - ${item.milestone} (sha:${item.sha})`);
  });

  // 5. Test Semantic Search
  const searchQuery = 'queues and background workers';
  console.log(`\n5. Testing Semantic Search for query: "${searchQuery}"...`);
  
  // Let's first make sure we have at least one compiled entry to search.
  // We can trigger summary generation for a date if database entries are empty.
  const entryCount = await prisma.entry.count();
  if (entryCount === 0) {
    console.log('No daily entries found. Ingesting today\'s summary first to enable search...');
    const triggerRes = await fetch(`${SERVER_URL}/api/entries/trigger-summary`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (triggerRes.ok) {
      console.log('Successfully generated today\'s devlog summary entry.');
    } else {
      console.warn('Failed to compile summary. Semantic search might return empty results if entries are missing.');
    }
  }

  const searchRes = await fetch(`${SERVER_URL}/api/entries/search?query=${encodeURIComponent(searchQuery)}`, {
    headers: { 'Cookie': sessionCookie },
  });
  if (!searchRes.ok) {
    console.error('Semantic search endpoint failed:', await searchRes.text());
    process.exit(1);
  }
  const searchData = await searchRes.json() as any;
  console.log(`Matches found: ${searchData.results.length}`);
  searchData.results.forEach((match: any) => {
    console.log(`\nEntry ID: ${match.id}`);
    console.log(`Relevance Score: ${match.relevanceScore}/10`);
    console.log(`AI Match Reason: "${match.matchReason}"`);
  });

  console.log('\n=== All Local API Integrations Verified Successfully ===');
  await prisma.$disconnect();
}

runTest();
