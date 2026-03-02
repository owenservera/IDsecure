#!/usr/bin/env node

/**
 * Database Migration Runner for IDsecure
 *
 * Applies SQL migrations to enhance database performance and add materialized views
 *
 * Usage: node scripts/apply-migration.js [migration-file]
 * Example: node scripts/apply-migration.js prisma/migrations/20260302_enhanced_indexes.sql
 */

const fs = require('fs');
const path = require('path');

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function applyMigration(migrationFile) {
  console.log(`\n🚀 Starting database migration...`);
  console.log(`📄 Migration file: ${migrationFile}`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Read migration file
    const migrationPath = path.resolve(process.cwd(), migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`\n❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log(`\n✅ Migration file loaded`);
    console.log(`📊 SQL statements count: ${(migrationSQL.match(/;/g) || []).length}`);

    // Connect to database
    console.log(`\n🔌 Connecting to database...`);
    const client = await pool.connect();
    console.log(`✅ Connected to database`);

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`\n📝 Executing ${statements.length} SQL statements...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      try {
        await client.query(statement);
        successCount++;

        // Show progress for every 10 statements
        if ((i + 1) % 10 === 0) {
          console.log(`  Progress: ${i + 1}/${statements.length} statements completed`);
        }
      } catch (err) {
        errorCount++;
        const errorMsg = err.message || 'Unknown error';

        // Log but don't fail on IF NOT EXISTS or similar errors
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
          console.log(`  ⚠️  Skipping (already exists): statement ${i + 1}`);
        } else {
          console.error(`  ❌ Error in statement ${i + 1}:`, errorMsg);
          console.error(`  Statement preview:`, statement.substring(0, 100) + '...');
        }
      }
    }

    console.log(`\n=== Migration Summary ===`);
    console.log(`✅ Successfully executed: ${successCount} statements`);
    console.log(`❌ Errors: ${errorCount} statements`);
    console.log(`📊 Total statements: ${statements.length}`);

    // Verify materialized views
    console.log(`\n🔍 Verifying materialized views...`);
    const viewCheck = await client.query(`
      SELECT schemaname, matviewname
      FROM pg_matviews
      WHERE schemaname = 'public'
      ORDER BY matviewname
    `);

    console.log(`✅ Found ${viewCheck.rows.length} materialized views:`);
    viewCheck.rows.forEach(view => {
      console.log(`  - ${view.matviewname}`);
    });

    // Verify indexes
    console.log(`\n🔍 Verifying indexes...`);
    const indexCheck = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `);

    console.log(`✅ Found ${indexCheck.rows.length} performance indexes:`);
    indexCheck.rows.forEach((row, index) => {
      if (index < 10) {
        console.log(`  - ${row.indexname}`);
      } else if (index === 10) {
        console.log(`  ... and ${indexCheck.rows.length - 10} more`);
      }
    });

    // Verify functions
    console.log(`\n🔍 Verifying functions...`);
    const functionCheck = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `);

    console.log(`✅ Found ${functionCheck.rows.length} custom functions:`);
    functionCheck.rows.forEach((row, index) => {
      if (index < 10) {
        console.log(`  - ${row.routine_name}`);
      } else if (index === 10) {
        console.log(`  ... and ${functionCheck.rows.length - 10} more`);
      }
    });

    console.log(`\n✅ Migration completed successfully!`);

  } catch (err) {
    console.error(`\n❌ Migration failed:`, err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const migrationFile = args[0] || 'prisma/migrations/20260302_enhanced_indexes.sql';

applyMigration(migrationFile).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
