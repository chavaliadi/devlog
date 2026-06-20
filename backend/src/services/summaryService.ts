import { PrismaClient } from '@prisma/client';
import { generateSummary } from './aiService';

const prisma = new PrismaClient();

/**
 * Fetches commits for a user on a given date (YYYY-MM-DD) based on their timezone.
 */
export const getCommitsForDate = async (userId: string, dateStr: string, timezone: string) => {
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    throw new Error(`Invalid date format provided: ${dateStr}. Expected YYYY-MM-DD.`);
  }

  // Fetch commits +/- 1 day to cover all potential timezone offsets
  const startRange = new Date(targetDate);
  startRange.setDate(startRange.getDate() - 1);
  const endRange = new Date(targetDate);
  endRange.setDate(endRange.getDate() + 2);

  const commits = await prisma.commit.findMany({
    where: {
      userId,
      commitDate: {
        gte: startRange,
        lt: endRange,
      },
    },
    orderBy: {
      commitDate: 'asc',
    },
  });

  // Filter commits locally by timezone conversion to match the exact YYYY-MM-DD calendar day
  return commits.filter((commit) => {
    try {
      const localDateStr = commit.commitDate.toLocaleDateString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      // toLocaleDateString returns "MM/DD/YYYY"
      const [m, d, y] = localDateStr.split('/');
      const formattedLocalDate = `${y}-${m}-${d}`;
      return formattedLocalDate === dateStr;
    } catch (e) {
      // Fallback if timezone conversion fails
      const formattedLocalDate = commit.commitDate.toISOString().split('T')[0];
      return formattedLocalDate === dateStr;
    }
  });
};

/**
 * Generates a daily devlog summary using LLM and saves it to the database as a draft.
 * 
 * @param userId Database ID of the user
 * @param dateStr Target date (format YYYY-MM-DD)
 */
export const generateDailySummary = async (userId: string, dateStr: string) => {
  console.log(`[SummaryService] Starting summary generation for user ${userId} on date ${dateStr}...`);

  // 1. Fetch the user configuration
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User with ID '${userId}' not found in database.`);
  }

  const timezone = user.timezone || 'Asia/Kolkata';

  // 2. Fetch the commits for this date
  const dailyCommits = await getCommitsForDate(userId, dateStr, timezone);
  console.log(`[SummaryService] Found ${dailyCommits.length} commits for ${dateStr} in timezone ${timezone}`);

  if (dailyCommits.length === 0) {
    console.log(`[SummaryService] No commits found for user ${userId} on date ${dateStr}. Skipping summary generation.`);
    return {
      success: false,
      reason: 'no_commits',
      message: `No commits found for date ${dateStr}.`,
    };
  }

  // 3. Construct prompt content from commit data
  let prompt = `Here are the git commits for developer '${user.username}' on date ${dateStr}:\n\n`;

  dailyCommits.forEach((commit, index) => {
    prompt += `---
Commit #${index + 1}:
Repository: ${commit.repository}
SHA: ${commit.sha}
Message: ${commit.message}
Commit Date: ${commit.commitDate.toISOString()}
File Changes:
${commit.diffText || '[No file diff available]'}

`;
  });

  // 4. Call Groq AI API
  let summaryContent: string;
  try {
    summaryContent = await generateSummary(prompt);
  } catch (error: any) {
    console.error(`[SummaryService] AI generation failed:`, error.message);
    throw new Error(`AI summary generation failed: ${error.message}`);
  }

  // 5. Save the summary to the database
  const parsedDate = new Date(`${dateStr}T00:00:00.000Z`);

  // Check if an entry already exists for this day
  const existingEntry = await prisma.entry.findFirst({
    where: {
      userId,
      date: parsedDate,
    },
  });

  let entry;
  if (existingEntry) {
    console.log(`[SummaryService] Updating existing entry ${existingEntry.id} for ${dateStr}...`);
    entry = await prisma.entry.update({
      where: { id: existingEntry.id },
      data: {
        content: summaryContent,
        updatedAt: new Date(),
      },
    });
  } else {
    console.log(`[SummaryService] Creating new entry for ${dateStr}...`);
    entry = await prisma.entry.create({
      data: {
        userId,
        date: parsedDate,
        content: summaryContent,
        status: 'draft',
      },
    });
  }

  console.log(`[SummaryService] Devlog summary successfully saved/updated (ID: ${entry.id}).`);
  return {
    success: true,
    entryId: entry.id,
    entry,
  };
};
