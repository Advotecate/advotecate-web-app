// PostgreSQL Database Connection for Advotecate Payments
// Connects to your GCP PostgreSQL instance

import { Pool } from 'pg';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '10.229.208.3', // Your GCP PostgreSQL private IP
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'advotecate_payments_dev',
  user: process.env.DB_USER || 'advotecate_app_dev',
  password: process.env.DB_PASSWORD, // From Secret Manager
  ssl: {
    rejectUnauthorized: false // For development - enable proper SSL in production
  },
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error if connection takes longer than 2 seconds
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Database query function with error handling
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Test database connection
export async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('Database connected successfully:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Get database statistics
export async function getDatabaseStats() {
  try {
    const result = await query(`
      SELECT schemaname, tablename, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes
      FROM pg_stat_user_tables
      WHERE schemaname IN ('payments', 'compliance')
      ORDER BY schemaname, tablename;
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting database stats:', error);
    return [];
  }
}

export default pool;