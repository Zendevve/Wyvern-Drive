# Monitoring and Observability

> **Last Updated:** 2025-12-18
> **Maintainer:** Development Team

---

## Overview

Wyvern Drive monitoring focuses on:
- **User Experience:** Upload/download success rates, latency
- **System Health:** API errors, rate limits, storage usage
- **Security:** Failed auth attempts, suspicious activity

---

## 1. Metrics Dashboard

### Key Performance Indicators (KPIs)

| Metric | Target | Critical Threshold | Source |
|--------|--------|-------------------|--------|
| **Upload Success Rate** | > 99% | < 95% | Supabase logs |
| **Download Success Rate** | > 99% | < 95% | Supabase logs |
| **Average Upload Time** | < 30s per 100MB | > 60s per 100MB | Client logs |
| **API Response Time (p95)** | < 500ms | > 2000ms | Supabase dashboard |
| **Discord Rate Limit Hits** | 0 | > 10/day | Edge function logs |
| **Failed Auth Attempts** | < 10/day | > 100/day | Supabase Auth logs |

---

## 2. Supabase Monitoring

### Built-in Dashboard

Access: [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Reports

**Metrics Available:**
- API requests per second
- Database queries per second
- Storage bandwidth
- Active connections
- Error rates

### Database Monitoring

**Query Performance:**

```sql
-- Slow queries (> 1 second)
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 10;
```

**Table Sizes:**

```sql
-- Check storage usage
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Edge Function Logs

```bash
# View logs for specific function
supabase functions logs file-operations

# Follow logs in real-time
supabase functions logs file-operations --follow

# Filter by date
supabase functions logs file-operations --since "2025-12-18"
```

---

## 3. Discord API Monitoring

### Rate Limit Tracking

Discord imposes:
- **5 requests per 2 seconds** per webhook
- **Webhook deletion** if sustained abuse

**Monitoring Strategy:**

```typescript
// Track rate limit hits in Edge Function
let rateLimitHits = 0;

async function uploadChunk(chunk: Blob) {
  try {
    const response = await fetch(webhookURL, { method: 'POST', body: chunk });

    if (response.status === 429) {
      rateLimitHits++;
      console.error('Discord rate limit hit', { rateLimitHits });

      // Alert if threshold exceeded
      if (rateLimitHits > 10) {
        await sendAlert('Discord rate limit critical');
      }
    }
  } catch (error) {
    console.error('Discord upload failed', error);
  }
}
```

### Webhook Health Check

**Manual Test:**

```typescript
// Test webhook availability
async function testWebhook(webhookURL: string) {
  const response = await fetch(webhookURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Health check' })
  });

  return response.ok;
}
```

**Automated Daily Check:**

Set up a Supabase cron job to verify webhook health:

```sql
-- supabase/migrations/XXX_webhook_health_check.sql
SELECT cron.schedule(
  'webhook-health-check',
  '0 8 * * *',  -- Daily at 8 AM
  $$
  SELECT net.http_post(
    url := 'YOUR_WEBHOOK_URL',
    body := '{"content": "Daily health check"}'::jsonb
  );
  $$
);
```

---

## 4. Client-Side Monitoring

### Error Tracking

**Console Errors (Development Only):**

```typescript
// Log errors to console in dev mode
if (import.meta.env.DEV) {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });
}
```

**Production Error Reporting (Future):**

Consider integrating [Sentry](https://sentry.io) for production:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

### Performance Monitoring

**Core Web Vitals:**

```typescript
// Track Largest Contentful Paint (LCP)
import { onLCP } from 'web-vitals';

onLCP((metric) => {
  console.log('LCP:', metric.value);
  // Send to analytics
});
```

**Custom Metrics:**

```typescript
// Track upload duration
const uploadStart = performance.now();
await uploadFile(file);
const uploadDuration = performance.now() - uploadStart;

console.log(`Upload took ${uploadDuration}ms for ${file.size} bytes`);
```

---

## 5. Alerting Strategy

### Alert Channels

| Severity | Channel | Response Time |
|----------|---------|---------------|
| **Critical** | Email + Discord DM | Immediate |
| **Warning** | Discord channel | < 24 hours |
| **Info** | Daily digest | Review weekly |

### Alert Definitions

**Critical Alerts:**

- Upload success rate < 95% over 1 hour
- Database connection failures
- Discord webhook deleted or inaccessible
- Auth service down

**Warning Alerts:**

- Discord rate limit hits > 10 per day
- Average upload time > 60s per 100MB
- Database query time > 2s (p95)
- Storage usage > 80% of quota

**Info Alerts:**

- New user signups
- Daily active users count
- Storage usage trends

### Supabase Alerts (Future)

Supabase Pro plan includes:
- Custom alert rules
- Slack/Discord webhooks
- Email notifications

---

## 6. Logs and Retention

### Log Locations

| Component | Log Location | Retention |
|-----------|-------------|-----------|
| **Web App** | Browser console (dev only) | N/A |
| **Edge Functions** | Supabase dashboard | 7 days (free tier) |
| **Database** | `pg_stat_statements` | Rolling window |
| **Auth** | Supabase Auth logs | 30 days |

### Log Levels

```typescript
// Standardized log levels
enum LogLevel {
  DEBUG = 'DEBUG',     // Verbose debugging info
  INFO = 'INFO',       // General info
  WARN = 'WARN',       // Non-critical issues
  ERROR = 'ERROR',     // Errors requiring attention
  CRITICAL = 'CRITICAL' // System-breaking issues
}

function log(level: LogLevel, message: string, context?: object) {
  console.log(JSON.stringify({ level, message, context, timestamp: new Date() }));
}
```

---

## 7. Security Monitoring

### Failed Authentication Attempts

```sql
-- Query failed login attempts
SELECT
  user_id,
  count(*) as failed_attempts,
  max(created_at) as last_attempt
FROM auth.audit_log_entries
WHERE action = 'login'
  AND result = 'failure'
  AND created_at > now() - interval '24 hours'
GROUP BY user_id
HAVING count(*) > 5
ORDER BY failed_attempts DESC;
```

### Suspicious Activity Patterns

**Indicators:**

- Multiple failed login attempts from same IP
- Rapid file uploads (potential abuse)
- Unusual access patterns (overnight activity for daytime user)

**Automated Detection (Future):**

```typescript
// Detect rapid uploads (> 10 files in 1 minute)
async function detectAbusePattern(userId: string) {
  const recentUploads = await supabase
    .from('files')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 60000).toISOString());

  if (recentUploads.data.length > 10) {
    await flagForReview(userId, 'Rapid upload pattern');
  }
}
```

---

## 8. Incident Response

### Incident Severity Levels

| Level | Definition | Response |
|-------|------------|----------|
| **P0** | Service down, users blocked | Immediate 24/7 |
| **P1** | Major feature broken | < 4 hours |
| **P2** | Minor feature degraded | < 24 hours |
| **P3** | Cosmetic issue | Next sprint |

### Incident Workflow

**1. Detection**
- Alert triggers (automated)
- User report (manual)

**2. Triage**
- Assess severity
- Assign owner
- Create incident ticket

**3. Investigation**
- Check logs (Supabase, Netlify, Discord)
- Reproduce issue
- Identify root cause

**4. Mitigation**
- Apply hotfix or rollback
- Verify resolution
- Update monitoring

**5. Post-Mortem**
- Document root cause
- Identify prevention measures
- Update runbooks

### Runbooks

**Runbook 1: Upload Failures Spike**

1. Check Discord webhook status (manual test)
2. Check Supabase Edge Function logs for errors
3. Check Discord rate limit hits
4. If webhook deleted: create new webhook, update env vars, redeploy
5. If rate limited: implement exponential backoff, reduce concurrency

**Runbook 2: Database Slow Queries**

1. Run slow query diagnostic (SQL above)
2. Check connection pool exhaustion
3. Add indexes if missing
4. Optimize query if possible
5. Scale database if needed (Supabase Pro)

---

## 9. Maintenance Windows

**Scheduled Maintenance:**
- **Frequency:** Monthly
- **Duration:** < 30 minutes
- **Notification:** 48 hours advance via Discord/email

**Tasks:**
- Database VACUUM and ANALYZE
- Clear expired shares
- Review and archive old logs

---

## Related Documentation

- **Architecture:** [System Overview](file:///d:/COMPROG/Wyvern%20Drive/docs/Architecture/system-overview.md)
- **Operations:** [Deployment](file:///d:/COMPROG/Wyvern%20Drive/docs/Operations/deployment.md)
- **Features:** All feature docs link to relevant monitoring metrics
