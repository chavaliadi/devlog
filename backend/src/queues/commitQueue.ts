import { Queue } from 'bullmq';
import { redisConnectionConfig } from '../config/redis';

// Create a queue for processing commit webhooks
export const commitQueue = new Queue('commit-queue', {
  connection: redisConnectionConfig,
});

export const QUEUE_NAME = 'commit-queue';
