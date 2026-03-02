import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

export enum JobType {
  SEARCH = 'search',
  RISK_ANALYSIS = 'risk-analysis',
  BREACH_MONITOR = 'breach-monitor',
  REPORT_GENERATION = 'report-generation',
  STYLOMETRY = 'stylometry',
  IMAGE_FORENSICS = 'image-forensics',
  ANALYTICS_PRECOMPUTE = 'analytics-precompute',
  CACHE_WARMUP = 'cache-warmup',
  INVESTIGATION_ARCHIVE = 'investigation-archive',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

const connection = new IORedis(
  process.env.JOB_QUEUE_REDIS_URL || 'redis://localhost:6379',
  {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number): number {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  }
);

export const searchQueue = new Queue('search', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 100,
    },
    removeOnFail: {
      age: 86400,
      count: 500,
    },
  },
});

export const analysisQueue = new Queue('analysis', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: { age: 3600, count: 50 },
    removeOnFail: { age: 86400, count: 200 },
  },
});

export const reportQueue = new Queue('reports', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { age: 7200, count: 20 },
    removeOnFail: { age: 86400, count: 50 },
  },
});

export const maintenanceQueue = new Queue('maintenance', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 86400, count: 10 },
    removeOnFail: { age: 86400, count: 10 },
  },
});

export interface JobMetadata {
  userId?: string;
  investigationId?: string;
  organizationId?: string;
  teamId?: string;
  source?: 'web' | 'api' | 'scheduled';
  priority?: number;
}

export async function addJob<T>(
  type: JobType,
  queue: Queue,
  data: T,
  options?: {
    jobId?: string;
    delay?: number;
    priority?: number;
    metadata?: JobMetadata;
  }
): Promise<Job<T, any, any>> {
  const job = await queue.add(type, data, {
    jobId: options?.jobId,
    delay: options?.delay || 0,
    priority: options?.priority || 0,
    removeOnComplete: true,
    removeOnFail: true,
    ...(options?.metadata && {
      metadata: options.metadata,
    }),
  });

  console.log(`📝 Job added: ${type} (${job.id})`);
  return job;
}

export async function scheduleRecurringJob<T>(
  type: JobType,
  queue: Queue,
  data: T,
  cron: string,
  metadata?: JobMetadata
): Promise<void> {
  await queue.add(type, data, {
    repeat: { pattern: cron },
    ...(metadata && { metadata }),
  });

  console.log(`📅 Recurring job scheduled: ${type} (${cron})`);
}

export async function getJob<T>(
  queue: Queue,
  jobId: string
): Promise<Job<T, any, any> | undefined> {
  return await queue.getJob(jobId);
}

export async function cancelJob(
  queue: Queue,
  jobId: string
): Promise<void> {
  const job = await getJob(queue, jobId);
  if (job) {
    await job.remove();
    console.log(`❌ Job cancelled: ${jobId}`);
  }
}

export async function getQueueStats(queue: Queue): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}> {
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  const paused = await queue.isPaused();

  return {
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    delayed: counts.delayed || 0,
    paused,
  };
}

export async function getAllQueueStats(): Promise<{
  search: Awaited<ReturnType<typeof getQueueStats>>;
  analysis: Awaited<ReturnType<typeof getQueueStats>>;
  reports: Awaited<ReturnType<typeof getQueueStats>>;
  maintenance: Awaited<ReturnType<typeof getQueueStats>>;
}> {
  return {
    search: await getQueueStats(searchQueue),
    analysis: await getQueueStats(analysisQueue),
    reports: await getQueueStats(reportQueue),
    maintenance: await getQueueStats(maintenanceQueue),
  };
}

export async function pauseQueue(queue: Queue): Promise<void> {
  await queue.pause();
  console.log(`⏸️  Queue paused: ${queue.name}`);
}

export async function resumeQueue(queue: Queue): Promise<void> {
  await queue.resume();
  console.log(`▶️  Queue resumed: ${queue.name}`);
}

export async function clearQueue(queue: Queue): Promise<void> {
  await queue.drain();
  console.log(`🗑️  Queue cleared: ${queue.name}`);
}

export async function closeAllQueues(): Promise<void> {
  console.log('🔄 Closing all queues...');
  await Promise.all([
    searchQueue.close(),
    analysisQueue.close(),
    reportQueue.close(),
    maintenanceQueue.close(),
  ]);
  console.log('✅ All queues closed');
}

export function setupQueueMonitoring(): void {
  const queues = [
    { queue: searchQueue, name: 'search' },
    { queue: analysisQueue, name: 'analysis' },
    { queue: reportQueue, name: 'reports' },
  ];

  queues.forEach(({ queue, name }) => {
    const queueEvents = new QueueEvents(name, { connection });

    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`⏳ Job waiting [${name}]: ${jobId}`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`▶️  Job started [${name}]: ${jobId}`);
    });

    queueEvents.on('completed', ({ jobId }) => {
      console.log(`✅ Job completed [${name}]: ${jobId}`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`❌ Job failed [${name}]: ${jobId}`, failedReason);
    });

    queueEvents.on('delayed', ({ jobId, delay }) => {
      console.log(`⏰ Job delayed [${name}]: ${jobId} (${delay}ms)`);
    });

    queueEvents.on('removed', ({ jobId }) => {
      console.log(`🗑️  Job removed [${name}]: ${jobId}`);
    });
  });
}

export interface WorkerConfig {
  concurrency: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

export const WorkerConfigs: Record<string, WorkerConfig> = {
  search: {
    concurrency: parseInt(process.env.JOB_QUEUE_CONCURRENCY_SEARCH || '5', 10),
    limiter: {
      max: 10,
      duration: 60000,
    },
  },
  analysis: {
    concurrency: 3,
  },
  reports: {
    concurrency: 2,
  },
  maintenance: {
    concurrency: 1,
  },
};

if (process.env.NODE_ENV === 'production') {
  setupQueueMonitoring();
}
