# Express.js Server Dockerfile
FROM node:18-alpine AS base

# Install system dependencies for native modules
RUN apk add --no-cache libc6-compat git

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Build argument for GitHub token (for GitHub Packages)
ARG GITHUB_TOKEN

# Copy package files
COPY package*.json ./

# Configure npm for GitHub Packages
RUN echo "@sbaka:registry=https://npm.pkg.github.com" >> .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Remove .npmrc to not leak token
RUN rm -f .npmrc

# Development dependencies for build
FROM base AS dev-deps
WORKDIR /app

# Build argument for GitHub token
ARG GITHUB_TOKEN

# Copy package files
COPY package*.json ./

# Configure npm for GitHub Packages
RUN echo "@sbaka:registry=https://npm.pkg.github.com" >> .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

# Install all dependencies including dev dependencies
RUN npm ci && npm cache clean --force

# Remove .npmrc to not leak token
RUN rm -f .npmrc

# Build the application
FROM dev-deps AS builder
WORKDIR /app

# Copy source code
COPY . .

# Build the server
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Copy database migration files (required by Drizzle)
COPY --from=builder --chown=nodejs:nodejs /app/db ./db

# Create logs directory with proper permissions
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose the port
EXPOSE 3000

# Health check for Express.js app
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3000, path: '/api/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start the Express.js application
CMD ["node", "dist/index.js"]