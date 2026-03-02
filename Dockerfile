# IDsecure Production Dockerfile
# Multi-stage build for optimized production image

# ===========================================
# Stage 1: Base
# ===========================================
FROM oven/bun:1 AS base
WORKDIR /app

# ===========================================
# Stage 2: Dependencies
# ===========================================
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ===========================================
# Stage 3: Builder
# ===========================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run build

# ===========================================
# Stage 4: Production Runner
# ===========================================
FROM base AS runner
LABEL maintainer="IDsecure Team"
LABEL version="1.0.0"
LABEL description="AI-Powered Social Intelligence Engine"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 idsecure

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Copy Python report generator if exists
COPY --from=builder /app/scripts/generate_social_report.py ./scripts/generate_social_report.py 2>/dev/null || true

# Set ownership
RUN chown -R idsecure:nodejs /app

# Switch to non-root user
USER idsecure

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start application
CMD ["bun", "server.js"]
