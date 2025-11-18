# System Architecture

## Architecture Overview

**Pattern**: Monolithic API server with browser automation client

**Components**:
1. **Express API Server** - REST endpoints, request handling
2. **Puppeteer Client** - Browser automation, Midjourney API wrapper
3. **Job Polling System** - Background CDN polling, async completion
4. **Supabase Integration** - Storage (images) + Database (metadata)
5. **Health Monitor** - Standalone watchdog process

**Deployment**: Single VPS instance with PM2 process manager

## System Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────┐
│                         External Clients                         │
│                    (Web Apps, Mobile, Scripts)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Express API Server                         │
│                         (server.js)                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Routes:                                                  │   │
│  │  • POST /midjourney/init                                 │   │
│  │  • POST /midjourney/genimage                             │   │
│  │  • POST /midjourney/genvideo                             │   │
│  │  • GET  /midjourney/status                               │   │
│  │  • GET  /health                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────┴───────────────────────────────┐   │
│  │         Job Polling Manager (Map-based)                  │   │
│  │  • Background timers (15s intervals)                     │   │
│  │  • CDN polling for image readiness                       │   │
│  │  • Supabase upload on completion                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────┬───────────────────────┘
             │                            │
             │ Puppeteer API              │ Supabase Client
             ▼                            ▼
┌──────────────────────────┐  ┌─────────────────────────────────┐
│  PuppeteerMidjourneyAPI  │  │      Supabase Service          │
│  (puppeteer-client.js)   │  │  ┌──────────────────────────┐  │
│                          │  │  │  Storage Bucket          │  │
│  ┌────────────────────┐  │  │  │  (product-designs)       │  │
│  │ Headless Chrome    │  │  │  └──────────────────────────┘  │
│  │ (midjourney-       │  │  │  ┌──────────────────────────┐  │
│  │  profile/)         │  │  │  │  PostgreSQL Database     │  │
│  │                    │  │  │  │  (product_design table)  │  │
│  │  • Cookie Auth     │  │  │  └──────────────────────────┘  │
│  │  • Page Automation │  │  │                                 │
│  │  • API Calls       │  │  └─────────────────────────────────┘
│  └────────────────────┘  │              ▲
│           │              │              │
└───────────┼──────────────┘              │
            │                             │
            │ fetch() in browser context  │ File uploads
            ▼                             │
┌──────────────────────────────────────────┴──────────────────────┐
│                    Midjourney Platform                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API: /api/submit-jobs                                     │ │
│  │  • Image generation (t: "imagine")                         │ │
│  │  • Video generation (t: "video")                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CDN: cdn.midjourney.com/{jobId}/0_{idx}.png               │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Upload: /api/storage-upload-file                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Health Monitor (monitor.js)                 │
│  • GET /health every 60s                                         │
│  • PM2 restart on 3 consecutive failures                         │
│  • Memory-based restart after 6hr uptime                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PM2 Process Manager                         │
│  • Auto-restart on crash                                         │
│  • Memory limit: 512MB                                           │
│  • Cron restart: every 4 hours                                   │
│  • Logging: combined.log, out.log, error.log                     │
└─────────────────────────────────────────────────────────────────┘
```

## Component Relationships & Data Flow

### 1. Request Flow (Image Generation)

```
Client → Express → Puppeteer → Midjourney API
  ↓        ↓          ↓             ↓
  │        │          │        Returns jobId
  │        │          │             │
  │        │          ├─────────────┘
  │        │          │
  │        │     Spawn background
  │        │     polling timer
  │        │          │
  │        │          ▼
  │        │     Poll CDN every 15s
  │        │     (0_0.png, 0_1.png...)
  │        │          │
  │        │          ▼
  │        │     Download via browser
  │        │          │
  │        │          ▼
  │        │     Upload to Supabase
  │        │          │
  │        │          ▼
  │        │     Update DB record
  │        │
  │        └───► Return jobId immediately
  │
  └───────────► Receive response
```

### 2. Authentication Flow

```
Server Start
     ▼
Initialize Puppeteer
     ▼
Load cookies.json → Set browser cookies
     ▼
Navigate to /imagine
     ▼
Check for login indicators
  • "Create" button
  • Prompt input field
  • Auth tokens in localStorage
     ▼
Extract channelId
     ▼
Set isAuthenticated = true
     ▼
Ready for API calls
```

### 3. Job Polling Lifecycle

```
Job Created (jobId received)
     ▼
Add to jobs Map: {
  jobId → {
    ideaId, userId, batchSize,
    found: Set<idx>, attempts: 0
  }
}
     ▼
Start interval timer (15s)
     ▼
┌─────────────────────────┐
│ Polling Attempt         │
│  attempts++             │
│  Update job_updated_at  │
│                         │
│  For idx in [0..batchSize):
│    Try download cdn/{jobId}/0_{idx}.png
│    If success:
│      ├─ Upload to Supabase
│      ├─ Update generated_designs_url
│      └─ Add idx to found Set
│                         │
│  If found.size >= batchSize:
│    ├─ Clear timer
│    ├─ Delete from Map
│    └─ Set job_status='completed'
│                         │
│  If attempts >= 24:
│    ├─ Clear timer
│    ├─ Delete from Map
│    └─ Set job_status='timeout'
└─────────────────────────┘
     ▲                  │
     │                  ▼
     └──── Wait 15s ────┘
```

## API Design & Endpoints

### Endpoint Specifications

**POST /midjourney/init**
- **Purpose**: Initialize Puppeteer client
- **Auth**: None
- **Request**: Empty body
- **Response**:
  ```json
  { "success": true, "message": "Client initialized", "status": "running" }
  ```
- **Side Effects**: Launches browser, validates auth

**POST /midjourney/genimage**
- **Purpose**: Generate images from prompt
- **Auth**: None (⚠️ should add)
- **Request**:
  ```json
  {
    "prompt": "string (required)",
    "url_image": "string (optional URL)",
    "idea_id": "string UUID (required)",
    "user_id": "string UUID (optional)",
    "options": {
      "chaos": 0-100, "ar": "ratio", "stylize": 0-1000,
      "weird": 0-3000, "version": 1-7, "quality": "normal|float",
      "stop": 10-100, "tile": bool, "niji": bool,
      "mode": "fast|relaxed", "private": bool
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "...",
    "data": { /* Midjourney response */ },
    "jobId": "string",
    "batchSize": 4,
    "status": "pending",
    "timestamp": "ISO8601"
  }
  ```
- **Side Effects**:
  - Updates DB: job_status='processing', job_created_at, job_updated_at
  - Starts background polling
  - Eventually updates: job_id, generated_designs_url, job_status='completed'

**POST /midjourney/genvideo**
- **Purpose**: Generate video from image
- **Request**:
  ```json
  {
    "image_url": "string (required)",
    "text_prompt": "string (optional)",
    "options": { "chaos": 5, "ar": "4:3", "motion": "high", "mode": "fast" }
  }
  ```
- **Response**: Similar to genimage
- **Side Effects**: Uploads image to Midjourney CDN first

**GET /midjourney/status**
- **Purpose**: Check auth status
- **Response**:
  ```json
  {
    "success": true,
    "isLoggedIn": true,
    "status": "running",
    "uptime": 3600
  }
  ```

**GET /health**
- **Purpose**: Health metrics for monitoring
- **Response**:
  ```json
  {
    "status": "running|stopped|error",
    "uptime": 3600,
    "totalRequests": 150,
    "successfulRequests": 145,
    "failedRequests": 5,
    "successRate": 97,
    "lastRequest": "ISO8601",
    "lastError": "string|null",
    "timestamp": "ISO8601"
  }
  ```

**GET /midjourney/proxy-image?url=...**
- **Purpose**: Proxy CDN images through browser auth
- **Validation**: Only allows cdn.midjourney.com URLs
- **Response**: Binary image data with Content-Type header

### API Versioning

**Current**: No versioning (v1 implicit)

**Recommended**:
- URL path: `/api/v1/midjourney/genimage`
- Header: `Accept: application/vnd.midjourney.v1+json`

## Data Models & Schemas

### Supabase Schema

**Table: product_design**
```sql
CREATE TABLE product_design (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job tracking
  job_id TEXT,                        -- Midjourney job ID
  job_status TEXT,                    -- 'processing'|'completed'|'failed'|'timeout'
  job_created_at TIMESTAMPTZ,
  job_updated_at TIMESTAMPTZ,

  -- Results
  generated_designs_url JSONB,        -- ["https://...png", ...]
  error_message TEXT,

  -- Additional fields (app-specific)
  user_id UUID,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_design_job_id ON product_design(job_id);
CREATE INDEX idx_product_design_status ON product_design(job_status);
CREATE INDEX idx_product_design_user_id ON product_design(user_id);
```

**Storage Bucket: product-designs**
- Path format: `product_design/{ideaId}/generated_{timestamp}_{idx}.png`
- Public read access
- No size limits configured

### Internal State Models

**jobs Map**:
```javascript
Map<jobId, {
  ideaId: string,        // Supabase product_design.id
  userId: string|null,
  batchSize: number,     // Expected image count
  found: Set<number>,    // Completed image indices
  attempts: number,      // Polling attempts
  timer: NodeJS.Timer    // setInterval reference
}>
```

**healthStatus**:
```javascript
{
  status: 'stopped'|'running'|'error',
  uptime: number,              // Start timestamp
  totalRequests: number,
  successfulRequests: number,
  failedRequests: number,
  lastRequest: string|null,    // ISO8601
  lastError: string|null
}
```

## Integration Points

### 1. Midjourney Platform

**Base URL**: https://www.midjourney.com

**Endpoints Used**:
- `POST /api/submit-jobs` - Generate images/videos
  - Headers: `Content-Type: application/json`, `x-csrf-protection: 1`
  - Body: `{ f, channelId, t: "imagine"|"video", prompt, ... }`
  - Response: `{ id, status, ... }`

- `POST /api/storage-upload-file` - Upload reference images
  - Body: FormData with file blob
  - Response: `{ shortUrl: "https://mj.sh/..." }`

- `GET https://cdn.midjourney.com/{jobId}/0_{idx}.png` - Download results
  - Requires auth cookies
  - Returns 404 until generation complete

**Authentication**:
- Cookie-based (no API keys)
- Tokens: `__Host-Midjourney.AuthUserTokenV3_r`, `__Host-Midjourney.AuthUserTokenV3_i`
- Expires: Unknown (empirically ~days to weeks)
- Refresh: Manual re-login required

**Rate Limits**:
- Not officially documented
- Empirically: ~100 requests/hour in relaxed mode
- Fast mode: Higher limits but uses subscription quota

### 2. Supabase

**Project**: vilyavgrknohxhfvvayc.supabase.co

**Authentication**: Service role key (full admin)

**Storage API**:
```javascript
supabaseAdmin.storage
  .from('product-designs')
  .upload(filePath, buffer, { contentType, upsert: false });

supabaseAdmin.storage
  .from('product-designs')
  .getPublicUrl(filePath);
```

**Database API**:
```javascript
supabaseAdmin
  .from('product_design')
  .select('generated_designs_url')
  .eq('id', ideaId)
  .single();

supabaseAdmin
  .from('product_design')
  .update({ job_status: 'completed', job_updated_at: now })
  .eq('id', ideaId);
```

## Security Considerations

### Current Security Posture

**Vulnerabilities**:
1. **Hardcoded Service Role Key** (Critical)
   - Location: server.js line 27
   - Impact: Full database access if code leaked
   - Mitigation: Move to .env immediately

2. **No API Authentication** (High)
   - All endpoints public
   - Impact: Unauthorized usage, quota abuse
   - Mitigation: Add API key middleware

3. **Open CORS** (Medium)
   - Allows all origins
   - Impact: XSS attacks from malicious sites
   - Mitigation: Restrict to allowed domains

4. **Cookie Storage** (Medium)
   - cookies.json in repository
   - Impact: Account compromise if leaked
   - Mitigation: Add to .gitignore, use encrypted storage

5. **No Input Validation** (Medium)
   - Prompts passed directly to Midjourney
   - Impact: Prompt injection, inappropriate content
   - Mitigation: Validate/sanitize inputs

**Security Headers**: None configured

### Recommended Mitigations

```javascript
// 1. Environment variables
require('dotenv').config();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 2. API key middleware
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !validateAPIKey(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use('/midjourney/*', authenticateAPIKey);

// 3. CORS restrictions
app.use(cors({
  origin: ['https://yourapp.com', 'https://admin.yourapp.com'],
  credentials: true
}));

// 4. Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100 // 100 requests per window
});
app.use('/midjourney/*', limiter);

// 5. Input validation
const { body, validationResult } = require('express-validator');

app.post('/midjourney/genimage', [
  body('prompt').isString().isLength({ min: 1, max: 500 }),
  body('idea_id').isUUID(),
  body('options.chaos').optional().isInt({ min: 0, max: 100 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ...
});
```

## Scalability Patterns

### Current Limitations

**Single Instance Bottlenecks**:
- Puppeteer profile lock prevents horizontal scaling
- Memory limit: 512MB → ~10-20 concurrent jobs
- Browser overhead: ~150MB baseline

**Vertical Scaling** (Current Approach):
- Increase memory allocation (1GB, 2GB)
- Faster CPU for browser rendering
- SSD for profile I/O

### Horizontal Scaling Strategies (Future)

**Option 1: Multi-Account Sharding**
```
Load Balancer
     ├─ Instance 1 (Account A, Profile A)
     ├─ Instance 2 (Account B, Profile B)
     └─ Instance 3 (Account C, Profile C)
```
- Pros: Linear scaling, isolated failures
- Cons: Requires multiple Midjourney subscriptions

**Option 2: Queue-Based Architecture**
```
API Server (Stateless) → Redis Queue → Worker Pool (Puppeteer)
```
- Workers claim jobs from queue
- Multiple workers with separate profiles
- Pros: Better resource utilization
- Cons: Increased complexity

**Option 3: Serverless Functions**
```
AWS Lambda + Chromium layer → Midjourney API
```
- Pros: Auto-scaling, pay-per-use
- Cons: Cold start latency, 15min timeout limit

## Performance Optimization

**Current Bottlenecks**:
1. Browser launch: ~3-5s
2. Page navigation: ~2-3s per request
3. CDN polling: 15s intervals (inefficient)
4. Image download: 2-5s per image

**Optimization Strategies**:
1. **Keep browser warm**: Never close, only navigate
2. **Connection pooling**: Reuse page instances
3. **Parallel downloads**: Download all batch images concurrently
4. **CDN HEAD requests**: Check availability before full download
5. **Compression**: Compress before Supabase upload

## Deployment Architecture

**Current Setup**:
```
VPS (Single Server)
├── PM2 Process Manager
│   ├── midjourney-api (server.js)
│   └── midjourney-monitor (monitor.js)
├── Node.js v14+
├── Chromium (via Puppeteer)
└── File System
    ├── midjourney-profile/ (persistent)
    ├── logs/
    └── cookies.json
```

**Deployment Steps**:
1. Clone repository
2. `npm install`
3. Update cookies.json with valid auth
4. `bash start-production.sh`
5. Monitor via `pm2 logs midjourney-api`

**Infrastructure Requirements**:
- RAM: 512MB minimum, 1GB recommended
- CPU: 1 vCore (2+ for better concurrency)
- Disk: 2GB (profile + logs)
- Network: Stable connection for CDN downloads

## Monitoring & Observability

**Current Metrics**:
- Health status (running/stopped/error)
- Request counters (total, success, failed)
- Success rate percentage
- Uptime seconds
- Last request timestamp
- Last error message

**Missing Observability**:
- Response time percentiles (p50, p95, p99)
- Job completion latency
- CDN download success rate
- Browser memory usage
- Queue depth (if implemented)
- Error categorization

**Recommended Tools**:
- **Metrics**: Prometheus + Grafana
- **Logs**: Loki or ELK stack
- **APM**: New Relic, Datadog
- **Alerting**: PagerDuty for downtime

## Disaster Recovery

**Backup Strategy**:
- Database: Supabase auto-backups (daily)
- Code: Git repository
- Cookies: Manual backup to secure storage
- Browser profile: Not critical (recreatable)

**Recovery Procedures**:
1. **Service crash**: PM2 auto-restart
2. **Cookie expiration**: Manual login → update cookies.json
3. **Midjourney API changes**: Update request payloads in code
4. **Database corruption**: Restore from Supabase backup
5. **Complete server failure**: Redeploy to new VPS from git

## Open Questions

1. **WebSocket alternative?** Could reduce polling overhead
2. **Caching strategy?** Store frequent prompts for reuse
3. **Multi-region deployment?** CDN proximity optimization
4. **Database sharding?** If >1M records in product_design
5. **Observability stack?** Which tools for production monitoring?
