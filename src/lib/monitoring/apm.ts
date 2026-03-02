import { v4 as uuidv4 } from 'uuid';

export interface Metric {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

export interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, string>;
  error?: Error;
}

class APM {
  private metrics: Metric[] = [];
  private traces: Trace[] = [];
  private activeTraces: Map<string, Trace> = new Map();

  startTrace(operation: string, tags: Record<string, string> = {}): string {
    const traceId = uuidv4();
    const spanId = uuidv4();

    const trace: Trace = {
      traceId,
      spanId,
      operation,
      startTime: new Date(),
      tags,
    };

    this.activeTraces.set(spanId, trace);
    this.traces.push(trace);

    return spanId;
  }

  endTrace(spanId: string, error?: Error): void {
    const trace = this.activeTraces.get(spanId);
    if (!trace) return;

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.error = error;

    this.traces.push(trace);
    this.activeTraces.delete(spanId);
  }

  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    const metric: Metric = {
      name,
      value,
      tags,
      timestamp: new Date(),
    };

    this.metrics.push(metric);
  }

  async sendTrace(trace: Trace): Promise<void> {
    if (!process.env.ENABLE_MONITORING || process.env.ENABLE_MONITORING !== 'true') {
      return;
    }

    try {
      await fetch(process.env.MONITORING_ENDPOINT!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'trace', data: trace }),
      }).catch(console.error);
    } catch (error) {
      console.error('Failed to send trace:', error);
    }
  }

  async sendMetric(metric: Metric): Promise<void> {
    if (!process.env.ENABLE_MONITORING || process.env.ENABLE_MONITORING !== 'true') {
      return;
    }

    try {
      await fetch(process.env.MONITORING_ENDPOINT!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metric', data: metric }),
      }).catch(console.error);
    } catch (error) {
      console.error('Failed to send metric:', error);
    }
  }

  getMetricsSummary(): Record<string, { count: number; sum: number; avg: number; min: number; max: number }> {
    const summary: Record<string, any> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = { count: 0, sum: 0, avg: 0, min: Infinity, max: -Infinity };
      }

      summary[metric.name].count++;
      summary[metric.name].sum += metric.value;
      summary[metric.name].avg = summary[metric.name].sum / summary[metric.name].count;
      summary[metric.name].min = Math.min(summary[metric.name].min, metric.value);
      summary[metric.name].max = Math.max(summary[metric.name].max, metric.value);
    }

    return summary;
  }

  getTracesSummary(): Record<string, { count: number; avgDuration: number; errors: number }> {
    const summary: Record<string, any> = {};

    for (const trace of this.traces) {
      if (!summary[trace.operation]) {
        summary[trace.operation] = { count: 0, avgDuration: 0, errors: 0 };
      }

      summary[trace.operation].count++;
      if (trace.duration) {
        summary[trace.operation].avgDuration = (summary[trace.operation].avgDuration * (summary[trace.operation].count - 1) + trace.duration) / summary[trace.operation].count;
      }
      if (trace.error) {
        summary[trace.operation].errors++;
      }
    }

    return summary;
  }

  async flush(): Promise<void> {
    const metricsSummary = this.getMetricsSummary();
    const tracesSummary = this.getTracesSummary();

    for (const [name, stats] of Object.entries(metricsSummary)) {
      await this.sendMetric({
        name,
        value: stats.avg,
        tags: { type: 'summary', aggregation: 'avg' },
      });
    }

    for (const [name, stats] of Object.entries(tracesSummary)) {
      await this.sendMetric({
        name: `${name}_duration`,
        value: stats.avgDuration,
        tags: { type: 'summary', aggregation: 'avg' },
      });

      await this.sendMetric({
        name: `${name}_errors`,
        value: stats.errors,
        tags: { type: 'summary', aggregation: 'count' },
      });
    }

    this.metrics = [];
    this.traces = [];
  }

  async flushTraces(): Promise<void> {
    for (const trace of this.traces) {
      await this.sendTrace(trace);
    }
    this.traces = [];
  }

  reset(): void {
    this.metrics = [];
    this.traces = [];
  }
}

export const apm = new APM();

export function withTracing<T>(
  operation: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const spanId = apm.startTrace(operation, tags);

  return fn()
    .catch(error => {
      apm.endTrace(spanId, error);
      throw error;
    })
    .finally(() => {
      apm.endTrace(spanId);
    });
  }
}
