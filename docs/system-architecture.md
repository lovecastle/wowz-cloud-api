# System Architecture

**Last Updated**: 2025-11-18
**Version**: 1.0.0

## Table of Contents

1. [Overall Architecture](#overall-architecture)
2. [Service Architecture](#service-architecture)
3. [API Architecture](#api-architecture)
4. [Authentication & Authorization](#authentication--authorization)
5. [Database Design](#database-design)
6. [External Service Integrations](#external-service-integrations)
7. [Deployment Architecture](#deployment-architecture)
8. [Scalability Considerations](#scalability-considerations)
9. [Security Architecture](#security-architecture)
10. [Data Flow Diagrams](#data-flow-diagrams)

---

## Overall Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        WOWZ Cloud API Platform                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Midjourney  │  │   Ideogram   │  │   ChatGPT    │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  │  (Port 3002) │  │  (Port 3000) │  │  (Port TBD)  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                    ┌───────▼────────┐                           │
│                    │  Supabase      │                           │
│                    │  - PostgreSQL  │                           │
│                    │  - Storage     │                           │
│                    └───────┬────────┘                           │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  External APIs  │
                    │  - Midjourney   │
                    │  - Ideogram     │
                    │  - ChatGPT      │
                    └─────────────────┘
```

### Architecture Patterns

**Microservices Architecture**:
- Independent services for each AI platform
- Separate deployments and scaling
- Isolated failures (one service down doesn't affect others)
- Technology flexibility per service

**API Gateway Pattern** (Future):
- Currently: Direct service access
- Planned: Unified gateway layer
- Benefits: Single entry point, centralized auth, rate limiting

**Asynchronous Processing**:
- Non-blocking API responses
- Background job processing
- Polling-based result retrieval
- Job queue pattern

**Stateless Services**:
- No in-memory session storage
- Database-backed job tracking
- Horizontal scaling capability

---

## Service Architecture

### Midjourney Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Midjourney Service                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Express Server                      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │   Routes   │  │ Middleware │  │   CORS     │    │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │  │
│  └────────┼───────────────┼───────────────┼───────────┘  │
│           │               │               │               │
│  ┌────────▼───────────────▼───────────────▼───────────┐  │
│  │           PuppeteerMidjourneyAPI Client            │  │
│  │  ┌──────────────┐  ┌──────────────┐               │  │
│  │  │   Browser    │  │  Cookie Auth │               │  │
│  │  │  Automation  │  │   Manager    │               │  │
│  │  └──────┬───────┘  └──────┬───────┘               │  │
│  └─────────┼──────────────────┼───────────────────────┘  │
│            │                  │                           │
│  ┌─────────▼──────────────────▼───────────────────────┐  │
│  │          Job Polling & Storage Service             │  │
│  │  ┌──────────────┐  ┌──────────────┐               │  │
│  │  │ Background   │  │  Supabase    │               │  │
│  │  │   Polling    │  │   Upload     │               │  │
│  │  └──────────────┘  └──────────────┘               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │                   PM2 Process Manager               │  │
│  │  - Auto-restart   - Cron jobs   - Log rotation    │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Components**:

1. **Express Server**:
   - HTTP server on port 3002
   - Route handling for API endpoints
   - Middleware stack (CORS, body parser, error handler)

2. **PuppeteerMidjourneyAPI Client**:
   - Browser automation wrapper
   - Cookie injection and session management
   - Platform-specific API calls
   - Error handling and retries

3. **Job Polling Service**:
   - Map-based job storage in memory
   - 15-second interval polling
   - CDN image detection and download
   - Result aggregation

4. **Storage Service**:
   - Supabase storage upload
   - Public URL generation
   - Database record updates

5. **PM2 Process Manager**:
   - Process lifecycle management
   - Memory monitoring (512MB limit)
   - Automatic restarts on crash
   - Scheduled restarts (every 4 hours)

### Ideogram Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Ideogram Service                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Express Server (Port 3000)             │  │
│  │  ┌────────────┐  ┌─────────────────┐  ┌──────────┐  │  │
│  │  │   Routes   │  │  Token Check    │  │   CORS   │  │  │
│  │  │            │  │   Middleware    │  │          │  │  │
│  │  └─────┬──────┘  └────────┬────────┘  └────┬─────┘  │  │
│  └────────┼──────────────────┼────────────────┼────────┘  │
│           │                  │                │            │
│  ┌────────▼──────────────────▼────────────────▼────────┐  │
│  │              Token Management                        │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Fetch from cryptovn.news → Cache → Refresh │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Puppeteer Browser Instance                 │  │
│  │  ┌──────────────┐  ┌──────────────┐                 │  │
│  │  │  Page.evaluate│  │  API Calls   │                 │  │
│  │  │  (Browser    │  │  (In Context) │                 │  │
│  │  │   Context)   │  │              │                 │  │
│  │  └──────────────┘  └──────────────┘                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Job Processing & Storage Service               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │  │
│  │  │  Background  │  │   Polling    │  │  Supabase │  │  │
│  │  │  Processing  │  │  (15s int)   │  │  Upload   │  │  │
│  │  └──────────────┘  └──────────────┘  └───────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Components**:

1. **Express Server**:
   - HTTP server on port 3000
   - Multiple API endpoints
   - Token validation middleware

2. **Token Management**:
   - External token fetching
   - In-memory cache with TTL
   - Auto-refresh before expiry
   - Bearer token support

3. **Browser Automation**:
   - Shared browser instance
   - Stealth mode enabled
   - Page.evaluate() for API calls
   - In-browser fetch requests

4. **Job Processing**:
   - Background async functions
   - 15-second polling intervals
   - 10-minute timeout (40 attempts)
   - Multi-step workflow execution

5. **Storage Integration**:
   - Image download from Ideogram
   - Upload to Supabase storage
   - Database job tracking

### ChatGPT Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ChatGPT Service                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Express Server (TBD)                   │  │
│  │  ┌────────────┐  ┌────────────┐                      │  │
│  │  │   Routes   │  │   CORS     │                      │  │
│  │  └─────┬──────┘  └─────┬──────┘                      │  │
│  └────────┼───────────────┼─────────────────────────────┘  │
│           │               │                                 │
│  ┌────────▼───────────────▼─────────────────────────────┐  │
│  │         Puppeteer Browser Management                  │  │
│  │  ┌──────────────┐  ┌──────────────┐                 │  │
│  │  │  Persistent  │  │ Auto-relaunch│                 │  │
│  │  │   Profile    │  │  on Disc.    │                 │  │
│  │  └──────────────┘  └──────────────┘                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Custom GPT Integration                        │  │
│  │  - WOWZ AI Assistant Remix Design                    │  │
│  │  - Image upload and processing                        │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Components**:

1. **Express Server**: Basic HTTP server (port not configured)
2. **Browser Management**: Shared instance with auto-relaunch
3. **Profile Management**: Persistent user data directory
4. **GPT Integration**: Custom GPT endpoint interaction

---

## API Architecture

### RESTful Design Principles

**HTTP Methods**:
- `POST`: Create resources, trigger async operations
- `GET`: Retrieve resource status, health checks
- `PUT`: Update resources (not widely used)
- `DELETE`: Remove resources (not implemented)

**Response Formats**:

**Success Response**:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "jobId": "job-123",
    "status": "completed"
  },
  "timestamp": "2025-11-18T12:00:00Z"
}
```

**Error Response**:
```json
{
  "error": {
    "message": "Invalid image URL",
    "status": 400,
    "code": "INVALID_INPUT",
    "timestamp": "2025-11-18T12:00:00Z"
  }
}
```

### Endpoint Patterns

#### Synchronous Endpoints

**Health Check**:
```
GET /health
Response: { status, uptime, metrics }
```

**Status Query**:
```
GET /api/job/:jobId
Response: { jobId, status, results }
```

#### Asynchronous Endpoints

**Image Generation**:
```
POST /midjourney/genimage
Request: { prompt, options, idea_id }
Response: { jobId, message }
(Background processing starts)
```

**Image Remix**:
```
POST /api/remix
Request: { imageUrl, imageWeight, style }
Response: { jobId, message }
(Background processing starts)
```

### API Versioning

**Current**: No versioning
**Recommended**: URL versioning
```
/v1/midjourney/genimage
/v2/midjourney/genimage
```

---

## Authentication & Authorization

### Midjourney Authentication

**Method**: Cookie-based authentication

**Flow**:
```
1. Manual cookie extraction from browser
   ↓
2. Store in cookies.json file
   ↓
3. Server loads cookies on startup
   ↓
4. Inject cookies into Puppeteer page
   ↓
5. Cookies authenticate Midjourney requests
```

**Cookie Structure**:
```json
[
  {
    "name": "__Host-Midjourney.AuthUserTokenV3_r",
    "value": "refresh_token_value",
    "domain": ".midjourney.com",
    "path": "/"
  },
  {
    "name": "__Host-Midjourney.AuthUserTokenV3_i",
    "value": "identity_token_value",
    "domain": ".midjourney.com",
    "path": "/"
  }
]
```

**Limitations**:
- Manual cookie refresh required
- No auto-renewal mechanism
- Session expiration requires manual intervention

### Ideogram Authentication

**Method**: Token-based with external fetching

**Flow**:
```
1. Middleware checkToken() intercepts request
   ↓
2. Check if cached token exists and valid
   ↓
3. If expired, fetch new token from cryptovn.news
   ↓
4. Parse JSON response for access_token
   ↓
5. Cache token with TTL (expires_in - 5s)
   ↓
6. Attach token to request object
   ↓
7. Use token in Authorization header for Ideogram API
```

**Token Refresh Logic**:
```javascript
if (!cachedToken || Date.now() >= tokenExpiry) {
  await fetchNewToken(); // From cryptovn.news
  tokenExpiry = Date.now() + ttl * 1000 - 5000; // 5s buffer
}
```

**Fallback**: User-provided Bearer token via Authorization header

### ChatGPT Authentication

**Method**: Profile-based (session cookies in browser profile)

**Flow**:
```
1. Manual login to ChatGPT in browser
   ↓
2. Copy profile directory
   ↓
3. Puppeteer launches with userDataDir
   ↓
4. Profile contains session cookies
   ↓
5. Authenticated session persists
```

### API Client Authentication

**Current**: No authentication
**Recommended**: API key middleware

```javascript
// Planned implementation
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

---

## Database Design

### Supabase PostgreSQL Schema

**Table**: `product_design`

```sql
CREATE TABLE product_design (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),

  -- Design data
  prompt TEXT,
  original_image_url TEXT,
  generated_designs_url JSONB, -- Array of URLs from Midjourney
  remixed_designs_url JSONB,   -- Array of URLs from Ideogram

  -- Job tracking
  job_id TEXT UNIQUE,
  job_status TEXT CHECK (job_status IN ('pending', 'processing', 'completed', 'failed', 'timeout')),
  job_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_id ON product_design(job_id);
CREATE INDEX idx_job_status ON product_design(job_status);
CREATE INDEX idx_user_id ON product_design(user_id);
```

**JSONB Arrays** (generated_designs_url, remixed_designs_url):
```json
[
  "https://xxx.supabase.co/storage/v1/object/public/product-designs/...",
  "https://xxx.supabase.co/storage/v1/object/public/product-designs/...",
  "https://xxx.supabase.co/storage/v1/object/public/product-designs/..."
]
```

### Storage Buckets

**Midjourney Bucket**: `product-designs`
```
product-designs/
  product_design/{idea_id}/
    generated_{timestamp}_0.png
    generated_{timestamp}_1.png
    generated_{timestamp}_2.png
    generated_{timestamp}_3.png
```

**Ideogram Bucket**: `product-ideas`
```
product-ideas/
  product_design/{idea_id}/
    remixed_{timestamp}_0.png
```

**Bucket Configuration**:
- Public read access
- No size limits (default)
- No expiration policy
- Auto-generated public URLs

---

## External Service Integrations

### Midjourney Integration

**Platform**: midjourney.com
**Method**: Browser automation via Puppeteer
**Authentication**: Cookie-based

**API Endpoints** (Internal browser):
```
POST /api/imagine
POST /api/describe
POST /api/blend
POST /api/video
```

**CDN Pattern** (Image retrieval):
```
https://cdn.midjourney.com/{userId}/{jobId}/grid_{index}.png
https://cdn.midjourney.com/{userId}/{jobId}/{timestamp}_grid_{index}.png
```

**Rate Limits**:
- Unknown (platform-dependent)
- Mitigated by "relaxed" mode setting

### Ideogram Integration

**Platform**: ideogram.ai
**Method**: Browser automation + API calls via page.evaluate()
**Authentication**: Bearer token

**API Endpoints**:
```
POST /api/images/remix
POST /api/upscale
POST /api/edit/inpaint
POST /api/edit/background-removal
GET  /api/requests/{request_id}
GET  /api/images/{image_id}
```

**Token Source**: https://ideogram.cryptovn.news/
**Response Format**:
```json
{
  "access_token": "ey...",
  "expires_in": 300,
  "token_type": "Bearer"
}
```

### ChatGPT Integration

**Platform**: chatgpt.com
**Custom GPT**: g-682b4c8d88848191accff36501109e7e-wowz-ai-assistant-remix-design
**Method**: Browser automation
**Authentication**: Profile-based session

**Default URL**:
```
https://chatgpt.com/g/g-682b4c8d88848191accff36501109e7e-wowz-ai-assistant-remix-design
```

### Supabase Integration

**Services Used**:
1. PostgreSQL Database
2. Storage (Object Storage)

**Client Configuration**:
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
```

**Operations**:
- Database: Insert, select, update job records
- Storage: Upload images, get public URLs

---

## Deployment Architecture

### Current Deployment (Per Service)

**Midjourney**:
```
Linux Server
  ├── PM2 Process Manager
  │   └── Node.js (Port 3002)
  │       └── Chromium Browser Instance
  ├── Logs (/logs/)
  └── Browser Profile (/midjourney-profile/)
```

**Ideogram**:
```
Linux Server
  └── Node.js (Port 3000)
      └── Chromium Browser Instance
```

**ChatGPT**:
```
Linux Server
  └── Node.js (Port TBD)
      └── Chromium Browser Instance
          └── Profile (/gpt-profile/)
```

### Recommended Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Load Balancer / Nginx                  │
│                  (SSL Termination, Routing)              │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
    ┌───▼───┐   ┌───▼───┐   ┌───▼───┐
    │MJ Svc │   │ID Svc │   │GPT Svc│
    │:3002  │   │:3000  │   │:TBD   │
    └───────┘   └───────┘   └───────┘
        │           │           │
        └───────────┼───────────┘
                    │
            ┌───────▼────────┐
            │    Supabase    │
            │ (External SaaS)│
            └────────────────┘
```

### Infrastructure Requirements

**Per Service**:
- CPU: 1 core minimum
- RAM: 512MB minimum (1GB recommended)
- Disk: 2GB (1GB for browser, 1GB for profiles/logs)
- Network: Outbound HTTPS access

**Total (3 Services)**:
- CPU: 3 cores
- RAM: 3GB
- Disk: 6GB
- OS: Linux (Ubuntu 20.04+ recommended)

### Process Management

**Midjourney** (PM2):
```javascript
// ecosystem.config.js
{
  apps: [{
    name: 'midjourney-api',
    script: 'server.js',
    instances: 1,
    max_memory_restart: '512M',
    cron_restart: '0 */4 * * *',
    autorestart: true,
    env: { NODE_ENV: 'production' }
  }]
}
```

**Commands**:
```bash
pm2 start ecosystem.config.js
pm2 logs midjourney-api
pm2 restart midjourney-api
pm2 stop midjourney-api
```

**Ideogram & ChatGPT**: Manual start (systemd recommended)

```ini
# /etc/systemd/system/ideogram-api.service
[Unit]
Description=Ideogram API Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wowz-cloud-api/ideogram
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

---

## Scalability Considerations

### Current Limitations

1. **Single Instance per Service**:
   - Puppeteer profile lock prevents multiple instances
   - Browser profile can't be shared across processes

2. **In-Memory Job Storage**:
   - Midjourney uses Map() for job tracking
   - Lost on restart
   - No persistence

3. **No Load Balancing**:
   - Direct access to each service
   - No distribution mechanism

### Horizontal Scaling Strategy

**Multi-Account Approach**:
```
Load Balancer
  ├── Midjourney Instance 1 (Account A)
  ├── Midjourney Instance 2 (Account B)
  └── Midjourney Instance 3 (Account C)
```

**Job Queue System**:
```
Client Request
  ↓
API Gateway
  ↓
Job Queue (Redis/RabbitMQ)
  ↓
Worker Pool (Multiple Instances)
  ↓
Result Storage (Supabase)
```

### Vertical Scaling

**Resource Limits** (PM2):
- Increase `max_memory_restart` to 1GB or 2GB
- More CPU for faster browser operations
- SSD for faster profile access

### Caching Strategy

**Token Caching** (Ideogram):
- Currently: In-memory with TTL
- Recommended: Redis for shared cache
- Benefits: Multi-instance token sharing

**Image Caching**:
- CDN for generated images
- Cloudflare in front of Supabase storage
- Reduces bandwidth costs

---

## Security Architecture

### Current Security Posture

**Strengths**:
- Supabase handles data encryption
- HTTPS for external API calls
- Environment variables for some credentials

**Weaknesses**:
- ❌ Hardcoded credentials in Ideogram
- ❌ No API authentication
- ❌ Open CORS policy
- ❌ No rate limiting
- ❌ Cookies stored in plain text
- ❌ No request validation

### Recommended Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
│                                                          │
│  1. API Gateway                                          │
│     └── API Key Authentication                           │
│     └── Rate Limiting (per IP/API key)                   │
│     └── Request Validation                               │
│                                                          │
│  2. Application Layer                                    │
│     └── Input Sanitization                               │
│     └── Output Encoding                                  │
│     └── Error Message Sanitization                       │
│                                                          │
│  3. Data Layer                                           │
│     └── Encrypted Environment Variables                  │
│     └── Secrets Management (Vault/AWS Secrets)           │
│     └── Database Row-Level Security                      │
│                                                          │
│  4. Network Layer                                        │
│     └── CORS Restrictions                                │
│     └── HTTPS Only                                       │
│     └── Firewall Rules                                   │
└──────────────────────────────────────────────────────────┘
```

### Security Implementation Checklist

**Phase 1: Immediate**:
- [ ] Move all credentials to .env files
- [ ] Implement API key authentication
- [ ] Add rate limiting
- [ ] Restrict CORS origins
- [ ] Add input validation

**Phase 2: Short-term**:
- [ ] Encrypt sensitive data at rest
- [ ] Implement request signing
- [ ] Add audit logging
- [ ] Security headers (helmet.js)
- [ ] SQL injection prevention

**Phase 3: Long-term**:
- [ ] OAuth 2.0 implementation
- [ ] JWT token management
- [ ] Service-to-service auth
- [ ] Secrets rotation
- [ ] Security scanning (Snyk, Dependabot)

---

## Data Flow Diagrams

### Midjourney Image Generation Flow

```
┌────────┐
│ Client │
└───┬────┘
    │ POST /midjourney/genimage
    │ {prompt, options, idea_id}
    ▼
┌────────────────┐
│ Express Server │
│  - Validate    │
│  - Generate ID │
└───┬────────────┘
    │ Return jobId immediately
    │
    ├─────────────────────┐
    │                     │ (Background)
    ▼                     ▼
┌────────┐         ┌──────────────┐
│ Client │         │ Puppeteer    │
│ Waits  │         │   Client     │
└────────┘         └──────┬───────┘
                          │ imagine()
                          ▼
                   ┌──────────────┐
                   │  Midjourney  │
                   │   Platform   │
                   └──────┬───────┘
                          │ Generate
                          ▼
                   ┌──────────────┐
                   │  CDN Images  │
                   └──────┬───────┘
                          │
    ┌─────────────────────┘
    │ Poll every 15s
    ▼
┌────────────────┐
│ Download Images│
└───┬────────────┘
    │
    ▼
┌────────────────┐
│Upload Supabase │
└───┬────────────┘
    │
    ▼
┌────────────────┐
│ Update DB      │
│ Status: done   │
└────────────────┘
```

### Ideogram Remix Flow

```
┌────────┐
│ Client │
└───┬────┘
    │ POST /api/remix
    │ {imageUrl, imageWeight, style}
    ▼
┌────────────────┐
│ checkToken()   │
│ Middleware     │
└───┬────────────┘
    │ Token valid
    ▼
┌────────────────┐
│ Create Job     │
│ Return jobId   │
└───┬────────────┘
    │
    ├─────────────────────┐
    │                     │ (Background)
    ▼                     ▼
┌────────┐         ┌──────────────┐
│ Client │         │processRemix()│
│Poll Job│         └──────┬───────┘
└────────┘                │
                          ▼
                   ┌──────────────┐
                   │Upload Image  │
                   │to Ideogram   │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │Get AI Caption│
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │Generate      │
                   │ Variations   │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │Poll Results  │
                   │ (15s * 40)   │
                   └──────┬───────┘
                          │ Complete
                          ▼
                   ┌──────────────┐
                   │Download      │
                   │ Images       │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │Upload to     │
                   │ Supabase     │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │Update DB     │
                   │Job: completed│
                   └──────────────┘
```

### N8N Workflow Integration

```
┌──────────────┐
│External App  │
└──────┬───────┘
       │ Webhook POST
       ▼
┌──────────────┐
│ N8N Workflow │
└──────┬───────┘
       │ POST /api/remix
       ▼
┌──────────────┐
│Ideogram API  │
│Returns jobId │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│N8N Poll Loop │
│GET /api/job  │
│:jobId        │
└──────┬───────┘
       │ Every 15s
       │
       ├─► pending    → Continue polling
       ├─► processing → Continue polling
       ├─► completed  → Extract results
       ├─► failed     → Return error
       └─► timeout    → Return timeout

       ▼ (completed)
┌──────────────┐
│Parse Results │
│remixed_      │
│designs_url   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Return to App │
└──────────────┘
```

---

## Future Architecture Enhancements

### Unified API Gateway

```
                    ┌──────────────────┐
                    │   API Gateway    │
                    │  - Auth          │
                    │  - Rate Limit    │
                    │  - Routing       │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
       ┌────▼────┐      ┌────▼────┐     ┌────▼────┐
       │Midjourney│      │Ideogram │     │ ChatGPT │
       │ Service  │      │ Service │     │ Service │
       └──────────┘      └──────────┘     └─────────┘
```

### Event-Driven Architecture

```
Client → API → Event Bus (RabbitMQ/Kafka)
                   │
                   ├─► Job Worker 1
                   ├─► Job Worker 2
                   ├─► Job Worker 3
                   └─► Notification Service
```

### Containerization

```
Docker Compose / Kubernetes
  ├── midjourney-api (replicas: 3)
  ├── ideogram-api (replicas: 3)
  ├── chatgpt-api (replicas: 2)
  ├── redis (caching)
  └── nginx (load balancer)
```

---

**Last Updated**: 2025-11-18
**Review Cycle**: Quarterly
**Owner**: WOWZ Architecture Team
