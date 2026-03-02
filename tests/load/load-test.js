#!/usr/bin/env node

/**
 * Load Testing Script for IDsecure
 *
 * Tests search API endpoints under concurrent load to measure:
 * - Request throughput (requests/second)
 * - Response times (latency)
 * - Error rates
 * - Cache hit rates
 *
 * Usage: node tests/load/load-test.js [endpoint] [concurrency] [duration]
 * Example: node tests/load/load-test.js search 50 30
 */

const autocannon = require('autocannon');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test configurations for different endpoints
const TEST_SCENARIOS = {
  search: {
    method: 'POST',
    route: '/api/search',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john.doe@example.com',
      username: 'johndoe',
      stages: 3,
      aggressive: false,
    }),
  },

  'search-power': {
    method: 'POST',
    route: '/api/search/power',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',
      username: 'johndoe',
      stages: 3,
      aggressive: true,
    }),
  },

  analytics: {
    method: 'GET',
    route: '/api/analytics/investigation?investigationId=test-123&period=7d',
  },

  'system-health': {
    method: 'GET',
    route: '/api/system/health',
  },
};

function printSummary(result) {
  console.log('\n=== LOAD TEST SUMMARY ===');
  console.log(`\nURL: ${result.url}`);
  console.log(`Duration: ${result.duration.toFixed(2)}s`);
  console.log(`Concurrency: ${result.connections}`);

  console.log('\n--- Request Statistics ---');
  console.log(`Total Requests: ${result.requests.total}`);
  console.log(`Requests/sec: ${result.requests.mean.toFixed(2)}`);
  console.log(`Min Request Time: ${result.latency.min.toFixed(2)}ms`);
  console.log(`Max Request Time: ${result.latency.max.toFixed(2)}ms`);
  console.log(`Mean Request Time: ${result.latency.mean.toFixed(2)}ms`);
  console.log(`Median Request Time: ${result.latency.median.toFixed(2)}ms`);
  console.log(`P95 Request Time: ${result.latency.p95.toFixed(2)}ms`);
  console.log(`P99 Request Time: ${result.latency.p99.toFixed(2)}ms`);

  console.log('\n--- Throughput ---');
  console.log(`Throughput (bytes/sec): ${result.throughput.mean.toFixed(2)}`);

  console.log('\n--- Errors ---');
  console.log(`Total Errors: ${result.errors}`);
  console.log(`Error Rate: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
  console.log(`2xx Responses: ${result.statusCode['200'] || 0}`);
  console.log(`4xx Responses: ${result.statusCode['400'] || result.statusCode['404'] || 0}`);
  console.log(`5xx Responses: ${result.statusCode['500'] || result.statusCode['502'] || result.statusCode['503'] || 0}`);

  if (result.errors > 0) {
    console.log('\n--- Error Details ---');
    Object.entries(result.errors || {}).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
  }
}

async function runLoadTest(endpoint, concurrency = 50, duration = 30) {
  const scenario = TEST_SCENARIOS[endpoint];

  if (!scenario) {
    console.error(`\n❌ Unknown endpoint: ${endpoint}`);
    console.log(`Available endpoints: ${Object.keys(TEST_SCENARIOS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🚀 Starting load test for: ${endpoint}`);
  console.log(`📊 Concurrency: ${concurrency} | Duration: ${duration}s`);
  console.log(`🌐 Base URL: ${BASE_URL}`);

  const instance = autocannon({
    url: `${BASE_URL}${scenario.route}`,
    connections: concurrency,
    duration: duration,
    amount: null,
    timeout: 60,
    pipelining: 1,
    method: scenario.method,
    headers: scenario.headers,
    body: scenario.body,
    form: false,
    servername: 'localhost',
    idReplacement: false,
    forever: false,
    workers: 1,
    defaults: {
      headers: {
        'User-Agent': 'IDsecure-LoadTest/1.0',
      },
    },
    requests: [
      scenario,
    ],
  }, (err, result) => {
    if (err) {
      console.error('\n❌ Load test failed:', err);
      process.exit(1);
    }

    printSummary(result);

    // Performance assessment
    const reqPerSec = result.requests.mean;
    const avgLatency = result.latency.mean;
    const errorRate = (result.errors / result.requests.total) * 100;

    console.log('\n--- Performance Assessment ---');

    if (errorRate > 5) {
      console.log('⚠️  HIGH ERROR RATE - System may be unstable under load');
    } else if (errorRate > 1) {
      console.log('⚠️  MODERATE ERROR RATE - Some errors detected');
    } else {
      console.log('✅ GOOD ERROR RATE - System is stable');
    }

    if (avgLatency > 5000) {
      console.log('⚠️  HIGH LATENCY - Response times are slow');
    } else if (avgLatency > 1000) {
      console.log('⚠️  MODERATE LATENCY - Response times could be improved');
    } else {
      console.log('✅ GOOD LATENCY - Response times are acceptable');
    }

    if (reqPerSec > 100) {
      console.log('✅ EXCELLENT THROUGHPUT - High performance');
    } else if (reqPerSec > 50) {
      console.log('✅ GOOD THROUGHPUT - Performance is adequate');
    } else {
      console.log('⚠️  LOW THROUGHPUT - Performance could be improved');
    }
  });

  // Progress updates
  autocannon.track(instance, { renderProgressBar: true, renderResultsTable: true });
}

// Parse command line arguments
const args = process.argv.slice(2);
const endpoint = args[0] || 'search';
const concurrency = parseInt(args[1]) || 50;
const duration = parseInt(args[2]) || 30;

// Run the test
runLoadTest(endpoint, concurrency, duration).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
