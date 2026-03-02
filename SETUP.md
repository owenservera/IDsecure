# 🚀 IDsecure Setup Guide

## Quick Start

### Prerequisites

- **Bun** v1.3.4+ - [Install](https://bun.sh)
- **Docker** & Docker Compose - [Install](https://docker.com)
- **Node.js** v20+ (optional, for some tools)

### 1. Clone and Install

```bash
# Navigate to project directory
cd IDsecure

# Install dependencies
bun install
```

### 2. Start Infrastructure (PostgreSQL + Redis)

```bash
# Start PostgreSQL, Redis, and admin tools
bun run infra:up

# Wait for services to be ready (about 30 seconds)
# Check status:
bun run infra:logs
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Update the following values in .env.local:
# - ZAI_API_KEY (required)
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
```

Generate NextAuth secret:
```bash
openssl rand -base64 32
```

### 4. Setup Database

```bash
# Generate Prisma client
bun run db:generate

# Run database migrations
bun run db:push

# (Optional) Seed database with sample data
# bun run db:seed
```

### 5. Start Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Login

Default credentials:
- **Officer ID:** `admin`
- **Access Token:** `idsecure2026`

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Run TypeScript type check |
| `bun run test` | Run unit tests |
| `bun run test:ui` | Run tests with UI |
| `bun run test:e2e` | Run E2E tests |
| `bun run infra:up` | Start infrastructure (Docker) |
| `bun run infra:down` | Stop infrastructure |
| `bun run infra:logs` | View infrastructure logs |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:push` | Push schema to database |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Prisma Studio |

---

## Infrastructure Services

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| **Application** | 3000 | http://localhost:3000 | admin/idsecure2026 |
| **PostgreSQL** | 5432 | localhost:5432 | idsecure/password |
| **Redis** | 6379 | localhost:6379 | password |
| **Redis Commander** | 8081 | http://localhost:8081 | No auth |
| **PgAdmin** | 8082 | http://localhost:8082 | admin@idsecure.local/admin |

---

## Testing

### Unit Tests
```bash
bun run test
bun run test:ui        # With interactive UI
bun run test:coverage  # With coverage report
```

### E2E Tests
```bash
bun run test:e2e
bun run test:e2e:ui    # With Playwright UI
```

---

## Production Deployment

### Docker Build

```bash
# Build Docker image
docker build -t idsecure:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=your_database_url \
  -e REDIS_URL=your_redis_url \
  -e ZAI_API_KEY=your_api_key \
  idsecure:latest
```

### Docker Compose (Production)

```bash
# Build and run with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View PostgreSQL logs
docker logs idsecure-postgres

# Restart infrastructure
bun run infra:down
bun run infra:up
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec -it idsecure-redis redis-cli ping
```

### Clear Cache and Rebuild

```bash
# Clean everything
rm -rf node_modules .next .turbo
bun install
bun run db:generate
bun run dev
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Next.js Application Server              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   API    │  │  Search  │  │   Cache Service  │  │
│  │  Routes  │  │ Service  │  │    (Redis)       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   Auth   │  │   Rate   │  │  Job Queue       │  │
│  │ (NextAuth)│  │ Limiter  │  │    (BullMQ)     │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
┌─────────────┐ ┌─────────┐ ┌──────────┐
│  PostgreSQL │ │  Redis  │ │   Z.ai   │
│  (Prisma)   │ │ (Cache) │ │    AI    │
└─────────────┘ └─────────┘ └──────────┘
```

---

## Support

For issues or questions:
1. Check the [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md)
2. Review Prisma schema: [schema.prisma](./prisma/schema.prisma)
3. Check service implementations in `src/services/`

---

**Built with:** Next.js 16 • React 19 • TypeScript • Prisma • PostgreSQL • Redis • Z.ai AI
