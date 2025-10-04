#!/usr/bin/env node

// Database analyzer to inspect actual data in GCP PostgreSQL
import { Pool } from 'pg';

// Database configuration (using Cloud SQL proxy)
const dbConfig = {
  host: 'localhost', // Cloud SQL proxy
  port: 5440,
  database: 'advotecate_payments_dev',
  user: 'advotecate_app_dev',
  password: process.argv[2] || process.env.DB_PASSWORD, // Pass as command line argument
  ssl: false, // No SSL needed for proxy connection
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);

async function analyzeDatabase() {
  console.log('🔍 Analyzing GCP Database Contents...\n');

  try {
    // Test connection
    console.log('📡 Testing connection...');
    const connectionTest = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Connected to:', connectionTest.rows[0].postgres_version);
    console.log('⏰ Server time:', connectionTest.rows[0].current_time);
    console.log('');

    // Get all schemas
    console.log('📁 Database schemas:');
    const schemas = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name;
    `);
    schemas.rows.forEach(row => console.log(`  - ${row.schema_name}`));
    console.log('');

    // Get all tables with row counts
    console.log('📊 Tables and row counts:');
    const tables = await pool.query(`
      SELECT
        schemaname,
        tablename,
        n_tup_ins as total_inserts,
        n_tup_upd as total_updates,
        n_tup_del as total_deletes,
        n_live_tup as current_rows
      FROM pg_stat_user_tables
      ORDER BY schemaname, current_rows DESC;
    `);

    for (const table of tables.rows) {
      console.log(`  📋 ${table.schemaname}.${table.tablename}:`);
      console.log(`     Current rows: ${table.current_rows || 0}`);
      console.log(`     Total operations: ${table.total_inserts || 0} inserts, ${table.total_updates || 0} updates, ${table.total_deletes || 0} deletes`);

      // Get sample data from each table (first 3 rows)
      try {
        const sampleData = await pool.query(`SELECT * FROM ${table.schemaname}.${table.tablename} LIMIT 3`);
        if (sampleData.rows.length > 0) {
          console.log(`     Sample columns: ${Object.keys(sampleData.rows[0]).join(', ')}`);
          if (sampleData.rows.length > 0) {
            console.log(`     Sample record: ${JSON.stringify(sampleData.rows[0], null, 2).substring(0, 200)}...`);
          }
        }
      } catch (err) {
        console.log(`     ⚠️  Could not sample data: ${err.message}`);
      }
      console.log('');
    }

    // Check for partitioned tables
    console.log('🗂️  Partitioned tables:');
    const partitions = await pool.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE tablename LIKE '%_2%' OR tablename LIKE '%partition%'
      ORDER BY schemaname, tablename;
    `);

    if (partitions.rows.length > 0) {
      partitions.rows.forEach(row => {
        console.log(`  📂 ${row.schemaname}.${row.tablename} (${row.size})`);
      });
    } else {
      console.log('  No partitioned tables found');
    }
    console.log('');

    // Get database size info
    console.log('💾 Database size information:');
    const dbSize = await pool.query(`
      SELECT
        pg_database.datname,
        pg_size_pretty(pg_database_size(pg_database.datname)) AS size
      FROM pg_database
      WHERE datname = current_database();
    `);
    console.log(`  Database size: ${dbSize.rows[0].size}`);

    // Check for recent activity
    console.log('');
    console.log('⚡ Recent activity check:');
    try {
      // Try to find the most recently modified tables
      const recentActivity = await pool.query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes
        FROM pg_stat_user_tables
        WHERE n_tup_ins > 0 OR n_tup_upd > 0 OR n_tup_del > 0
        ORDER BY (n_tup_ins + n_tup_upd + n_tup_del) DESC
        LIMIT 5;
      `);

      if (recentActivity.rows.length > 0) {
        console.log('  Most active tables:');
        recentActivity.rows.forEach(row => {
          console.log(`    ${row.schemaname}.${row.tablename}: ${row.inserts} inserts, ${row.updates} updates, ${row.deletes} deletes`);
        });
      } else {
        console.log('  No recent activity detected');
      }
    } catch (err) {
      console.log(`  ⚠️  Could not check recent activity: ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Database analysis failed:', error.message);
    if (error.message.includes('password')) {
      console.log('\n💡 Tip: Set DB_PASSWORD environment variable with your database password');
      console.log('   export DB_PASSWORD="your_password_here"');
      console.log('   node db-analyzer.js');
    }
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeDatabase();