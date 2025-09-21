# Use Node.js 18 Alpine for smaller size
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy frontend package files
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy frontend package files
COPY frontend/package.json frontend/package-lock.json* ./
# Install ALL dependencies including dev dependencies for build
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy frontend source code
COPY frontend/ .

# Build the Next.js application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public directory and handle standalone builds properly
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]