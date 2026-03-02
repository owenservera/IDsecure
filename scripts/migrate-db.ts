import { PrismaClient } from '@prisma/client';

const OLD_DB_URL = process.env.SQLITE_DATABASE_URL || 'file:./dev.db';
const NEW_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres:postgres@localhost:5432/idsecure';

interface MigrationStats {
  users: number;
  investigations: number;
  searchResults: number;
  riskAssessments: number;
  breachIncidents: number;
  forensicReports: number;
  startTime: Date;
  endTime?: Date;
}

async function migrateDatabase(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    users: 0,
    investigations: 0,
    searchResults: 0,
    riskAssessments: 0,
    breachIncidents: 0,
    forensicReports: 0,
    startTime: new Date(),
  };

  console.log('🚀 Starting migration from SQLite to PostgreSQL...');

  try {
    const oldPrisma = new PrismaClient({
      datasources: {
        db: { url: OLD_DB_URL },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    const newPrisma = new PrismaClient({
      datasources: {
        db: { url: NEW_DB_URL },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    console.log('\n📦 Migrating Users...');
    const users = await oldPrisma.user.findMany();
    for (const user of users) {
      try {
        await newPrisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          skipDuplicates: true,
        });
        stats.users++;
        console.log(`  ✅ User: ${user.email}`);
      } catch (error) {
        console.error(`  ❌ Failed to migrate user ${user.email}:`, error);
      }
    }

    console.log(`\n✅ Migrated ${stats.users} users`);

    console.log('\n📦 Migrating Investigations...');
    const investigations = await oldPrisma.investigation.findMany({
      include: {
        results: true,
        riskAssessment: true,
        breaches: true,
      },
    });

    for (const investigation of investigations) {
      try {
        const migratedInv = await newPrisma.investigation.create({
          data: {
            id: investigation.id,
            name: investigation.name,
            email: investigation.email,
            phone: investigation.phone,
            username: investigation.username,
            userId: investigation.userId,
            createdAt: investigation.createdAt,
            updatedAt: investigation.updatedAt,
          },
          skipDuplicates: true,
        });

        stats.investigations++;

        if (investigation.results && investigation.results.length > 0) {
          for (const result of investigation.results) {
            try {
              await newPrisma.searchResult.create({
                data: {
                  id: result.id,
                  investigationId: migratedInv.id,
                  platform: result.platform,
                  url: result.url,
                  title: result.title,
                  snippet: result.snippet,
                  confidence: result.confidence,
                  location: result.location,
                  company: result.company,
                  profession: result.profession,
                  stage: result.stage,
                  metadata: result.metadata || {},
                  profileImage: result.profileImage,
                  education: result.education,
                  connections: result.connections,
                  lastActive: result.lastActive,
                  verified: result.verified || false,
                  crossRefCount: result.crossRefCount || 0,
                  createdAt: result.createdAt,
                },
                skipDuplicates: true,
              });
              stats.searchResults++;
            } catch (error) {
              console.error(`    ❌ Failed to migrate search result: ${result.id}:`, error);
            }
          }
        }

        if (investigation.riskAssessment) {
          try {
            const ra = investigation.riskAssessment;
            await newPrisma.riskAssessment.create({
              data: {
                id: ra.id,
                investigationId: migratedInv.id,
                overallScore: ra.overallScore,
                riskLevel: ra.riskLevel,
                factors: ra.factors,
                credibilityScore: ra.credibilityScore || 0,
                threatIndicators: ra.threatIndicators || '',
                recommendations: ra.recommendations || '',
                timestamp: ra.timestamp,
              },
              skipDuplicates: true,
            });
            stats.riskAssessments++;
            console.log(`  ✅ Risk Assessment`);
          } catch (error) {
            console.error(`    ❌ Failed to migrate risk assessment: ${investigation.id}:`, error);
          }
        }

        if (investigation.breaches && investigation.breaches.length > 0) {
          for (const breach of investigation.breaches) {
            try {
              await newPrisma.breachIncident.create({
                data: {
                  id: breach.id,
                  investigationId: migratedInv.id,
                  source: breach.source,
                  type: breach.type,
                  severity: breach.severity,
                  title: breach.title,
                  description: breach.description,
                  exposedData: breach.exposedData || '',
                  dateDiscovered: breach.dateDiscovered,
                  status: breach.status || 'unknown',
                  metadata: breach.metadata || {},
                  createdAt: breach.createdAt,
                },
                skipDuplicates: true,
              });
              stats.breachIncidents++;
            } catch (error) {
              console.error(`    ❌ Failed to migrate breach: ${breach.id}:`, error);
            }
          }
        }

        console.log(`  ✅ Investigation: ${investigation.name || investigation.email} (${investigation.results.length} profiles)`);
      } catch (error) {
        console.error(`  ❌ Failed to migrate investigation ${investigation.id}:`, error);
      }
    }

    console.log(`\n✅ Migrated ${stats.investigations} investigations`);

    stats.endTime = new Date();

    const migrationReport = {
      ...stats,
      duration: stats.endTime.getTime() - stats.startTime.getTime(),
      success: true,
    };

    const reportPath = `${process.cwd()}/migration-report.json`;
    const fs = await import('fs/promises');

    await fs.writeFile(reportPath, JSON.stringify(migrationReport, null, 2), 'utf-8');
    console.log(`\n📊 Migration report saved to: ${reportPath}`);
    console.log('\n✅ Migration completed successfully!');

    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();

    return migrationReport;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    stats.endTime = new Date();
    stats.success = false;

    return stats;
  }
}

async function verifyMigration(): Promise<{
  userCountMatch: boolean;
  investigationCountMatch: boolean;
  resultCountMatch: boolean;
}> {
  console.log('\n🔍 Verifying migration...');

  const oldPrisma = new PrismaClient({
      datasources: {
        db: { url: OLD_DB_URL },
      },
    });

  const newPrisma = new PrismaClient({
      datasources: {
        db: { url: NEW_DB_URL },
      },
    });

  try {
    const [oldUsers, newUsers] = await Promise.all([
      oldPrisma.user.count(),
      newPrisma.user.count(),
    ]);

    const [oldInvs, newInvs] = await Promise.all([
      oldPrisma.investigation.count(),
      newPrisma.investigation.count(),
    ]);

    const [oldResults, newResults] = await Promise.all([
      oldPrisma.searchResult.count(),
      newPrisma.searchResult.count(),
    ]);

    const verification = {
      userCountMatch: oldUsers === newUsers,
      investigationCountMatch: oldInvs === newInvs,
      resultCountMatch: oldResults === newResults,
    };

    console.log('\n📊 Verification Results:');
    console.log(`  Users: ${oldUsers} → ${newUsers} ${oldUsers === newUsers ? '✅' : '❌'}`);
    console.log(`  Investigations: ${oldInvs} → ${newInvs} ${oldInvs === newInvs ? '✅' : '❌'}`);
    console.log(`  Search Results: ${oldResults} → ${newResults} ${oldResults === newResults ? '✅' : '❌'}`);
    console.log(`  Overall: ${verification.userCountMatch && verification.investigationCountMatch && verification.resultCountMatch ? '✅ VERIFIED' : '⚠️  VERIFICATION FAILED'}`);

    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();

    return verification;
  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}

async function rollbackMigration(): Promise<void> {
  console.log('\n🔄 Rolling back migration...');

  const newPrisma = new PrismaClient({
      datasources: {
        db: { url: NEW_DB_URL },
      },
    });

  try {
    await newPrisma.investigation.deleteMany();
    await newPrisma.searchResult.deleteMany();
    await newPrisma.riskAssessment.deleteMany();
    await newPrisma.breachIncident.deleteMany();

    await newPrisma.$disconnect();

    console.log('✅ Rollback complete');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      migrateDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    case 'verify':
      verifyMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    case 'rollback':
      rollbackMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    default:
      console.log('Usage: node scripts/migrate-db.ts [migrate|verify|rollback]');
      process.exit(1);
  }
}
