# Codebase Summary

**Last Updated**: 2025-11-18
**Repository**: wowz-cloud-api
**Total Services**: 4 (3 active, 1 placeholder)

## Directory Structure

```
/root/wowz-cloud-api/
├── .claude/                      # Claude Code configuration and workflows
│   ├── .env.example             # Environment variable template
│   ├── hooks/                   # Pre/post execution hooks
│   └── workflows/               # Development workflow definitions
├── chatgpt/                     # ChatGPT service (port TBD)
│   ├── gpt-profile/            # Persistent browser profile
│   ├── node_modules/           # Dependencies
│   ├── gptapi.js               # Main API implementation
│   ├── login-gptapi.js         # Authentication handler
│   ├── test.js                 # Test utilities
│   └── package.json            # NPM dependencies
├── clipdrop/                    # Clipdrop service (not implemented)
│   └── clipdrop-profile/       # Browser profile directory
├── ideogram/                    # Ideogram service (port 3000)
│   ├── .git/                   # Git repository
│   ├── .claude/                # Service-specific Claude config
│   ├── node_modules/           # Dependencies
│   ├── server.js               # Main server file
│   ├── run.js                  # Execution script
│   ├── webhook-server.js       # GitHub webhook handler
│   ├── package.json            # NPM dependencies
│   ├── README.md               # Service documentation
│   ├── API-REMIX-ENDPOINT.md   # Unified endpoint docs
│   ├── N8N-SIMPLE-WORKFLOW.json # N8N integration template
│   └── INTEGRATION-SUMMARY.md  # Integration guide
├── midjourney/                  # Midjourney service (port 3002)
│   ├── .git/                   # Git repository
│   ├── .claude/                # Service-specific Claude config
│   ├── docs/                   # Comprehensive documentation
│   │   ├── project-overview-pdr.md
│   │   ├── codebase-summary.md
│   │   ├── code-standards.md
│   │   └── system-architecture.md
│   ├── logs/                   # Log files
│   ├── midjourney-profile/     # Browser profile
│   ├── node_modules/           # Dependencies
│   ├── server.js               # Main Express server
│   ├── puppeteer-client.js     # Midjourney automation wrapper
│   ├── monitor.js              # Health monitoring
│   ├── config.js               # Configuration
│   ├── cookies.json            # Authentication cookies
│   ├── ecosystem.config.js     # PM2 configuration
│   ├── start-production.sh     # Production startup script
│   ├── package.json            # NPM dependencies
│   └── README.md               # Service documentation
├── plans/                       # Development planning
│   └── templates/              # Plan templates
├── docs/                        # Root-level documentation (this folder)
│   ├── project-overview-pdr.md # Project overview and requirements
│   ├── codebase-summary.md     # This file
│   ├── code-standards.md       # Coding standards
│   └── system-architecture.md  # Architecture documentation
├── .gitignore                   # Git ignore rules
├── .repomixignore              # Repomix ignore patterns
├── CLAUDE.md                    # Claude Code instructions
└── repomix-output.xml          # Codebase compaction file
```

## Service Overviews

### 1. Midjourney Service (`/root/wowz-cloud-api/midjourney/`)

**Status**: Production-ready
**Port**: 3002
**Entry Point**: server.js
**Process Manager**: PM2

#### Key Modules

**server.js** (825 lines)
- Express.js REST API server
- Supabase admin client initialization
- Background job polling system
- Image upload and database update functions
- Health status tracking
- CORS and middleware configuration

**puppeteer-client.js** (~1200 lines)
- PuppeteerMidjourneyAPI class wrapper
- Browser automation for Midjourney platform
- Cookie-based authentication
- Image generation methods (imagine, describe, blend)
- Video generation support
- Session management
- Error handling and retries

**monitor.js**
- Health check automation
- Auto-restart on failures
- Memory monitoring
- Request tracking

**ecosystem.config.js**
- PM2 process configuration
- Memory limits (512MB)
- Cron-based restarts (every 4 hours)
- Log file paths
- Environment variables

#### Core Responsibilities

1. **Authentication**: Cookie management for Midjourney sessions
2. **Image Generation**: Text-to-image with customizable parameters
3. **Video Generation**: Image-to-video conversion
4. **Job Polling**: Background polling for completed jobs
5. **Storage**: Auto-upload to Supabase storage
6. **Database**: Job tracking in `product_design` table

#### Data Flow

```
Client Request → Express Endpoint → Puppeteer Client → Midjourney API
     ↓                                                        ↓
Job Created                                          Browser Automation
     ↓                                                        ↓
Background Polling ← CDN Download ← Image Generated
     ↓
Supabase Upload → Database Update → Job Completed
```

#### Dependencies

```json
{
  "express": "REST API server",
  "puppeteer": "Browser automation",
  "puppeteer-extra": "Plugin system",
  "puppeteer-extra-plugin-stealth": "Anti-detection",
  "@supabase/supabase-js": "Database and storage",
  "axios": "HTTP client",
  "cors": "CORS middleware",
  "dotenv": "Environment variables"
}
```

### 2. Ideogram Service (`/root/wowz-cloud-api/ideogram/`)

**Status**: Production-ready
**Port**: 3000
**Entry Point**: server.js
**Process Manager**: Not configured (manual start)

#### Key Modules

**server.js** (1100+ lines)
- Express.js REST API
- Token management with auto-refresh
- Multiple API endpoints for different operations
- Job management system
- Supabase integration

**run.js**
- Service execution script
- Initialization logic

**webhook-server.js**
- GitHub webhook handler
- Auto-deployment capabilities

#### API Endpoints

1. **POST /api/upload** - Upload image to Ideogram
2. **POST /api/caption** - Get AI caption for image
3. **POST /api/generate-variations** - Generate image variations (async)
4. **POST /api/gencustom** - Custom generation with full control
5. **POST /api/upscale** - Upscale images
6. **POST /api/removebackground** - Background removal
7. **POST /api/genimageprompt** - Text-to-image generation
8. **POST /api/remix** - Unified endpoint for N8N
9. **GET /api/job/:jobId** - Check job status
10. **GET /api/getrequestid** - Poll for request metadata
11. **GET /api/download/response/:response_id/image** - Download image
12. **POST /api/d/images** - Batch download images

#### Core Responsibilities

1. **Token Management**: Auto-refresh from external service
2. **Image Operations**: Upload, caption, variations, upscaling
3. **Job Tracking**: Async processing with status updates
4. **N8N Integration**: Simplified `/api/remix` endpoint
5. **Storage**: Upload results to Supabase

#### Data Flow

```
Client → /api/remix → Upload Image → Get Caption
                           ↓
                   Generate Variations
                           ↓
              Poll Results (15s intervals)
                           ↓
         Download Images → Upload to Supabase
                           ↓
                  Update Job Status → Complete
```

#### Dependencies

```json
{
  "express": "REST API server",
  "puppeteer": "Browser automation",
  "puppeteer-extra-plugin-stealth": "Stealth mode",
  "axios": "HTTP client",
  "@supabase/supabase-js": "Database and storage",
  "cors": "CORS middleware"
}
```

### 3. ChatGPT Service (`/root/wowz-cloud-api/chatgpt/`)

**Status**: In development
**Port**: Not configured
**Entry Point**: gptapi.js

#### Key Modules

**gptapi.js** (500+ lines)
- Express.js server
- Puppeteer browser management
- Custom GPT integration
- Image download and base64 conversion
- Persistent browser profile

**login-gptapi.js**
- Authentication handler
- Session management

**test.js**
- Testing utilities

#### Core Responsibilities

1. **Browser Management**: Shared browser instance
2. **GPT Integration**: WOWZ AI Assistant Remix Design GPT
3. **Image Processing**: URL to base64 conversion
4. **Profile Management**: Persistent user data directory

#### Key Features

- Auto-relaunch on browser disconnect
- Stealth mode for automation
- Profile-based authentication
- Single-process browser for efficiency

#### Dependencies

```json
{
  "express": "REST API server",
  "puppeteer": "Browser automation",
  "puppeteer-extra-plugin-stealth": "Stealth mode",
  "axios": "HTTP client",
  "body-parser": "Request parsing"
}
```

### 4. Clipdrop Service (`/root/wowz-cloud-api/clipdrop/`)

**Status**: Not implemented
**Port**: Not defined
**Entry Point**: None

**Current State**: Only browser profile directory exists. No implementation files.

## External Integrations

### Supabase

**Used By**: Midjourney, Ideogram

**Services Used**:
1. **PostgreSQL Database**: Job tracking table `product_design`
2. **Storage Bucket**: `product-designs` (Midjourney), `product-ideas` (Ideogram)

**Schema (product_design table)**:
```sql
- id (uuid, primary key)
- job_id (text)
- job_status (text) - pending|processing|completed|failed|timeout
- job_created_at (timestamp)
- job_updated_at (timestamp)
- generated_designs_url (jsonb) - Array of image URLs
- remixed_designs_url (jsonb) - Array of remixed URLs
- error_message (text)
```

### AI Platforms

1. **Midjourney** (midjourney.com)
   - Authentication: Cookie-based
   - Method: Browser automation

2. **Ideogram** (ideogram.ai)
   - Authentication: Token from cryptovn.news
   - Method: Browser automation with API calls

3. **ChatGPT** (chatgpt.com)
   - Authentication: Profile-based
   - GPT: g-682b4c8d88848191accff36501109e7e-wowz-ai-assistant-remix-design

## File Organization Patterns

### Configuration Files

**Environment Variables**:
- `.env` files in service directories
- Contains Supabase credentials, ports, API keys
- Excluded from git via `.gitignore`

**Browser Profiles**:
- `{service}-profile/` directories
- Persistent Chrome/Chromium user data
- Enables session persistence

**PM2 Configuration** (Midjourney only):
- `ecosystem.config.js`
- Process management, memory limits, cron restarts

### Code Structure

**Service Pattern**:
```
service/
├── server.js          # Main Express server
├── {service}-api.js   # Platform-specific automation (optional)
├── config.js          # Configuration (optional)
├── package.json       # Dependencies
├── README.md          # Documentation
└── {service}-profile/ # Browser profile
```

**API Endpoint Pattern**:
1. Request validation
2. Authentication check (token/cookie)
3. Browser page creation
4. API call via page.evaluate()
5. Response handling
6. Background job creation (for async operations)

**Job Processing Pattern**:
1. Generate unique job ID
2. Create database record with 'pending' status
3. Return job ID immediately
4. Background function processes job
5. Poll for completion (15s intervals)
6. Update status on completion/failure
7. Upload results to storage

## Key Modules & Responsibilities

### Authentication Modules

**Midjourney** (`cookies.json`):
- Manual cookie extraction from browser
- Stored in JSON format
- Two cookies: `__Host-Midjourney.AuthUserTokenV3_r` and `_i`
- Loaded on server start

**Ideogram** (`checkToken` middleware):
- Fetches token from `https://ideogram.cryptovn.news/`
- Caches token with TTL
- Auto-refresh before expiry (5s buffer)
- Fallback to user-provided Bearer token

**ChatGPT** (profile-based):
- Uses persistent browser profile
- No explicit token management
- Session maintained in profile

### Browser Automation Modules

**PuppeteerMidjourneyAPI** (midjourney/puppeteer-client.js):
- Class-based wrapper for Midjourney operations
- Methods: imagine(), describe(), blend(), video()
- Cookie injection on page load
- Error handling and retries

**Ideogram Browser** (ideogram/server.js):
- Shared browser instance
- Stealth plugin enabled
- Token injection in request headers
- Page.evaluate() for API calls

**ChatGPT Browser** (chatgpt/gptapi.js):
- Persistent profile directory
- Auto-relaunch on disconnect
- Event handlers for connection status

### Storage Modules

**Supabase Upload** (common pattern):
```javascript
async function uploadToSupabase(ideaId, idx, buffer, contentType) {
  const filePath = `product_design/${ideaId}/generated_${timestamp}_${idx}.png`;
  await supabase.storage.from(bucket).upload(filePath, buffer);
  return publicUrl;
}
```

**Database Update** (common pattern):
```javascript
async function updateJobStatus(jobId, status, results) {
  await supabase
    .from('product_design')
    .update({ job_status: status, remixed_designs_url: results })
    .eq('job_id', jobId);
}
```

### Job Polling Modules

**Midjourney Polling** (server.js):
- Map-based job storage
- 15-second intervals
- Max 4 images per batch
- Set-based duplicate tracking

**Ideogram Polling** (server.js):
- Background function per job
- 15-second intervals
- 10-minute timeout (40 attempts)
- Result extraction from API response

## Data Flow Between Components

### Image Generation Flow (Midjourney)

```
1. POST /midjourney/genimage
   ↓ (with idea_id)
2. Validate prompt and parameters
   ↓
3. Initialize Puppeteer client
   ↓
4. Generate image via client.imagine()
   ↓
5. Create job ID and return immediately
   ↓
6. Background: startPollingJob()
   ↓ (every 15s)
7. Search CDN for generated images
   ↓
8. Download images via axios
   ↓
9. Upload to Supabase storage
   ↓
10. Update product_design table
   ↓
11. Mark job as completed
```

### Image Remix Flow (Ideogram)

```
1. POST /api/remix
   ↓
2. checkToken middleware
   ↓
3. Generate job ID
   ↓
4. Create DB record (pending)
   ↓
5. Return job ID immediately
   ↓
6. Background: processRemix()
   ↓
7. Upload image to Ideogram
   ↓
8. Get AI caption
   ↓
9. Generate variations
   ↓
10. Poll for results (15s intervals)
   ↓
11. Download result images
   ↓
12. Upload to Supabase
   ↓
13. Update DB (completed)
```

### N8N Workflow Integration

```
External App → N8N Webhook
                  ↓
            POST /api/remix (Ideogram)
                  ↓
            Job ID returned
                  ↓
         N8N polls GET /api/job/:jobId
                  ↓ (every 15s)
         Status: pending → processing → completed
                  ↓
         N8N retrieves result URLs
                  ↓
         Return to External App
```

## Configuration Management

### Environment Variables

**Midjourney** (.env):
```env
PORT=3002
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_BUCKET=product-designs
NODE_ENV=production
```

**Ideogram** (hardcoded in server.js):
```javascript
const supabaseUrl = 'https://vilyavgrknohxhfvvayc.supabase.co';
const supabaseKey = "eyJhbGci..."; // Service role key
```
⚠️ **Security Issue**: Credentials should be in .env file

### Browser Configuration

**Chrome Executable Path**:
- All services: `/usr/bin/chromium-browser`
- Platform: Linux

**Launch Arguments** (common):
```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled'
]
```

**Profile Directories**:
- Midjourney: `./midjourney-profile`
- Ideogram: Not explicitly set (uses default)
- ChatGPT: `./gpt-profile`
- Clipdrop: `./clipdrop-profile`

## Testing & Validation

### Current Test Coverage

**Midjourney**:
- `test-sanitize-prompt.js` - Prompt sanitization tests
- `verify-current-implementation.js` - Implementation verification
- No unit tests

**Ideogram**:
- No test files found

**ChatGPT**:
- `test.js` - Basic testing utilities
- No comprehensive tests

### Testing Gaps

- No unit tests for core modules
- No integration tests
- No end-to-end tests
- No automated test suite
- No CI/CD pipeline

## Deployment Considerations

### Production Deployment (Midjourney)

**PM2 Configuration**:
```javascript
{
  instances: 1,
  max_memory_restart: '512M',
  cron_restart: '0 */4 * * *',
  autorestart: true,
  watch: false
}
```

**Startup Script** (start-production.sh):
```bash
#!/bin/bash
pm2 start ecosystem.config.js
pm2 save
```

### Service Dependencies

**System Requirements**:
- Node.js v14+
- Chromium browser
- 512MB RAM minimum per service
- Linux OS (for Chromium path)

**NPM Packages** (all services):
- express
- puppeteer / puppeteer-extra
- @supabase/supabase-js (Midjourney, Ideogram)
- axios
- cors
- dotenv

## Monitoring & Logging

### Midjourney Monitoring

**Health Endpoint**: GET /health
```json
{
  "status": "running",
  "uptime": 3600,
  "totalRequests": 150,
  "successRate": 97
}
```

**Log Files**:
- `./logs/combined.log` - All output
- `./logs/out.log` - stdout
- `./logs/error.log` - stderr
- `./logs/monitor.log` - Health checks

**PM2 Monitoring**:
```bash
pm2 status
pm2 logs midjourney-api
pm2 monit
```

### Ideogram Monitoring

**Console Logging**:
- Job ID prefixed logs: `[ideogram-123] Step 1: Uploading...`
- Status updates during processing
- Error logging with stack traces

**No Structured Logging**: All logs to console

### ChatGPT Monitoring

**Browser Disconnect Events**:
- Logs when browser disconnects
- Auto-relaunch notifications

**No Health Endpoint**: No monitoring infrastructure

## Security Considerations

### Current Security Issues

1. **Hardcoded Credentials**:
   - Ideogram: Supabase credentials in server.js
   - Should use environment variables

2. **No API Authentication**:
   - All endpoints publicly accessible
   - No rate limiting
   - No API key validation

3. **Open CORS Policy**:
   - Allows all origins
   - Cross-origin attack risk

4. **Cookie Storage**:
   - Midjourney cookies in plain JSON
   - Should encrypt sensitive data

### Recommended Security Measures

1. Move all credentials to .env files
2. Implement API key middleware
3. Add rate limiting (express-rate-limit)
4. Restrict CORS to specific origins
5. Encrypt sensitive configuration
6. Add request validation
7. Implement audit logging

## Performance Characteristics

### Midjourney Service

- **API Response**: < 1s
- **Image Generation**: 30s - 2min
- **Memory**: 150MB baseline, 450MB peak
- **Throughput**: 10-20 concurrent jobs (512MB RAM)
- **Success Rate**: > 95% with valid auth

### Ideogram Service

- **API Response**: < 1s
- **Image Upload**: 2-3s
- **AI Caption**: 3-5s
- **Generation**: 30-90s
- **Total Process**: 40-100s
- **Polling Interval**: 15s
- **Max Timeout**: 10 minutes

### ChatGPT Service

- **Performance metrics not defined**

## Development Workflow

### Claude Code Integration

**Workflows** (`.claude/workflows/`):
- `primary-workflow.md` - Main development process
- `development-rules.md` - Coding standards
- `orchestration-protocol.md` - Multi-agent coordination
- `documentation-management.md` - Doc maintenance

**Development Rules**:
- File naming: kebab-case
- File size: < 200 lines per file
- Principles: YAGNI, KISS, DRY
- No simulation, only real implementation

### Git Configuration

**Repositories**:
- Root: No git repository
- Midjourney: Separate git repo
- Ideogram: Separate git repo

**.gitignore** (common):
- node_modules/
- .env files
- Browser profiles
- Log files

## Recommended Improvements

### Code Quality

1. Split large files (server.js files > 800 lines)
2. Add TypeScript for type safety
3. Implement comprehensive error handling
4. Add input validation middleware
5. Create shared utilities module

### Architecture

1. Unified API gateway for all services
2. Centralized authentication layer
3. Shared job queue system (Redis/Bull)
4. Event-driven architecture (WebSockets)
5. Microservices communication pattern

### Operations

1. Docker containerization
2. Kubernetes deployment
3. CI/CD pipeline (GitHub Actions)
4. Centralized logging (Winston/Pino)
5. Monitoring (Prometheus/Grafana)
6. Alerting system

### Documentation

1. API documentation (OpenAPI/Swagger)
2. Deployment guide
3. Troubleshooting guide
4. Architecture diagrams
5. Development setup guide

---

**Maintainer**: WOWZ Development Team
**Last Review**: 2025-11-18
**Next Review**: Monthly
