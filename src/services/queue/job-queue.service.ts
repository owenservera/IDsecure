/**
 * Job Queue Service - BullMQ distributed task queue
 * Handles background jobs for search, analysis, reports, and exports
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

export interface JobData {
  type: 'search' | 'analysis' | 'report' | 'export' | 'breach-monitor';
  payload: any;
  userId?: string;
  investigationId?: string;
  priority?: number;
}

export interface JobProgress {
  progress: number;
  message?: string;
  data?: any;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
};

class JobQueueService {
  private searchQueue: Queue<JobData, JobResult>;
  private analysisQueue: Queue<JobData, JobResult>;
  private reportQueue: Queue<JobData, JobResult>;
  private exportQueue: Queue<JobData, JobResult>;
  
  private searchWorker: Worker<JobData, JobResult>;
  private analysisWorker: Worker<JobData, JobResult>;
  private reportWorker: Worker<JobData, JobResult>;
  private exportWorker: Worker<JobData, JobResult>;

  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor() {
    // Initialize queues
    this.searchQueue = new Queue<JobData, JobResult>('search-jobs', { connection });
    this.analysisQueue = new Queue<JobData, JobResult>('analysis-jobs', { connection });
    this.reportQueue = new Queue<JobData, JobResult>('report-jobs', { connection });
    this.exportQueue = new Queue<JobData, JobResult>('export-jobs', { connection });

    // Initialize workers
    this.searchWorker = new Worker<JobData, JobResult>(
      'search-jobs',
      async (job) => await this.processSearchJob(job),
      { connection, concurrency: parseInt(process.env.JOB_CONCURRENCY || '5') }
    );

    this.analysisWorker = new Worker<JobData, JobResult>(
      'analysis-jobs',
      async (job) => await this.processAnalysisJob(job),
      { connection, concurrency: 3 }
    );

    this.reportWorker = new Worker<JobData, JobResult>(
      'report-jobs',
      async (job) => await this.processReportJob(job),
      { connection, concurrency: 2 }
    );

    this.exportWorker = new Worker<JobData, JobResult>(
      'export-jobs',
      async (job) => await this.processExportJob(job),
      { connection, concurrency: 3 }
    );

    // Setup queue event listeners
    this.setupQueueEvents('search-jobs');
    this.setupQueueEvents('analysis-jobs');
    this.setupQueueEvents('report-jobs');
    this.setupQueueEvents('export-jobs');

    console.log('Job queue service initialized');
  }

  /**
   * Setup queue event listeners
   */
  private setupQueueEvents(queueName: string) {
    const events = new QueueEvents(queueName, { connection });
    this.queueEvents.set(queueName, events);

    events.on('completed', ({ jobId, returnvalue }) => {
      console.log(`Job ${jobId} completed`);
    });

    events.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed: ${failedReason}`);
    });

    events.on('progress', ({ jobId, data }) => {
      console.log(`Job ${jobId} progress: ${JSON.stringify(data)}`);
    });
  }

  /**
   * Add search job to queue
   */
  async addSearchJob(data: JobData): Promise<Job<JobData, JobResult, string>> {
    return this.searchQueue.add(`search-${Date.now()}`, data, {
      priority: data.priority || 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    });
  }

  /**
   * Add analysis job to queue
   */
  async addAnalysisJob(data: JobData): Promise<Job<JobData, JobResult, string>> {
    return this.analysisQueue.add(`analysis-${Date.now()}`, data, {
      priority: data.priority || 0,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    });
  }

  /**
   * Add report generation job
   */
  async addReportJob(data: JobData): Promise<Job<JobData, JobResult, string>> {
    return this.reportQueue.add(`report-${Date.now()}`, data, {
      priority: data.priority || 0,
      attempts: 2,
    });
  }

  /**
   * Add export job
   */
  async addExportJob(data: JobData): Promise<Job<JobData, JobResult, string>> {
    return this.exportQueue.add(`export-${Date.now()}`, data, {
      priority: data.priority || 0,
      attempts: 3,
    });
  }

  /**
   * Process search job
   */
  private async processSearchJob(job: Job<JobData, JobResult>): Promise<JobResult> {
    try {
      await job.updateProgress({ progress: 10, message: 'Initializing search...' });
      
      // Import search service dynamically
      const { executeSearchWorkflow } = await import('@/services/search/workflow.service');
      
      const result = await executeSearchWorkflow(job.data.payload);
      
      await job.updateProgress({ progress: 100, message: 'Search completed' });
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Search job failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process analysis job
   */
  private async processAnalysisJob(job: Job<JobData, JobResult>): Promise<JobResult> {
    try {
      await job.updateProgress({ progress: 20, message: 'Starting analysis...' });
      
      // Import analysis service
      const { runAnalysisWorkflow } = await import('@/services/analysis/analysis.service');
      
      const result = await runAnalysisWorkflow(job.data.payload);
      
      await job.updateProgress({ progress: 100, message: 'Analysis completed' });
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Analysis job failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      };
    }
  }

  /**
   * Process report job
   */
  private async processReportJob(job: Job<JobData, JobResult>): Promise<JobResult> {
    try {
      await job.updateProgress({ progress: 10, message: 'Generating report...' });
      
      // Import report service
      const { generateReportWorkflow } = await import('@/services/report/report.service');
      
      const result = await generateReportWorkflow(job.data.payload);
      
      await job.updateProgress({ progress: 100, message: 'Report generated' });
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Report job failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed',
      };
    }
  }

  /**
   * Process export job
   */
  private async processExportJob(job: Job<JobData, JobResult>): Promise<JobResult> {
    try {
      await job.updateProgress({ progress: 10, message: 'Exporting data...' });
      
      // Import export service
      const { exportDataWorkflow } = await import('@/services/export/export.service');
      
      const result = await exportDataWorkflow(job.data.payload);
      
      await job.updateProgress({ progress: 100, message: 'Export completed' });
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Export job failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job<JobData, JobResult, string> | null> {
    const queue = this.getQueue(queueName);
    if (!queue) return null;
    const job = await queue.getJob(jobId);
    return job || null;
  }

  /**
   * Get queue stats
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    const queue = this.getQueue(queueName);
    if (!queue) return null;

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get all queue stats
   */
  async getAllQueueStats(): Promise<Record<string, any>> {
    const queues = ['search-jobs', 'analysis-jobs', 'report-jobs', 'export-jobs'];
    const stats: Record<string, any> = {};

    for (const queueName of queues) {
      stats[queueName] = await this.getQueueStats(queueName);
    }

    return stats;
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.pause();
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.resume();
    }
  }

  /**
   * Drain queue
   */
  async drainQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.drain();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await Promise.all([
      this.searchQueue.close(),
      this.analysisQueue.close(),
      this.reportQueue.close(),
      this.exportQueue.close(),
      this.searchWorker.close(),
      this.analysisWorker.close(),
      this.reportWorker.close(),
      this.exportWorker.close(),
    ]);

    for (const events of this.queueEvents.values()) {
      events.close();
    }

    console.log('Job queue service closed');
  }

  /**
   * Get queue by name
   */
  private getQueue(queueName: string): Queue<JobData, JobResult> | null {
    switch (queueName) {
      case 'search-jobs':
        return this.searchQueue;
      case 'analysis-jobs':
        return this.analysisQueue;
      case 'report-jobs':
        return this.reportQueue;
      case 'export-jobs':
        return this.exportQueue;
      default:
        return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const stats = await this.getAllQueueStats();
      return stats !== null;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const jobQueueService = new JobQueueService();
