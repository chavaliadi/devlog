import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const generateSummary = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment.');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemMessage = `You are a Senior Technical Writer and Developer Advocate summarizing a developer's daily work for a technical audience (engineering leaders and hiring managers).
Your task is to write a highly professional, engaging, and clear Developer Log (Devlog) entry.
The user will provide you with a list of commits, each with its message and filtered diff patch content.

Follow these strict formatting guidelines:
1. Write the devlog in clean, beautiful Markdown format. Do not wrap the output in a markdown block of its own (do not start/end with \`\`\`markdown).
2. Start with an **Overview** section highlighting the core theme/achievement of the day.
3. Follow with a **Key Changes** section, grouped by feature or repository/component. For each significant change, explain:
   - WHAT changed (one line, active voice).
   - WHY it likely changed: the engineering problem it solves (e.g. "Decoupled Git diff scraping into BullMQ queue tasks to prevent blocking main execution threads on slow API requests").
   Avoid generic changelogs, commit message reiterations, or vague phrases like "improved code quality." Be specific to the actual technical diff.
4. Add a **Technical Details & Deep Dive** section if there are complex changes (like schema migrations, security upgrades, new algorithms).
5. Ensure the tone is professional, readable, and highlights engineering trade-offs.
6. Do not include any meta-commentary or sign-offs. Output only the markdown content.`;

  console.log(`[AIService] Sending request to Groq API using model ${model}...`);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Groq API returned status ${response.status} ${response.statusText}: ${errorText || 'No details'}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Groq API returned an empty completion response.');
  }

  return content.trim();
};

/**
 * Generates a short technical explanation for a single commit.
 */
export const summarizeCommit = async (message: string, diffText: string): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment.');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemMessage = `You are a Senior Technical Writer and Developer Advocate.
Your task is to write a single, clear, active-voice, professional sentence explaining the core technical change and WHY it was made (the engineering reasoning/problem it solves).
Do not guess wildly. If the diff does not imply the why, focus on describing the what in a precise engineering manner.
Keep it strictly under 25 words. Do not prefix with "This commit..." or "The developer...". Direct action verbs only. Do not wrap in markdown or quotes.`;

  const prompt = `Commit Message: ${message}\n\nFile Changes:\n${diffText}`;

  console.log(`[AIService] Generating single-commit summary using model ${model}...`);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Groq API returned status ${response.status} ${response.statusText} in summarizeCommit: ${errorText || 'No details'}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Groq API returned an empty response in summarizeCommit.');
  }

  return content.trim();
};

/**
 * Generates 1-3 professional resume bullet points based on a daily log entry content.
 */
export const generateResumeBullets = async (entryContent: string): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment.');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemMessage = `You are an expert Software Engineering Career Coach and Resume Writer.
Your task is to write 1-3 highly polished resume bullet points in standard software engineering format based on the daily work log provided by the user.

Follow these strict rules:
1. Start each bullet point with a strong, active-voice action verb (e.g. "Designed", "Optimized", "Decoupled", "Resolved", "Refactored").
2. Focus on specific technical implementations, technologies used, and engineering problems solved.
3. Keep the tone highly professional, objective, and impact-oriented.
4. Do not include introductory text, explanations, or quotes. Output ONLY the list of bullet points, formatted as markdown bullet list (e.g. - Optimized DB queries...).
5. Keep each bullet point under 25 words and do not exaggerate beyond what the daily log supports.`;

  console.log(`[AIService] Generating resume bullet points using model ${model}...`);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: entryContent },
      ],
      temperature: 0.3,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Groq API returned status ${response.status} ${response.statusText} in generateResumeBullets: ${errorText || 'No details'}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Groq API returned an empty response in generateResumeBullets.');
  }

  return content.trim();
};
