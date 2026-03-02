import { PrismaClient } from '@prisma/client';

const MAX_CONNECTIONS = parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10);
const MIN_CONNECTIONS = parseInt(process.env.DB_MIN_CONNECTIONS || '5', 10);
const CONNECTION_TIMEOUT = parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10);

/**
 * Primary database client for writes
 */
export const dbWrite = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error', 'warn'],
  // Connection pool configuration for production
  ...(process.env.NODE_ENV === 'production' && {
    __internal: {
      engine: {
        connectionLimit: MAX_CONNECTIONS,
        timeout: CONNECTION_TIMEOUT,
      },
    },
  }),
});

/**
 * Read replica database client for reads
 */
export const dbRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error', 'warn'],
  ...(process.env.NODE_ENV === 'production' && {
    __internal: {
      engine: {
        connectionLimit: MAX_CONNECTIONS,
        timeout: CONNECTION_TIMEOUT,
      },
    },
  }),
});

/**
 * Smart database router that automatically routes reads to replica
 */
export const db = {
  // Read operations - use replica
  findMany: (...args: any[]) => dbRead.investigation.findMany(...args),
  findFirst: (...args: any[]) => dbRead.investigation.findFirst(...args),
  findUnique: (...args: any[]) => dbRead.investigation.findUnique(...args),
  count: (...args: any[]) => dbRead.investigation.count(...args),
  findRaw: (...args: any[]) => dbRead.$queryRaw(...args),
  executeRaw: (...args: any[]) => dbRead.$executeRaw(...args),
  aggregate: (...args: any[]) => dbRead.investigation.aggregate(...args),

  // Write operations - use primary
  create: (...args: any[]) => dbWrite.investigation.create(...args),
  createMany: (...args: any[]) => dbWrite.investigation.createMany(...args),
  update: (...args: any[]) => dbWrite.investigation.update(...args),
  updateMany: (...args: any[]) => dbWrite.investigation.updateMany(...args),
  delete: (...args: any[]) => dbWrite.investigation.delete(...args),
  deleteMany: (...args: any[]) => dbWrite.investigation.deleteMany(...args),

  // Transaction support
  transaction: async <T>(
    callback: (tx: Omit<typeof dbWrite, 'transaction'>) => Promise<T>
  ): Promise<T> => {
    return dbWrite.$transaction(callback);
  },

  // Batch operations
  batch: async (...args: any[]) => dbWrite.$transaction(...args),
};

/**
 * Direct access to clients if needed
 */
export { dbWrite, dbRead };

/**
 * Connection pool statistics
 */
export async function getConnectionStats() {
  try {
    // Query connection pool stats
    const poolStats = await dbRead.$queryRaw`
      SELECT
        count(*) as active_connections,
        state,
        count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    return {
      maxConnections: MAX_CONNECTIONS,
      minConnections: MIN_CONNECTIONS,
      ...poolStats[0],
    };
  } catch (error) {
    console.error('Error getting connection stats:', error);
    return {
      maxConnections: MAX_CONNECTIONS,
      minConnections: MIN_CONNECTIONS,
      active_connections: 0,
      idle: 0,
    };
  }
}

/**
 * Health check for database connections
 */
export async function healthCheck(): Promise<{
  primary: boolean;
  replica: boolean;
  stats?: any;
}> {
  const checks = {
    primary: false,
    replica: false,
  };

  try {
    await dbWrite.$queryRaw`SELECT 1`;
    checks.primary = true;
  } catch (error) {
    console.error('Primary database health check failed:', error);
  }

  try {
    await dbRead.$queryRaw`SELECT 1`;
    checks.replica = true;
  } catch (error) {
    console.error('Replica database health check failed:', error);
  }

  if (checks.primary || checks.replica) {
    checks.stats = await getConnectionStats();
  }

  return checks;
}

/**
 * Graceful shutdown
 */
export async function shutdown(): Promise<void> {
  console.log('🔄 Shutting down database connections...');

  try {
    await dbWrite.$disconnect();
    console.log('✅ Primary connection closed');
  } catch (error) {
    console.error('❌ Error closing primary connection:', error);
  }

  try {
    await dbRead.$disconnect();
    console.log('✅ Replica connection closed');
  } catch (error) {
    console.error('❌ Error closing replica connection:', error);
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
  });
}

// Periodic connection pool monitoring
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      const stats = await getConnectionStats();
      const { active_connections, idle } = stats as any;

      if (active_connections > MAX_CONNECTIONS * 0.8) {
        console.warn(`⚠️  High connection usage: ${active_connections}/${MAX_CONNECTIONS}`);
      }

      if (idle < MIN_CONNECTIONS * 0.5) {
        console.warn(`⚠️  Low idle connections: ${idle}`);
      }
    } catch (error) {
      console.error('Connection pool monitoring error:', error);
    }
  }, 300000); // Every 5 minutes
}
