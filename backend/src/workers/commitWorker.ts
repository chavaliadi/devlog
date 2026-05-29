import { Worker, Job } from 'bullmq';
import { redisConnectionConfig } from '../config/redis';

// Worker to process incoming commit webhook jobs
export const startCommitWorker = () => {
  const worker = new Worker(
    'commit-queue',
    async (job: Job) => {
      console.log(`[Worker] Starting job ${job.id} of type ${job.name}...`);
      console.log(`[Worker] Data received:`, JSON.stringify(job.data, null, 2));

      // Simulate some processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log(`[Worker] Job ${job.id} completed successfully!`);
      return { success: true, processedAt: new Date().toISOString() };
    },
    {
      connection: redisConnectionConfig,
    }
  );

  worker.on('active', (job) => {
    console.log(`[Worker] Job ${job.id} is now active.`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed. Result:`, result);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
  });

  console.log('[Worker] BullMQ worker initialized and listening for jobs...');
  return worker;
};
