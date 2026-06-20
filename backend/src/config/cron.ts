import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { generateDailySummary } from '../services/summaryService';

const prisma = new PrismaClient();

/**
 * Initializes timezone-aware nightly cron triggers for daily AI summaries.
 * Checks hourly at the start of each hour. If it is 11 PM (23:00) in a user's
 * configured timezone, their Devlog entry is automatically compiled and saved as a draft.
 */
export const initCronJobs = () => {
  console.log('[Cron] Initializing cron scheduler...');

  // Run at the beginning of every hour (e.g. "0 * * * *")
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running hourly timezone-based check...');
    try {
      const users = await prisma.user.findMany();
      const now = new Date();

      for (const user of users) {
        try {
          const timezone = user.timezone || 'Asia/Kolkata';

          // Extract current hour in the user's specific timezone (24-hour format)
          const userHourStr = now.toLocaleTimeString('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            hour12: false,
          });
          const userHour = parseInt(userHourStr, 10);

          // Trigger nightly summary when it hits 23:00 (11:00 PM) in user's local time
          if (userHour === 23) {
            // Format today's date in user's timezone as YYYY-MM-DD
            const userDateStr = now.toLocaleDateString('en-US', {
              timeZone: timezone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            const [m, d, y] = userDateStr.split('/');
            const dateStr = `${y}-${m}-${d}`;

            console.log(
              `[Cron] Time check matched! 11:00 PM in timezone '${timezone}'. Triggering nightly summary for user '${user.username}' on date '${dateStr}'...`
            );
            
            const result = await generateDailySummary(user.id, dateStr);
            console.log(`[Cron] Devlog summary result for '${user.username}':`, result.success ? 'Success' : `Skipped (${result.reason})`);
          }
        } catch (e: any) {
          console.error(`[Cron] Error processing timezone-check for user '${user.username}':`, e.message);
        }
      }
    } catch (error: any) {
      console.error('[Cron] Error querying users in hourly cron:', error.message);
    }
  });

  console.log('[Cron] Cron scheduler initialized.');
};
