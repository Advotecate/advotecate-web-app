// Database Status API - Check Your GCP PostgreSQL Connection
import { NextResponse } from 'next/server';
import { testConnection, getDatabaseStats } from '@/lib/database';

export async function GET() {
  try {
    const isConnected = await testConnection();

    if (!isConnected) {
      return NextResponse.json({
        success: false,
        status: 'connection_failed',
        error: 'Database connection failed - VPC network access required',
        details: {
          message: 'PostgreSQL database is private-IP only and requires VPC network access',
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          database: process.env.DB_NAME,
          solution: 'Deploy to Google Cloud Run with VPC connector for database access',
          deployment_script: './deploy-cloud-run.sh'
        },
        timestamp: new Date().toISOString()
      }, { status: 503 }); // 503 Service Unavailable instead of 500
    }

    const stats = await getDatabaseStats();

    return NextResponse.json({
      success: true,
      status: 'connected',
      database: 'advotecate_payments_dev',
      host: process.env.DB_HOST,
      tables: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database status check failed:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      error: 'Failed to check database status',
      details: {
        type: error.name,
        message: error.message,
        code: error.code || 'UNKNOWN'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}