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
   - WHY it changed: state the engineering problem it solves. Write with technical authority and state reasoning confidently when it is directly supported by the diff evidence (e.g., do not say "aims to prevent collisions", state "prevents port collisions by configuring postgres on port 5435").
   - Crucially, do NOT use speculative hedge words (like "likely," "possibly," "potentially," "seems to," or fluff like "underscores the commitment"). However, do NOT fabricate motivation or trade-offs dressed as certainty if they cannot be reasonably inferred from the diff context.
   Avoid generic changelogs, commit message reiterations, or vague phrases like "improved code quality." Be specific to the actual technical diff.
4. Do NOT include a redundant "Technical Details & Deep Dive" section that paraphrases the bullets above. Only include a "Technical Details & Deep Dive" section if there are complex configurations, schema migrations, security setups, or algorithms that require deeper, non-redundant technical explanation. If no such details exist, omit this section entirely.
5. Ensure the tone is professional, technical, and objective.
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

  const systemMessage = `You are a Principal Software Engineer.
Your task is to explain the technical RATIONALE and value of the changes in this commit in a single, active-voice sentence (under 25 words).
Do NOT tell me what files were added or columns modified.
Instead, explain the structural purpose or the engineering bug it prevents (e.g., instead of "Adds css import support", write "Prevents bundler compile failures by identifying and delegating external URLs as external assets in CSS transpiles").
Connect the WHAT directly to its WHY. Start with an active technical verb. No quotes or meta-talk.`;

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
export const generateResumeBullets = async (
  entryContent: string,
  stats: { totalCommits: number; uniqueRepos: string[]; totalFilesChanged: number }
): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment.');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemMessage = `You are an expert Software Engineering Career Coach and Resume Writer.
Your task is to write 1-3 highly polished, quantified resume bullet points in standard software engineering format based on the daily work log and metadata statistics provided by the user.

Follow these strict rules:
1. Start each bullet point with a strong, active-voice action verb (e.g. "Designed", "Optimized", "Decoupled", "Resolved", "Refactored").
2. Focus on specific technical implementations, technologies used, and engineering problems solved.
3. Integrate the provided quantitative statistics (such as unique repositories touched or total unique files changed) where relevant to show concrete work metrics (e.g., "...across ${stats.uniqueRepos.length} repositories" or "...modifying ${stats.totalFilesChanged} unique files").
4. Keep the tone highly professional, objective, and impact-oriented.
5. Do not include introductory text, explanations, or quotes. Output ONLY the list of bullet points, formatted as markdown bullet list (e.g. - Optimized DB queries...).
6. Keep each bullet point under 30 words. Do not fabricate statistics or claim results that are not directly supported by the provided daily log and metrics.`;

  const prompt = `Daily Log Entry:
${entryContent}

Quantitative Metadata for the day:
- Total Commits: ${stats.totalCommits}
- Unique Repositories Touched: ${stats.uniqueRepos.join(', ')}
- Total Unique Files Changed: ${stats.totalFilesChanged}

Write 1-3 quantified resume bullet points based on the above information.`;

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
        { role: 'user', content: prompt },
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
