# WOWZ Cloud API Platform

Multi-service REST API platform providing unified access to AI-powered image generation services (Midjourney, Ideogram, ChatGPT) through browser automation and async job processing.

## Quick Start

### Prerequisites

- Node.js 14+
- Linux server (for Chromium)
- Supabase account
- Valid subscriptions to AI platforms

### Installation

```bash
# Clone repository
git clone <repository-url>
cd wowz-cloud-api

# Install dependencies for each service
cd midjourney && npm install
cd ../ideogram && npm install
cd ../chatgpt && npm install
```

### Configuration

Create `.env` files in each service directory:

**Midjourney** (`midjourney/.env`):
```env
PORT=3002
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=product-designs
NODE_ENV=production
```

**Ideogram** (`ideogram/.env`):
```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**ChatGPT** (`chatgpt/.env`):
```env
PORT=3001
```

### Start Services

**Midjourney** (with PM2):
```bash
cd midjourney
bash start-production.sh
# Or manually: pm2 start ecosystem.config.js
```

**Ideogram**:
```bash
cd ideogram
node server.js
# Or with systemd (recommended for production)
```

**ChatGPT**:
```bash
cd chatgpt
node gptapi.js
```

## Service Overview

### Midjourney Service

**Port**: 3002
**Status**: Production-ready
**Documentation**: [midjourney/README.md](midjourney/README.md)

**Capabilities**:
- Text-to-image generation with full parameter control
- Image-to-video conversion
- Reference image support
- Async job polling with Supabase integration
- PM2 process management

**Quick Example**:
```bash
curl -X POST http://localhost:3002/midjourney/genimage \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "cyberpunk city at night, neon lights",
    "idea_id": "550e8400-e29b-41d4-a716-446655440000",
    "options": {
      "chaos": 15,
      "ar": "16:9",
      "stylize": 300,
      "version": 7
    }
  }'
```

### Ideogram Service

**Port**: 3000
**Status**: Production-ready with N8N integration
**Documentation**: [ideogram/README.md](ideogram/README.md)

**Capabilities**:
- Image upload and caption generation
- Image variation generation with style control
- Image upscaling and background removal
- Unified `/api/remix` endpoint for N8N workflows
- Text-to-image generation

**Quick Example**:
```bash
curl -X POST http://localhost:3000/api/remix \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "imageWeight": 70,
    "style": "DESIGN"
  }'
```

### Veo3 Service

**Port**: 3003
**Status**: Beta ⚠️
**Documentation**: [veo3/README.md](veo3/README.md)

**Capabilities**:
- Text-to-video generation with Google Veo 3.1
- High-quality 5-10 second video clips
- Async job processing with status tracking
- Automatic video download
- N8N workflow integration

**Quick Example**:
```bash
curl -X POST http://localhost:3003/veo3/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cat playing with a ball of yarn in slow motion"
  }'
```

### ChatGPT Service

**Port**: TBD
**Status**: In development
**Documentation**: Minimal

**Capabilities**:
- Custom GPT integration (WOWZ AI Assistant Remix Design)
- Image upload and processing
- Profile-based authentication

### Clipdrop Service

**Status**: Not implemented
Only browser profile directory exists. No implementation yet.

## Common Operations

### Check Service Health

```bash
# Midjourney
curl http://localhost:3002/health

# Response:
# {
#   "status": "running",
#   "uptime": 3600,
#   "totalRequests": 150,
#   "successRate": 97
# }
```

### Check Job Status

```bash
# Ideogram
curl http://localhost:3000/api/job/{jobId}

# Response:
# {
#   "jobId": "ideogram-123",
#   "status": "completed",
#   "results": ["https://..."]
# }
```

### Monitor Services

```bash
# Midjourney (PM2)
pm2 status
pm2 logs midjourney-api
pm2 monit

# Ideogram/ChatGPT (systemd)
sudo systemctl status ideogram-api
sudo journalctl -u ideogram-api -f
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              WOWZ Cloud API Platform                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Midjourney  │  │   Ideogram   │  │   ChatGPT    │ │
│  │   :3002      │  │   :3000      │  │   :TBD       │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│                    ┌───────▼────────┐                   │
│                    │  Supabase      │                   │
│                    │  - PostgreSQL  │                   │
│                    │  - Storage     │                   │
│                    └────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Async Processing**: Non-blocking API responses with background job polling
- **Supabase Integration**: Automatic storage upload and database tracking
- **Browser Automation**: Puppeteer with stealth mode for platform access
- **Job Tracking**: Real-time status updates via database

## API Endpoints

### Midjourney

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/midjourney/genimage` | POST | Generate image from prompt |
| `/midjourney/genvideo` | POST | Generate video from image |
| `/midjourney/status` | GET | Check authentication status |
| `/midjourney/init` | POST | Initialize client |

### Ideogram

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/remix` | POST | Unified remix endpoint (recommended) |
| `/api/job/:jobId` | GET | Check job status |
| `/api/upload` | POST | Upload image |
| `/api/caption` | POST | Get AI caption |
| `/api/generate-variations` | POST | Generate variations |
| `/api/gencustom` | POST | Custom generation |
| `/api/upscale` | POST | Upscale image |
| `/api/removebackground` | POST | Remove background |
| `/api/genimageprompt` | POST | Text-to-image |

### Veo3

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/veo3/generate` | POST | Generate video from prompt |
| `/veo3/job/:jobId` | GET | Check job status |
| `/veo3/download/:filename` | GET | Download generated video |
| `/veo3/jobs` | GET | List all jobs |

## Documentation

Comprehensive documentation available in `/docs`:

- **[Project Overview & PDR](docs/project-overview-pdr.md)** - Requirements, goals, success metrics
- **[Codebase Summary](docs/codebase-summary.md)** - Code structure, modules, data flows
- **[Code Standards](docs/code-standards.md)** - Conventions, testing, best practices
- **[System Architecture](docs/system-architecture.md)** - Architecture, API design, security

Service-specific documentation:
- **[Midjourney Service](midjourney/README.md)** - Complete Midjourney API docs
- **[Ideogram Service](ideogram/README.md)** - Ideogram API and N8N integration

## Technology Stack

**Backend**: Express.js, Node.js
**Browser Automation**: Puppeteer, puppeteer-extra, stealth plugin
**Database**: Supabase (PostgreSQL + Storage)
**Process Management**: PM2 (Midjourney)
**HTTP Client**: Axios
**Middleware**: CORS, body-parser, dotenv

## Development

### Project Structure

```
wowz-cloud-api/
├── docs/                    # Platform documentation
├── midjourney/             # Midjourney service
│   ├── docs/              # Service-specific docs
│   ├── server.js          # Main server
│   ├── puppeteer-client.js # Midjourney wrapper
│   └── ecosystem.config.js # PM2 config
├── ideogram/              # Ideogram service
│   ├── server.js         # Main server
│   └── README.md         # API documentation
├── chatgpt/              # ChatGPT service
│   ├── gptapi.js        # Main API
│   └── login-gptapi.js  # Authentication
├── clipdrop/             # Clipdrop (not implemented)
└── .claude/              # Claude Code workflows
```

### Development Workflow

1. **Setup**: Install dependencies, configure .env files
2. **Development**: Run services locally (`node server.js`)
3. **Testing**: Write tests, run test suite
4. **Documentation**: Update docs for API changes
5. **Deployment**: Use PM2 or systemd for production

### Code Standards

- **File Naming**: kebab-case for all files
- **File Size**: < 200 lines per file (modularize larger files)
- **Principles**: YAGNI, KISS, DRY
- **Error Handling**: Try-catch for all async operations
- **Security**: No hardcoded credentials, use .env files

See [docs/code-standards.md](docs/code-standards.md) for complete guidelines.

## Deployment

### Production Deployment

**Requirements**:
- Linux server (Ubuntu 20.04+)
- Node.js 14+
- Chromium browser
- 512MB RAM per service minimum
- Supabase account

**Steps**:
1. Clone repository to server
2. Install dependencies for each service
3. Configure .env files with production credentials
4. Setup authentication (cookies, tokens, profiles)
5. Start services with PM2 or systemd
6. Configure reverse proxy (nginx) for SSL/routing

**Nginx Configuration** (example):
```nginx
server {
    listen 80;
    server_name api.example.com;

    location /midjourney/ {
        proxy_pass http://localhost:3002/;
    }

    location /ideogram/ {
        proxy_pass http://localhost:3000/;
    }
}
```

## Security Considerations

**Current Security Issues**:
- ⚠️ Hardcoded Supabase credentials in Ideogram (move to .env)
- ⚠️ No API authentication (implement API keys)
- ⚠️ Open CORS policy (restrict origins)
- ⚠️ No rate limiting (add express-rate-limit)

**Recommendations**:
1. Move all credentials to environment variables
2. Implement API key authentication middleware
3. Add rate limiting per IP/API key
4. Restrict CORS to specific origins
5. Encrypt sensitive configuration files
6. Use HTTPS only in production

See [docs/system-architecture.md#security-architecture](docs/system-architecture.md#security-architecture) for details.

## Troubleshooting

### Common Issues

**Cookie Expired** (Midjourney):
```bash
# Solution: Extract fresh cookies and update cookies.json
# Then restart: pm2 restart midjourney-api
```

**Token Expired** (Ideogram):
```bash
# Check token service: curl https://ideogram.cryptovn.news/
# Restart service to fetch new token
```

**Browser Crashes**:
```bash
# Clean browser profile
rm -rf {service}-profile/*
# Restart service
```

**Memory Errors**:
```bash
# Increase PM2 memory limit in ecosystem.config.js
max_memory_restart: '1024M'
# Restart: pm2 restart midjourney-api
```

## Performance

**Metrics** (per service):
- API Response: < 1s
- Image Generation: 30s - 2min (Midjourney), 40-100s (Ideogram)
- Memory: 150-450MB per service
- Throughput: 10-20 concurrent jobs (512MB RAM)
- Success Rate: > 95% with valid authentication

## Roadmap

### Phase 1: Foundation ✅
- ✅ Midjourney service with full functionality
- ✅ Ideogram service with N8N integration
- ✅ Basic ChatGPT integration
- ✅ Comprehensive documentation

### Phase 2: Security & Production Readiness
- [ ] Environment variable configuration for all services
- [ ] API key authentication middleware
- [ ] Rate limiting implementation
- [ ] CORS policy restrictions
- [ ] Remove hardcoded credentials

### Phase 3: Testing & Quality
- [ ] Unit test coverage
- [ ] Integration tests
- [ ] End-to-end testing
- [ ] CI/CD pipeline

### Phase 4: Advanced Features
- [ ] Unified API gateway
- [ ] WebSocket support for real-time updates
- [ ] Multi-account support for scaling
- [ ] Admin dashboard
- [ ] Docker containerization

### Phase 5: Clipdrop Implementation
- [ ] Complete Clipdrop service
- [ ] API endpoint design
- [ ] Supabase integration

## Contributing

1. Read [docs/code-standards.md](docs/code-standards.md)
2. Create feature branch: `feature/api-authentication`
3. Make changes following coding standards
4. Write tests for new functionality
5. Update documentation
6. Submit pull request

## License

MIT (update with actual license)

## Support

- **Issues**: GitHub Issues
- **Documentation**: See `/docs` directory
- **Service Docs**: See individual service README files

## Acknowledgments

- Midjourney for the AI platform
- Ideogram for image generation capabilities
- OpenAI for ChatGPT
- Supabase for backend infrastructure
- Puppeteer team for browser automation

---

**Status**: Active Development
**Version**: 1.0.0
**Last Updated**: 2025-11-18

**⚠️ Disclaimer**: Unofficial API integrations. Use at your own risk. Ensure compliance with platform Terms of Service.
