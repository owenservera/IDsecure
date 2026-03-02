import { NextRequest, NextResponse } from 'next/server';
import { addJob, JobType, getAllQueueStats } from '@/lib/queue/job-queue';
import { z } from 'zod';

const ScheduleJobSchema = z.object({
  type: z.enum(['search', 'analysis', 'report'] as any),
  priority: z.number().min(0).max(10).default(0),
  delay: z.number().min(0).max(86400).default(0),
  metadata: z.object({
    userId: z.string().optional(),
    investigationId: z.string().optional(),
    organizationId: z.string().optional(),
  }).optional(),
});

const JobDataSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  username: z.string().optional(),
  hints: z.object({}).optional(),
  stages: z.number().min(1).max(10).default(5),
  aggressive: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, priority, delay, metadata } = ScheduleJobSchema.parse(body);

    let jobData: any = {};
    let queue: any;

    switch (type) {
      case 'search':
        queue = (await import('@/lib/queue/job-queue')).searchQueue;
        jobData = JobDataSchema.parse(body);
        break;

      case 'analysis':
        queue = (await import('@/lib/queue/job-queue')).analysisQueue;
        jobData = {
          analysisType: body.analysisType,
          investigationId: body.investigationId,
          data: body.data,
        };
        break;

      case 'report':
        queue = (await import('@/lib/queue/job-queue')).reportQueue;
        jobData = {
          investigationId: body.investigationId,
          format: body.format || 'markdown',
          options: body.options,
        };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid job type' },
          { status: 400 }
        );
    }

    const job = await addJob(
      type as JobType,
      queue,
      jobData,
      {
        priority,
        delay: delay * 1000,
        metadata,
      }
    );

    return NextResponse.json({
      success: true,
      jobId: job.id,
      estimatedStart: delay > 0 ? new Date(Date.now() + delay * 1000).toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    console.error('Schedule job error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule job',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statsParam = searchParams.get('stats');

  if (statsParam === 'true') {
    try {
      const stats = await getAllQueueStats();

      return NextResponse.json({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get queue stats error:', error);

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get queue stats',
        },
        { status: 500 }
      );
    }
  }

  const jobsParam = searchParams.get('jobs');
  const jobType = searchParams.get('type');

  if (jobsParam === 'true' && jobType) {
    try {
      const { searchQueue, analysisQueue, reportQueue } = await import('@/lib/queue/job-queue');
      const queues: Record<string, any> = {
        search: searchQueue,
        analysis: analysisQueue,
        report: reportQueue,
      };

      const queue = queues[jobType];
      if (!queue) {
        return NextResponse.json(
          { success: false, error: 'Invalid job type' },
          { status: 400 }
        );
      }

      const jobs = await queue.getRepeatableJobs(0, 100);

      return NextResponse.json({
        success: true,
        jobs: jobs.map((job: any) => ({
          id: job.id,
          name: job.name,
          data: job.data,
          opts: job.opts,
          next: job.next,
          processed: job.processedOn,
          failed: job.failedOn,
        })),
      });
    } catch (error) {
      console.error('Get jobs error:', error);

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get jobs',
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: 'Invalid request' },
    { status: 400 }
  );
}
