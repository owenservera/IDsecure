-- IDsecure Database Initialization Script
-- PostgreSQL with pgvector extensions

-- Enable pgvector extension for vector search capabilities
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types for better data integrity
DO $$ BEGIN
    CREATE TYPE investigation_status AS ENUM ('pending', 'running', 'completed', 'failed');
    CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
    CREATE TYPE breach_type AS ENUM ('credential', 'personal', 'financial', 'social');
    CREATE TYPE breach_severity AS ENUM ('low', 'medium', 'high', 'critical');
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO idsecure;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO idsecure;

-- Create indexes for performance (Prisma will create tables)
-- These will be applied after Prisma migration

-- Note: Prisma will handle table creation via migrations
-- Run: bun run db:migrate
