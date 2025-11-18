# Project Overview & Product Development Requirements (PDR)

## Project Overview

**Midjourney API** - Node.js-based API service enabling programmatic image and video generation via Midjourney platform using browser automation.

### Problem Statement

Midjourney lacks official public API for integration. Users need:
- Automated image generation without manual Discord interaction
- Programmatic control over generation parameters
- Integration with external systems (Supabase, web apps)
- Scalable, production-ready solution

### Goals & Objectives

**Primary Goals:**
1. Provide RESTful API for Midjourney image/video generation
2. Automate authentication and session management
3. Enable asynchronous job processing with polling
4. Integrate with cloud storage (Supabase) for generated assets

**Secondary Goals:**
1. Maintain high availability with auto-restart/monitoring
2. Memory-efficient operation for VPS deployment
3. Flexible parameter control (chaos, aspect ratio, stylize, etc.)
4. Support both GET/POST endpoints for different use cases

### Target Users & Use Cases

**Primary Users:**
- SaaS developers integrating AI image generation
- Product designers automating design workflows
- Content creators batch-generating assets

**Use Cases:**
1. **Product Design Generation**: Upload reference image → generate variations → store in Supabase
2. **Batch Processing**: Queue multiple generation requests with job tracking
3. **Video Generation**: Convert static images to animated videos
4. **Integration**: Embed into external applications via REST API

### Key Features & Requirements

#### Functional Requirements

**FR-001: Image Generation**
- Accept text prompts and optional reference images
- Support Midjourney parameters: chaos, ar, stylize, weird, version, quality, niji, tile, stop
- Return job ID for async tracking
- Default to 4-image batches

**FR-002: Video Generation**
- Generate videos from image URLs
- Support video-specific params: motion, ar, chaos
- Upload source image to Midjourney CDN
- Return job status and video URL

**FR-003: Authentication Management**
- Persistent browser session via Puppeteer
- Cookie-based authentication from stored cookies.json
- Auto-detect login status on /imagine page
- Graceful session refresh on expiration

**FR-004: Job Polling & Storage**
- Background polling for completed images (15s intervals, 24 attempts = ~6min)
- Download from cdn.midjourney.com when ready
- Upload to Supabase storage bucket
- Update product_design table with generated_designs_url

**FR-005: API Endpoints**
- `POST /midjourney/init` - Initialize Puppeteer client
- `POST /midjourney/genimage` - Generate images (with idea_id, user_id)
- `GET /midjourney/genimage` - Generate images (query params)
- `POST /midjourney/genvideo` - Generate videos
- `GET /midjourney/genvideo` - Generate videos (query params)
- `GET /midjourney/status` - Check auth status
- `GET /health` - Health metrics
- `GET /midjourney/proxy-image` - Proxy CDN images through browser

#### Non-Functional Requirements

**NFR-001: Reliability**
- Retry mechanism: 3 attempts with exponential backoff (2s, 4s, 6s)
- Auto-restart on crash via PM2
- Health monitoring with monitor.js
- Graceful shutdown handling

**NFR-002: Performance**
- Headless browser for efficiency
- Memory limit: 512MB (PM2 auto-restart)
- Cron restart every 4 hours to prevent memory leaks
- Garbage collection intervals optimized

**NFR-003: Scalability**
- Single instance design (Puppeteer limitation)
- Concurrent job tracking via Map
- Async polling prevents blocking
- Express.js for request handling

**NFR-004: Security**
- Hardcoded Supabase credentials (⚠️ SECURITY RISK - should use env vars)
- CORS enabled
- CSRF protection (x-csrf-protection header)
- CDN proxy validates midjourney.com only

**NFR-005: Maintainability**
- Structured logging (console + file)
- PM2 logging: combined.log, out.log, error.log
- Monitor.log for health tracking
- Error state tracking in Supabase (job_status: processing/completed/failed/timeout)

### Success Metrics

**Primary Metrics:**
1. API Uptime: Target >99% (monitored via /health)
2. Success Rate: Track successfulRequests / totalRequests
3. Job Completion Rate: Percentage of jobs reaching 'completed' status
4. Response Time: <30s for API call, <6min for job completion

**Secondary Metrics:**
1. Memory Stability: No OOM errors between 4-hour cron restarts
2. Session Persistence: Auth token validity across restarts
3. CDN Download Success: Successful retrieval from cdn.midjourney.com
4. Supabase Upload Rate: Successful storage uploads

### Technical Constraints

**Hard Constraints:**
1. Requires valid Midjourney account with active subscription
2. Session cookies expire - manual re-authentication needed
3. Single browser instance - no parallel session support
4. Midjourney API rate limits (not documented, empirically tested)

**Soft Constraints:**
1. Node.js >=14 required for Puppeteer
2. PM2 for production deployment
3. Supabase project with storage bucket configured
4. VPS with 512MB+ RAM recommended

### Dependencies

**Runtime:**
- Node.js (Express, Axios)
- Puppeteer + puppeteer-extra-plugin-stealth
- @supabase/supabase-js
- PM2 (process manager)

**External Services:**
- Midjourney (www.midjourney.com/api/submit-jobs)
- Midjourney CDN (cdn.midjourney.com)
- Supabase (storage + database)

### Architecture Decisions

**AD-001: Browser Automation over API Scraping**
- Decision: Use Puppeteer to execute fetch() in browser context
- Rationale: Avoids CORS, inherits auth tokens, mimics real user behavior
- Tradeoff: Higher memory overhead vs HTTP client approach

**AD-002: Polling vs Webhooks**
- Decision: Background polling with 15s intervals
- Rationale: Midjourney provides no webhook mechanism
- Tradeoff: Inefficient but only option available

**AD-003: Supabase Service Role Key in Code**
- Decision: Hardcode SUPABASE_SERVICE_ROLE_KEY in server.js
- Rationale: ⚠️ Quick development (BAD PRACTICE)
- Tradeoff: Security risk - should migrate to .env

**AD-004: Single Instance Design**
- Decision: No clustering/load balancing
- Rationale: Puppeteer profile locks prevent multi-instance
- Tradeoff: Vertical scaling only

### Version History

- **v1.0.0** (Initial): Core image/video generation, Supabase integration, PM2 deployment

### Open Questions

1. How to handle Midjourney rate limits programmatically?
2. Cookie refresh strategy - automate login or manual update?
3. Supabase credentials - migrate to env vars or secrets manager?
4. Multi-account support for horizontal scaling?
5. Job priority queue implementation for paid vs free users?
6. Monitoring/alerting integration (Datadog, Sentry)?
7. API authentication - currently open to public, add API keys?
