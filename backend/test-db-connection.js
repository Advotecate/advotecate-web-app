#!/usr/bin/env node
// Simple database connection test
import pkg from 'pg';
const { Pool } = pkg;

console.log('🔌 Testing database connection...');

const testConnections = [
  {
    name: 'Private IP (current setup)',
    config: {
      host: '10.229.208.3',
      port: 5432,
      database: 'advotecate_payments_dev',
      user: 'advotecate_app_dev',
      password: 'XPyL97uYXWuLMyaO2nu17MbLC',
      ssl: false,
      connectionTimeoutMillis: 5000,
    }
  },
  {
    name: 'Socket path (Cloud Run)',
    config: {
      host: '/cloudsql/advotecate-dev:us-central1:advotecate-dev-postgres',
      port: 5432,
      database: 'advotecate_payments_dev',
      user: 'advotecate_app_dev',
      password: 'XPyL97uYXWuLMyaO2nu17MbLC',
      ssl: false,
      connectionTimeoutMillis: 5000,
    }
  }
];

async function testConnection(name, config) {
  console.log(`\n📡 Testing ${name}:`);
  console.log(`   Host: ${config.host}:${config.port}`);

  try {
    const pool = new Pool(config);
    const client = await pool.connect();

    const result = await client.query('SELECT NOW() as current_time, version()');
    console.log(`   ✅ Success!`);
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   DB Version: ${result.rows[0].version.split(' ').slice(0, 3).join(' ')}`);

    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  for (const test of testConnections) {
    await testConnection(test.name, test.config);
  }
}

runTests().catch(console.error);