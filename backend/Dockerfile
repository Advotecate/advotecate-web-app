# Simple Dockerfile for MVP deployment
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy simple server
COPY simple-server.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S advotecate -u 1001

# Change ownership
RUN chown -R advotecate:nodejs /app
USER advotecate

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# No health check for Cloud Run (it has its own health checks)

# Start the application
CMD ["node", "simple-server.js"]