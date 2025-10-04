// Vercel serverless entry point
import AdvotecateServer from '../dist/server.js';

// Create server instance
const serverInstance = new AdvotecateServer();
const app = serverInstance.getApp();

// Export for Vercel
export default app;
