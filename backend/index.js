// Vercel serverless entry point for Express app
import AdvotecateServer from './dist/server.js';

// Create and export Express app instance
const server = new AdvotecateServer();
const app = server.getApp();

export default app;
