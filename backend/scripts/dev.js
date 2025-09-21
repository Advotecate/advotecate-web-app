#!/usr/bin/env node

/**
 * Development Script
 *
 * Starts the development server with all necessary services
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warn: '\x1b[33m'     // Yellow
  };

  const reset = '\x1b[0m';
  const timestamp = new Date().toLocaleTimeString();

  console.log(`${colors[type]}[${timestamp}] ${message}${reset}`);
}

function startDevelopmentServer() {
  log('🚀 Starting Advotecate Development Server...', 'info');

  // Start the TypeScript server with ts-node
  const server = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug'
    }
  });

  server.on('close', (code) => {
    if (code !== 0) {
      log(`❌ Server process exited with code ${code}`, 'error');
      process.exit(code);
    }
  });

  server.on('error', (error) => {
    log(`❌ Failed to start server: ${error.message}`, 'error');
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('🛑 Shutting down development server...', 'warn');
    server.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('🛑 Shutting down development server...', 'warn');
    server.kill('SIGTERM');
    process.exit(0);
  });
}

// Check if .env file exists
import { existsSync } from 'fs';

if (!existsSync(join(rootDir, '.env'))) {
  log('⚠️  No .env file found. Please copy .env.example to .env and configure your environment variables.', 'warn');
  log('💡 Running: cp .env.example .env', 'info');
}

startDevelopmentServer();