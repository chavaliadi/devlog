import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const generateSummary = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment.');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemMessage = `You are a Senior Technical Writer and Developer Advocate.
Your task is to write a highly professional, engaging, and clear Developer Log (Devlog) entry summarizing a developer's daily work.
The user will provide you with a list of commits, each with its message and filtered diff patch content.

Follow these strict formatting guidelines:
1. Write the devlog in clean, beautiful Markdown format. Do not wrap the output in a markdown block of its own (i.e. do not start/end with \`\`\`markdown).
2. Start with an **Overview** section highlighting the core theme/achievement of the day.
3. Follow with a **Key Changes** section, grouped by feature or repository/component, with clean bullet points. Write concise, active-voice descriptions of what changed and WHY (e.g. "Optimized DB lookups by replacing user query with environment-based fallback to avoid hardcoding...").
4. Add a **Technical Details & Deep Dive** section if there are complex changes (like algorithm changes, new configuration formats, migrations).
5. Ensure the tone is professional yet readable, suitable for a developer portfolio or progress blog.
6. Do not include any meta-commentary (e.g. "Here is your devlog:") or sign-offs. Only output the markdown content.`;

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
