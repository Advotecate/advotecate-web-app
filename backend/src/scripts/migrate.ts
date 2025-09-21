#!/usr/bin/env tsx

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { query, getClient } from '../config/database.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  id: string;
  filename: string;
  executed_at?: Date;
}

async function createMigrationTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const result = await query('SELECT filename FROM migrations ORDER BY id');
  return new Set(result.rows.map((row: any) => row.filename));
}

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = join(__dirname, '../../database/migrations');
  try {
    const files = await readdir(migrationsDir);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort();
  } catch (error) {
    console.error('Error reading migrations directory:', error);
    return [];
  }
}

async function executeMigration(filename: string): Promise<void> {
  const migrationsDir = join(__dirname, '../../database/migrations');
  const filepath = join(migrationsDir, filename);

  console.log(`Executing migration: ${filename}`);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Read and execute the migration
    const migrationSql = await readFile(filepath, 'utf8');
    await client.query(migrationSql);

    // Record the migration as executed
    await client.query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );

    await client.query('COMMIT');
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration ${filename} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting Advotecate database migrations...\n');

    // Ensure migrations table exists
    await createMigrationTable();

    // Get executed migrations and available files
    const [executedMigrations, migrationFiles] = await Promise.all([
      getExecutedMigrations(),
      getMigrationFiles()
    ]);

    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.has(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations. Database is up to date.');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):\n`);
    pendingMigrations.forEach(file => console.log(`  - ${file}`));
    console.log('');

    // Execute pending migrations
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }

    console.log('\n🎉 All migrations completed successfully!');

    // Refresh materialized views
    console.log('\n🔄 Refreshing materialized views...');
    await query('REFRESH MATERIALIZED VIEW reporting.daily_donation_stats');
    console.log('✅ Materialized views refreshed');

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

export { runMigrations };