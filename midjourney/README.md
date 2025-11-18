# Midjourney API

Node.js REST API for programmatic Midjourney image and video generation using browser automation.

## Quick Overview

Provides REST endpoints to generate images/videos via Midjourney platform without manual Discord interaction. Uses Puppeteer to automate browser sessions with cookie-based authentication. Includes async job polling and Supabase storage integration.

## Features

- **Image Generation**: Text-to-image with customizable parameters (chaos, aspect ratio, stylize, version)
- **Video Generation**: Image-to-video conversion with motion controls
- **Reference Images**: Upload images as prompts via URL
- **Async Job Tracking**: Background polling with automatic storage upload
- **Supabase Integration**: Auto-upload generated assets and update database
- **Health Monitoring**: Auto-restart on failures, memory management
- **Production Ready**: PM2 process management, logging, graceful shutdown

## Installation

### Prerequisites

- Node.js >=14
- Valid Midjourney subscription
- Supabase account (for storage)

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/midjourney-api.git
cd midjourney-api

# Install dependencies
npm install

# Install PM2 globally
npm install -g pm2

# Configure environment (optional)
cp .env.example .env
# Edit .env with your settings
```

### Authentication Setup

1. Login to Midjourney in browser
2. Extract cookies using DevTools:
   - Open https://www.midjourney.com/imagine
   - DevTools → Application → Cookies
   - Copy `__Host-Midjourney.AuthUserTokenV3_r` and `__Host-Midjourney.AuthUserTokenV3_i`
3. Update `cookies.json`:

```json
[
  {
    "name": "__Host-Midjourney.AuthUserTokenV3_r",
    "value": "YOUR_TOKEN_HERE",
    "domain": ".midjourney.com",
    "path": "/"
  },
  {
    "name": "__Host-Midjourney.AuthUserTokenV3_i",
    "value": "YOUR_TOKEN_HERE",
    "domain": ".midjourney.com",
    "path": "/"
  }
]
```

4. Update Supabase credentials in `server.js` (lines 26-28):

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key';
const SUPABASE_BUCKET = 'your-bucket-name';
```

**⚠️ Security Note**: Move credentials to `.env` file in production.

## Usage

### Start Server

**Development**:
```bash
node server.js
```

**Production** (with PM2):
```bash
bash start-production.sh
# Or manually:
pm2 start ecosystem.config.js
pm2 logs midjourney-api
```

Server runs on `http://localhost:3002`

### API Endpoints

#### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "running",
  "uptime": 3600,
  "totalRequests": 150,
  "successRate": 97
}
```

#### Generate Image
```bash
POST /midjourney/genimage
Content-Type: application/json

{
  "prompt": "A majestic cat in a garden, digital art",
  "idea_id": "550e8400-e29b-41d4-a716-446655440000",  // Optional
  "user_id": "660e8400-e29b-41d4-a716-446655440000",  // Optional
  "url_image": "https://example.com/reference.png",  // Optional
  "options": {
    "chaos": 10,
    "ar": "16:9",
    "stylize": 200,
    "version": 7,
    "mode": "relaxed"
  }
}
```

**Required Fields**:
- `prompt`: Text description for image generation

**Optional Fields**:
- `idea_id`: UUID of product_design record (required for database tracking)
- `user_id`: User identifier for tracking
- `url_image`: Reference image URL
- `options`: Generation parameters (see Configuration section)

**Operating Modes**:
- **Database Mode** (with `idea_id`): Images auto-uploaded to Supabase, job status tracked in database
- **Standalone Mode** (without `idea_id`): Job created but no database tracking/storage

Response:
```json
{
  "success": true,
  "message": "Yêu cầu tạo ảnh đã được gửi thành công",
  "jobId": "1234-5678-abcd",
  "batchSize": 4,
  "mode": "database",  // or "standalone"
  "timestamp": "2025-11-17T..."
}
```

Images automatically uploaded to Supabase when `idea_id` provided (15s polling intervals, ~2-6 min completion).

#### Generate Video
```bash
POST /midjourney/genvideo
Content-Type: application/json

{
  "image_url": "https://example.com/image.png",
  "text_prompt": "cinematic motion, smooth camera movement",
  "options": {
    "motion": "high",
    "ar": "16:9"
  }
}
```

#### Check Auth Status
```bash
GET /midjourney/status
```

#### Initialize Client
```bash
POST /midjourney/init
```

### Examples

**cURL**:
```bash
# Generate image with database tracking
curl -X POST http://localhost:3002/midjourney/genimage \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "cyberpunk city at night, neon lights",
    "idea_id": "550e8400-e29b-41d4-a716-446655440000",
    "options": {
      "chaos": 15,
      "ar": "21:9",
      "stylize": 300,
      "version": 7
    }
  }'

# Generate image without database (standalone mode)
curl -X POST http://localhost:3002/midjourney/genimage \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "cyberpunk city at night, neon lights",
    "options": {
      "chaos": 15,
      "ar": "21:9",
      "stylize": 300
    }
  }'

# Health check
curl http://localhost:3002/health
```

**JavaScript (Axios)**:
```javascript
const axios = require('axios');

// With database tracking
async function generateImageWithDB() {
  const response = await axios.post('http://localhost:3002/midjourney/genimage', {
    prompt: 'fantasy landscape with mountains',
    idea_id: '550e8400-e29b-41d4-a716-446655440000',
    options: {
      chaos: 5,
      ar: '4:3',
      stylize: 150,
      version: 7
    }
  });

  console.log('Job ID:', response.data.jobId);
  console.log('Mode:', response.data.mode); // "database"
  // Images will be uploaded to Supabase automatically
}

// Standalone mode (no database)
async function generateImageStandalone() {
  const response = await axios.post('http://localhost:3002/midjourney/genimage', {
    prompt: 'fantasy landscape with mountains',
    options: {
      chaos: 5,
      ar: '4:3',
      stylize: 150
    }
  });

  console.log('Job ID:', response.data.jobId);
  console.log('Mode:', response.data.mode); // "standalone"
  // Job created but no automatic storage
}
```

## Configuration

### Midjourney Parameters

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `chaos` | int | 0-100 | 5 | Variation degree |
| `ar` | string | ratio | "4:3" | Aspect ratio (16:9, 1:1, etc.) |
| `stylize` | int | 0-1000 | 150 | Artistic style strength |
| `weird` | int | 0-3000 | 200 | Experimental weirdness |
| `version` | int | 1-7 | 7 | Midjourney model version |
| `quality` | string/float | - | "normal" | Generation quality |
| `stop` | int | 10-100 | null | Stop at percentage |
| `tile` | boolean | - | false | Seamless tiling |
| `niji` | boolean | - | false | Anime style |
| `mode` | string | - | "relaxed" | "fast" or "relaxed" |
| `private` | boolean | - | false | Private generation |

### Prompt Guidelines

The API automatically sanitizes prompts to prevent parsing errors:

**Automatic Sanitization**:
- Smart quotes (`""`) → regular quotes (`""`)
- Smart apostrophes (`''`) → regular apostrophes (`'`)
- Backslashes (`\`) → removed
- Backticks (`` ` ``) → apostrophes (`'`)
- Multiple spaces → single space

**Best Practices**:
- ✅ Use simple quotes and apostrophes
- ✅ Keep prompts under 2000 characters
- ✅ Avoid excessive special characters
- ✅ Use commas for natural descriptions
- ⚠️ The API handles escaped quotes automatically
- ⚠️ Long prompts with many quotes will be sanitized

**Example**:
```javascript
// Original (with smart quotes and escapes)
"A \"fantasy\" dragon with 'special' features"

// Sanitized automatically
"A "fantasy" dragon with 'special' features"
```

### PM2 Configuration

Edit `ecosystem.config.js`:

```javascript
{
  max_memory_restart: '512M',     // Auto-restart on memory limit
  cron_restart: '0 */4 * * *',    // Restart every 4 hours
  instances: 1,                    // Single instance only
  node_args: '--max-old-space-size=512'
}
```

### Environment Variables

Create `.env`:
```env
NODE_ENV=production
PORT=3002
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
SUPABASE_BUCKET=product-designs
```

## Architecture

```
Express API → Puppeteer Client → Midjourney API
     ↓              ↓                    ↓
Job Polling → CDN Download → Supabase Upload
```

- **server.js**: REST endpoints, job orchestration
- **puppeteer-client.js**: Browser automation, Midjourney wrapper
- **monitor.js**: Health checks, auto-restart
- **PM2**: Process management, logging

See [docs/system-architecture.md](docs/system-architecture.md) for details.

## Monitoring

**PM2 Commands**:
```bash
pm2 status                    # Check status
pm2 logs midjourney-api       # View logs
pm2 restart midjourney-api    # Restart service
pm2 monit                     # Real-time monitoring
```

**Log Files**:
- `./logs/combined.log` - All output
- `./logs/out.log` - stdout
- `./logs/error.log` - stderr
- `./logs/monitor.log` - Health checks

**Health Endpoint**:
```bash
curl http://localhost:3002/health
```

## Troubleshooting

### Cookie Expired
**Symptom**: 401 errors, "Not logged in"
**Solution**:
1. Login to Midjourney manually
2. Extract fresh cookies from browser
3. Update `cookies.json`
4. Restart: `pm2 restart midjourney-api`

### Memory Errors (OOM)
**Symptom**: Crashes, PM2 auto-restarts
**Solution**:
- Increase `max_memory_restart` in `ecosystem.config.js`
- Reduce concurrent jobs
- Check for memory leaks in logs

### Browser Crashes
**Symptom**: "Browser closed unexpectedly"
**Solution**:
```bash
# Clean browser profile
rm -rf midjourney-profile/*
pm2 restart midjourney-api

# Check system resources
free -m
top
```

### Supabase Upload Fails
**Symptom**: Job status stuck on "processing"
**Solution**:
- Verify Supabase credentials
- Check bucket permissions (public read)
- Validate `idea_id` exists in database

### CDN Images Not Found
**Symptom**: Polling timeout after 6 minutes
**Causes**:
- Midjourney rate limit hit
- Invalid prompt (content policy)
- Session expired mid-generation

**Solution**: Check Midjourney website for job status manually

## Performance

- **Latency**: <1s API response, 30s-2min generation
- **Throughput**: ~10-20 concurrent jobs (512MB RAM)
- **Success Rate**: >95% (with valid auth)
- **Memory**: 150MB baseline, 450MB peak

## Security

**Current Issues**:
- ⚠️ Hardcoded Supabase credentials (line 27-28 in server.js)
- ⚠️ No API authentication
- ⚠️ Open CORS policy

**Recommendations**:
1. Move credentials to `.env`
2. Add API key middleware
3. Restrict CORS origins
4. Implement rate limiting

See [docs/system-architecture.md#security-considerations](docs/system-architecture.md#security-considerations)

## Documentation

Comprehensive docs in `/docs`:
- [project-overview-pdr.md](docs/project-overview-pdr.md) - Requirements, goals, metrics
- [codebase-summary.md](docs/codebase-summary.md) - Code structure, modules, flows
- [code-standards.md](docs/code-standards.md) - Conventions, testing, best practices
- [system-architecture.md](docs/system-architecture.md) - Architecture, API design, security

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (no PM2)
node server.js

# Watch mode (requires nodemon)
npm run dev
```

## Deployment

**Single VPS**:
```bash
# SSH to server
ssh user@your-server.com

# Clone and setup
git clone <repo-url>
cd midjourney-api
bash start-production.sh

# Configure reverse proxy (nginx)
# Point domain to localhost:3002
```

**Docker** (not implemented):
```dockerfile
# TODO: Create Dockerfile with Chromium dependencies
```

## Limitations

- **Single Instance**: Puppeteer profile lock prevents clustering
- **Session Management**: Manual cookie refresh required
- **Rate Limits**: Midjourney throttling not handled
- **No Tests**: Missing unit/integration tests
- **No TypeScript**: Plain JavaScript (type safety limited)

## Roadmap

- [ ] Environment variable configuration
- [ ] API key authentication
- [ ] TypeScript migration
- [ ] Unit/integration tests
- [ ] Multi-account support (horizontal scaling)
- [ ] WebSocket for real-time updates
- [ ] Docker deployment
- [ ] Admin dashboard

## Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/api-auth`)
3. Commit changes (`git commit -m 'Add API authentication'`)
4. Push to branch (`git push origin feature/api-auth`)
5. Open Pull Request

Follow [code standards](docs/code-standards.md).

## License

MIT

## Support

- **Issues**: GitHub Issues
- **Email**: support@example.com
- **Docs**: See `/docs` directory

## Acknowledgments

- Midjourney for the AI platform
- Puppeteer team for browser automation
- Supabase for backend services

---

**⚠️ Disclaimer**: Unofficial API. Use at your own risk. Ensure compliance with Midjourney Terms of Service.
