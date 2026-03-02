-- Migration: Enhanced Database Indexes and Materialized Views
-- Author: IDsecure Enhancement Plan
-- Date: 2026-03-02

-- ============================================
-- ENHANCED INDEXES FOR PERFORMANCE
-- ============================================

-- Investigation composite search index
CREATE INDEX IF NOT EXISTS idx_investigation_composite_search
ON investigation(name, email, username)
WHERE name IS NOT NULL OR email IS NOT NULL OR username IS NOT NULL;

-- Investigation status and date index for queries
CREATE INDEX IF NOT EXISTS idx_investigation_status_created
ON investigation(status, createdAt DESC);

-- Investigation priority and status for job queue
CREATE INDEX IF NOT EXISTS idx_investigation_priority_status
ON investigation(priority, status)
WHERE status IN ('pending', 'running');

-- Search Result confidence filtering index
CREATE INDEX IF NOT EXISTS idx_search_result_confidence_filter
ON search_result(confidence DESC)
WHERE confidence >= 70;

-- Search Result investigation and confidence compound index
CREATE INDEX IF NOT EXISTS idx_search_result_investigation_confidence
ON search_result(investigationId, confidence DESC);

-- Search Result platform distribution index
CREATE INDEX IF NOT EXISTS idx_search_result_investigation_platform
ON search_result(investigationId, platform);

-- Search Result stage analysis index
CREATE INDEX IF NOT EXISTS idx_search_result_investigation_stage
ON search_result(investigationId, stage);

-- Search Result recent results index
CREATE INDEX IF NOT EXISTS idx_search_result_created_recent
ON search_result(createdAt DESC)
WHERE createdAt > NOW() - INTERVAL '7 days';

-- Risk Assessment score and level index
CREATE INDEX IF NOT EXISTS idx_risk_assessment_score_level
ON risk_assessment(riskLevel, overallScore DESC);

-- Risk Assessment timestamp index for analytics
CREATE INDEX IF NOT EXISTS idx_risk_assessment_timestamp
ON risk_assessment(timestamp DESC);

-- Breach Incident severity and status index
CREATE INDEX IF NOT EXISTS idx_breach_incident_severity_status
ON breach_incident(severity, status);

-- Breach Incident type index
CREATE INDEX IF NOT EXISTS idx_breach_incident_type
ON breach_incident(type);

-- Forensic Report authenticity index
CREATE INDEX IF NOT EXISTS idx_forensic_report_authenticity
ON forensic_report(authenticityScore DESC);

-- Job queue priority and status index
CREATE INDEX IF NOT EXISTS idx_job_priority_status
ON job(priority, status)
WHERE status IN ('pending', 'processing', 'failed');

-- Job queue scheduled at index for time-based processing
CREATE INDEX IF NOT EXISTS idx_job_scheduled
ON job(scheduledAt, status)
WHERE status = 'pending';

-- Cache expiration index for cleanup
CREATE INDEX IF NOT EXISTS idx_cache_expiration
ON cache(expiresAt)
WHERE expiresAt IS NOT NULL;

-- Audit log user action index
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action
ON audit_log(userId, action, createdAt DESC);

-- Audit log resource action index
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_action
ON audit_log(resource, resourceId, action, createdAt DESC);

-- ============================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================

-- Enable full-text search extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Full-text search on search results title
CREATE INDEX IF NOT EXISTS idx_search_result_title_fts
ON search_result USING gin(to_tsvector('english', title));

-- Full-text search on search results snippet
CREATE INDEX IF NOT EXISTS idx_search_result_snippet_fts
ON search_result USING gin(to_tsvector('english', snippet));

-- Full-text search with trigram support
CREATE INDEX IF NOT EXISTS idx_search_result_url_trgm
ON search_result USING gin(url gin_trgm_ops);

-- ============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Investigation statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS investigation_stats AS
SELECT
  i.id AS investigation_id,
  i.name,
  i.email,
  i.username,
  i.status,
  i.priority,
  COUNT(sr.id) AS total_profiles,
  COUNT(CASE WHEN sr.confidence >= 90 THEN 1 END) AS critical_confidence,
  COUNT(CASE WHEN sr.confidence >= 80 AND sr.confidence < 90 THEN 1 END) AS high_confidence,
  COUNT(CASE WHEN sr.confidence >= 60 AND sr.confidence < 80 THEN 1 END) AS medium_confidence,
  COUNT(CASE WHEN sr.confidence < 60 THEN 1 END) AS low_confidence,
  AVG(sr.confidence) AS average_confidence,
  MAX(sr.confidence) AS max_confidence,
  MIN(sr.confidence) AS min_confidence,
  COUNT(DISTINCT sr.platform) AS platform_count,
  STRING_AGG(DISTINCT sr.platform, ', ') AS platforms,
  MAX(sr.createdAt) AS latest_result,
  i.createdAt AS investigation_created,
  ra.risk_level,
  ra.overall_score,
  COUNT(bi.id) AS breach_count,
  COUNT(CASE WHEN bi.severity = 'critical' THEN 1 END) AS critical_breaches
FROM investigation i
LEFT JOIN search_result sr ON sr.investigationId = i.id
LEFT JOIN risk_assessment ra ON ra.investigationId = i.id
LEFT JOIN breach_incident bi ON bi.investigationId = i.id
GROUP BY i.id, i.name, i.email, i.username, i.status, i.priority, ra.risk_level, ra.overall_score;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_investigation_stats_investigation_id
ON investigation_stats(investigation_id);

CREATE INDEX IF NOT EXISTS idx_investigation_stats_status
ON investigation_stats(status);

CREATE INDEX IF NOT EXISTS idx_investigation_stats_risk_level
ON investigation_stats(risk_level);

CREATE INDEX IF NOT EXISTS idx_investigation_stats_created
ON investigation_stats(investigation_created DESC);

-- Platform distribution materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_distribution AS
SELECT
  i.id AS investigation_id,
  sr.platform,
  COUNT(*) AS profile_count,
  AVG(sr.confidence) AS avg_confidence,
  MAX(sr.confidence) AS max_confidence,
  COUNT(DISTINCT sr.location) AS unique_locations,
  COUNT(DISTINCT sr.company) AS unique_companies
FROM investigation i
LEFT JOIN search_result sr ON sr.investigationId = i.id
WHERE sr.id IS NOT NULL
GROUP BY i.id, sr.platform;

CREATE INDEX IF NOT EXISTS idx_platform_distribution_investigation
ON platform_distribution(investigation_id);

CREATE INDEX IF NOT EXISTS idx_platform_distribution_platform
ON platform_distribution(platform);

-- Breach statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS breach_statistics AS
SELECT
  i.id AS investigation_id,
  bi.type,
  bi.severity,
  COUNT(*) AS count,
  COUNT(DISTINCT bi.source) AS source_count,
  MAX(bi.createdAt) AS latest_breach
FROM investigation i
LEFT JOIN breach_incident bi ON bi.investigationId = i.id
WHERE bi.id IS NOT NULL
GROUP BY i.id, bi.type, bi.severity;

CREATE INDEX IF NOT EXISTS idx_breach_statistics_investigation
ON breach_statistics(investigation_id);

-- ============================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- ============================================

CREATE OR REPLACE FUNCTION refresh_investigation_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY investigation_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to refresh investigation stats
CREATE TRIGGER trigger_refresh_investigation_stats_after_search_result
AFTER INSERT OR UPDATE OR DELETE ON search_result
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_investigation_stats();

CREATE TRIGGER trigger_refresh_investigation_stats_after_risk_assessment
AFTER INSERT OR UPDATE OR DELETE ON risk_assessment
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_investigation_stats();

CREATE TRIGGER trigger_refresh_investigation_stats_after_breach_incident
AFTER INSERT OR UPDATE OR DELETE ON breach_incident
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_investigation_stats();

-- ============================================
-- ANALYTICS FUNCTIONS
-- ============================================

-- Function to get investigation analytics
CREATE OR REPLACE FUNCTION get_investigation_analytics(p_investigation_id VARCHAR)
RETURNS TABLE (
  total_profiles BIGINT,
  high_confidence BIGINT,
  platform_distribution JSONB,
  confidence_percentiles JSONB,
  timeline_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_profiles,
    COUNT(CASE WHEN confidence >= 80 THEN 1 END)::BIGINT AS high_confidence,
    jsonb_object_agg(platform, count) AS platform_distribution,
    jsonb_build_object(
      'p50', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY confidence),
      'p90', PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY confidence),
      'p95', PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY confidence),
      'p99', PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY confidence)
    ) AS confidence_percentiles,
    jsonb_agg(
      jsonb_build_object(
        'timestamp', createdAt,
        'confidence', confidence,
        'platform', platform
      )
      ORDER BY createdAt
    ) AS timeline_data
  FROM search_result
  WHERE investigationId = p_investigation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS BIGINT AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM cache
    WHERE expiresAt < NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old investigations
CREATE OR REPLACE FUNCTION archive_old_investigations(days_to_keep INTEGER DEFAULT 90)
RETURNS BIGINT AS $$
DECLARE
  archived_count BIGINT;
BEGIN
  UPDATE investigation
  SET status = 'archived'
  WHERE status = 'completed'
    AND createdAt < NOW() - INTERVAL '1 day' * days_to_keep;

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERFORMANCE TUNING
-- ============================================

-- Set statistics target for better query planning
ALTER TABLE investigation SET (STATISTICS_TARGET = 100);
ALTER TABLE search_result SET (STATISTICS_TARGET = 200);
ALTER TABLE risk_assessment SET (STATISTICS_TARGET = 100);

-- Enable parallel query execution
SET max_parallel_workers_per_gather = 4;
SET max_parallel_workers = 8;
SET parallel_setup_cost = 100;
SET parallel_tuple_cost = 0.1;

-- Configure work memory for complex queries
SET work_mem = '64MB';
SET maintenance_work_mem = '512MB';

-- ============================================
-- VACUUM AND ANALYZE SCHEDULE
-- ============================================

-- Note: In production, schedule these via cron or pg_cron:
-- VACUUM ANALYZE;
-- ANALYZE;
