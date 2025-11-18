# Codebase Summary

## High-Level Overview

Node.js Express API wrapping Midjourney's web interface via Puppeteer browser automation. Provides REST endpoints for image/video generation with async job tracking and Supabase storage integration.

## Directory Structure

```
midjourney-api/
├── .claude/                    # Claude Code agent configurations
│   ├── workflows/              # Development workflows (primary, docs, orchestration)
│   ├── hooks/                  # Git/command hooks
│   └── settings.json           # Claude settings
├── .opencode/                  # Alternative agent configs (deprecated)
├── midjourney-profile/         # Puppeteer browser persistent session
│   ├── CertificateRevocation/  # Chrome browser data
│   └── Subresource Filter/     # Chrome extensions
├── logs/                       # PM2 and monitor logs
│   ├── combined.log            # All PM2 output
│   ├── out.log                 # stdout
│   ├── error.log               # stderr
│   └── monitor.log             # Health check logs
├── docs/                       # Documentation (you are here)
├── server.js                   # Main Express server (784 lines)
├── puppeteer-client.js         # Midjourney API client (1311 lines)
├── config.js                   # API config + cookies template
├── monitor.js                  # Health monitoring service
├── ecosystem.config.js         # PM2 process config
├── start-production.sh         # Production startup script
├── cookies.json                # Persistent auth cookies
├── package.json                # Dependencies
└── CLAUDE.md                   # Agent instructions
```

## Key Modules & Responsibilities

### 1. server.js - API Server (Main Entry)
**Purpose**: Express REST API + job orchestration

**Key Responsibilities**:
- Define 8 REST endpoints (health, init, genimage, genvideo, status, proxy)
- Manage Puppeteer client lifecycle (init, restart)
- Background job polling Map (jobId → { ideaId, userId, found, attempts, timer })
- Supabase integration (upload, DB update)
- Health metrics tracking (uptime, requests, success rate)
- Graceful shutdown handling

**Important Functions**:
- `startPollingJob(jobId, ideaId, userId, batchSize)` - Poll cdn.midjourney.com every 15s
- `uploadToSupabase(ideaId, idx, buffer, contentType)` - Upload image to storage
- `appendGeneratedDesignUrl(ideaId, imageUrl)` - Update product_design table
- `buildFullPrompt(prompt, options)` - Construct Midjourney command string
- `initializeClient()` - Initialize Puppeteer browser

**State Management**:
```javascript
let client = null;  // PuppeteerMidjourneyAPI instance
let isInitializing = false;  // Prevent concurrent init
let healthStatus = {  // Global health metrics
  status: 'stopped|running|error',
  uptime, totalRequests, successfulRequests, failedRequests,
  lastRequest, lastError
};
const jobs = new Map();  // Active polling jobs
```

### 2. puppeteer-client.js - Midjourney Client
**Purpose**: Browser automation wrapper for Midjourney API

**Class Structure**:
```javascript
class PuppeteerMidjourneyAPI {
  constructor() {
    this.apiUrl, this.channelId, this.browser, this.page,
    this.cookies, this.isAuthenticated
  }

  // Core Methods
  async initBrowser()                    // Launch headless Chrome
  async checkAuthStatus()                // Verify login state
  async generateImageViaAPI(prompt, opts) // Call /api/submit-jobs
  async generateVideoFromImage(url, opts) // Generate videos
  async createPrompt(url_image, desc, opts) // Build prompt string
  async uploadImageToMidjourney(url)     // Upload to CDN
  async downloadImageViaBrowser(url)     // Proxy download

  // Legacy/Alternative Methods
  async generateImageRealistic(prompt)   // With request interception
  async generateImageFromConsole(prompt) // Execute in browser console
  async generateImageDirectly(prompt)    // Type into UI
}
```

**Key Implementation Details**:
- Uses `puppeteer-extra-plugin-stealth` to avoid bot detection
- Persistent session via `userDataDir: midjourney-profile/`
- Cookie import from `cookies.json` on init
- API calls via `page.evaluate(async () => fetch(...))` to inherit auth
- Retry logic: 3 attempts with 2s backoff
- Request/response interception for debugging

### 3. config.js - Configuration
**Purpose**: Static API configuration template

**Contents**:
- `apiUrl`: https://www.midjourney.com/api/submit-jobs
- `headers`: Full browser headers (User-Agent, CSRF, etc.)
- `cookies`: Template for auth tokens (__Host-Midjourney.AuthUserTokenV3_*)
- `channelId`: User's singleplayer channel ID

**⚠️ Note**: Contains hardcoded expired tokens - real tokens loaded from cookies.json

### 4. monitor.js - Health Monitor
**Purpose**: Standalone process for API health checks

**Monitoring Strategy**:
- Health check every 60s via GET /health
- Failure threshold: 3 consecutive failures → restart
- Restart cooldown: 5min to prevent restart loops
- Memory check: every 30min, restart if uptime >6hrs
- PM2 command: `pm2 restart midjourney-api`

**Logging**: Appends to ./logs/monitor.log with timestamps

### 5. ecosystem.config.js - PM2 Config
**Purpose**: Production process management

**Key Settings**:
```javascript
{
  name: 'midjourney-api',
  script: 'server.js',
  instances: 1,                          // No clustering (Puppeteer limit)
  max_memory_restart: '512M',            // Auto-restart on OOM
  cron_restart: '0 */4 * * *',          // Every 4 hours
  node_args: '--max-old-space-size=512 --gc-interval=100',
  min_uptime: '10s',                     // Prevent crash loops
  max_restarts: 10,
  restart_delay: 4000
}
```

## Entry Points & Main Flows

### Flow 1: Image Generation
```
1. POST /midjourney/genimage { prompt, url_image, options, idea_id, user_id }
2. Update Supabase: job_status='processing', job_created_at=now
3. client.createPrompt(url_image, prompt, options)
   → Upload image to Midjourney CDN if url_image provided
   → Append --chaos, --ar, --stylize, --v, etc.
4. client.generateImageViaAPI(fullPrompt, options)
   → page.evaluate(() => fetch('/api/submit-jobs', { t: 'imagine', prompt }))
   → Extract jobId from response
5. Update Supabase: job_id=jobId
6. startPollingJob(jobId, ideaId, userId, batchSize)
   → Poll https://cdn.midjourney.com/{jobId}/0_{idx}.png every 15s
   → On success: uploadToSupabase(), appendGeneratedDesignUrl()
   → Update job_status='completed|timeout|failed'
7. Respond to client immediately (don't wait for images)
```

### Flow 2: Video Generation
```
1. POST /midjourney/genvideo { image_url, text_prompt, options }
2. client.uploadImageToMidjourney(image_url) → shortUrl
3. Build video prompt: "{text_prompt} {shortUrl} --motion high --video 1"
4. page.evaluate(() => fetch('/api/submit-jobs', {
     t: 'video',
     videoType: 'vid_1.1_i2v_480',
     newPrompt: videoPrompt
   }))
5. Return job data immediately
```

### Flow 3: Browser Initialization
```
1. Launch Puppeteer with --headless, --no-sandbox, userDataDir
2. Import cookies from cookies.json
3. Navigate to www.midjourney.com/imagine
4. Detect login state (check for "Create" button, prompt input)
5. Extract channelId from localStorage/sessionStorage
6. Set isAuthenticated=true
```

## Dependencies & External Integrations

### NPM Dependencies
```json
{
  "express": "^5.1.0",           // HTTP server
  "puppeteer": "^24.10.2",       // Browser automation
  "puppeteer-extra": "^3.3.6",   // Plugins
  "puppeteer-extra-plugin-stealth": "^2.11.2",  // Bot detection bypass
  "@supabase/supabase-js": "^2.75.0",  // Storage + DB
  "axios": "^1.6.0",             // HTTP client (for monitor)
  "cors": "^2.8.5",              // CORS middleware
  "dotenv": "^16.3.1"            // Env vars (not used)
}
```

### External Services
1. **Midjourney API** (www.midjourney.com)
   - `/api/submit-jobs` - Image/video generation
   - `/api/storage-upload-file` - Upload reference images
   - CDN: cdn.midjourney.com/{jobId}/0_{idx}.png

2. **Supabase** (vilyavgrknohxhfvvayc.supabase.co)
   - Storage bucket: `product-designs`
   - Table: `product_design` (columns: id, generated_designs_url, job_status, job_id, job_created_at, job_updated_at, error_message)

## Data Models & Schemas

### Supabase: product_design Table
```sql
CREATE TABLE product_design (
  id UUID PRIMARY KEY,
  generated_designs_url JSONB,        -- Array of image URLs
  job_status TEXT,                     -- 'processing'|'completed'|'failed'|'timeout'
  job_id TEXT,                         -- Midjourney job ID
  job_created_at TIMESTAMPTZ,
  job_updated_at TIMESTAMPTZ,
  error_message TEXT
);
```

### API Request/Response Models

**POST /midjourney/genimage Request**:
```json
{
  "prompt": "A cat in a garden",
  "url_image": "https://example.com/ref.png",  // Optional
  "idea_id": "uuid",
  "user_id": "uuid",                            // Optional
  "options": {
    "chaos": 5,                                 // 0-100
    "ar": "4:3",                                // Aspect ratio
    "stylize": 150,                             // 0-1000
    "weird": 200,                               // 0-3000
    "version": 7,                               // Midjourney version
    "quality": "normal",                        // "normal"|float
    "stop": null,                               // 10-100
    "tile": false,
    "niji": false,
    "mode": "relaxed",                          // "fast"|"relaxed"
    "private": false
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Yêu cầu tạo ảnh đã được gửi thành công",
  "data": { /* Midjourney API response */ },
  "jobId": "1234-5678-abcd-efgh",
  "batchSize": 4,
  "status": "pending",
  "timestamp": "2025-11-17T..."
}
```

### Midjourney API Payloads

**Image Generation (/api/submit-jobs)**:
```json
{
  "f": {
    "mode": "relaxed",
    "private": false
  },
  "channelId": "singleplayer_...",
  "roomId": null,
  "metadata": {
    "isMobile": null,
    "imagePrompts": 1,
    "imageReferences": 0,
    "characterReferences": 0,
    "depthReferences": 0,
    "lightboxOpen": null
  },
  "t": "imagine",
  "prompt": "A cat --chaos 5 --ar 4:3 --v 7"
}
```

**Video Generation**:
```json
{
  "f": { "mode": "fast", "private": false },
  "channelId": "singleplayer_...",
  "t": "video",
  "videoType": "vid_1.1_i2v_480",
  "newPrompt": "cinematic https://mj.sh/xyz --motion high --video 1",
  "parentJob": null,
  "animateMode": "manual"
}
```

## Security Considerations

### Current Issues
1. **Hardcoded Supabase Service Role Key** (lines 27-28 in server.js)
   - ⚠️ Full admin access - should use env vars + secrets manager

2. **No API Authentication**
   - All endpoints public - should add API keys or OAuth

3. **CORS Open**
   - `app.use(cors())` allows all origins

4. **Cookie Exposure**
   - cookies.json contains auth tokens - should gitignore

5. **CDN Proxy Vulnerability**
   - /midjourney/proxy-image validates domain but no rate limiting

### Recommendations
- Migrate credentials to .env with dotenv
- Add API key middleware
- Restrict CORS to allowed origins
- Implement rate limiting (express-rate-limit)
- Add request signing/HMAC for webhook callbacks
- Use PM2 keymetrics for security monitoring

## Performance Characteristics

### Memory Profile
- Baseline: ~150MB (Puppeteer browser)
- Peak: ~450MB (during image generation)
- PM2 restart threshold: 512MB
- GC tuning: `--max-old-space-size=512 --gc-interval=100`

### Latency
- API response: <1s (async, returns immediately)
- Image generation: 30s-2min (Midjourney processing)
- Polling completion: 15s-6min (background job)
- CDN download: 2-5s per image

### Concurrency
- Single Puppeteer instance (browser lock)
- Async job polling (non-blocking)
- Express handles concurrent requests (default pool)

## Open Questions / Technical Debt

1. **Why hardcode Supabase credentials?** → Should migrate to .env
2. **Cookie refresh automation?** → Currently requires manual update
3. **Multi-account support?** → Horizontal scaling blocked by Puppeteer profile lock
4. **Rate limit handling?** → No retry queue for 429 errors
5. **Job cleanup?** → Completed jobs never removed from Map (memory leak)
6. **Error handling inconsistency** → Some errors throw, others return { success: false }
7. **TypeScript migration?** → Would improve type safety
8. **Test coverage?** → No unit/integration tests
