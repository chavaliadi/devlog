import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function testPrompt(systemPrompt: string, commitMessage: string, diffText: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  
  const prompt = `Commit Message: ${commitMessage}\n\nFile Changes:\n${diffText}`;
  
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed: ${response.status}`);
  }
  
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content.trim();
}

async function run() {
  const c = await prisma.commit.findFirst({
    where: { sha: 'd64a1a5557b3caea9469e70b647ff2c9d9def809' }
  });
  
  if (!c) {
    console.error('No test commit found.');
    return;
  }

  const promptOption1 = `You are a Senior Technical Writer and Developer Advocate.
Your task is to write a single, active-voice, professional sentence explaining the engineering purpose/reasoning of the change (WHY it was made, not just WHAT was added/modified).
Do not simply paraphrase the commit message or list filenames/columns. Focus on the engineering goal or the problem solved (e.g., instead of "Adds is_flagged column to quiz_attempts", write "Enables tracking and review of flagged quiz attempts to detect potential cheating").
State reasoning confidently. Do not guess wildly, but infer logical technical purpose directly from the code changes and diff.
Keep it strictly under 25 words. Do not prefix with "This commit..." or "The developer...". Direct action verbs only. Do not wrap in quotes or markdown.`;

  const promptOption2 = `You are a Principal Software Engineer.
Your task is to explain the technical RATIONALE and value of the changes in this commit in a single, active-voice sentence (under 25 words).
Do NOT tell me what files were added or columns modified.
Instead, explain the structural purpose or the engineering bug it prevents (e.g., instead of "Adds css import support", write "Prevents bundler compile failures by identifying and delegating external URLs as external assets in CSS transpiles").
Connect the WHAT directly to its WHY. Start with an active technical verb. No quotes or meta-talk.`;

  console.log('--- Testing Prompt Option 1 ---');
  try {
    const res1 = await testPrompt(promptOption1, c.message, c.diffText || '');
    console.log('Result:', res1);
  } catch (e: any) {
    console.error('Error:', e.message);
  }

  console.log('\n--- Testing Prompt Option 2 ---');
  try {
    const res2 = await testPrompt(promptOption2, c.message, c.diffText || '');
    console.log('Result:', res2);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  
  await prisma.$disconnect();
}

run();
