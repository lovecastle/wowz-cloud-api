# Veo3 Video Generation API

Google Veo 3.1 video generation service with REST API for N8N integration.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure

Create `.env` file:

```env
PORT=3003
GOOGLE_EMAIL=your-email@gmail.com
GOOGLE_PASSWORD=your-password
VEO_DOWNLOAD_DIR=./downloads
```

### 3. Start Service

**Development:**
```bash
npm start
```

**Production (PM2):**
```bash
pm2 start ecosystem.config.js
pm2 logs veo3-api
```

## API Endpoints

### Generate Video
```bash
curl -X POST http://localhost:3003/veo3/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cat playing with yarn"}'
```

### Check Status
```bash
curl http://localhost:3003/veo3/job/{jobId}
```

### Download Video
```bash
curl -O http://localhost:3003/veo3/download/{filename}
```

## Documentation

- **API Guide**: `/docs/veo3-api-guide.md`
- **N8N Workflow**: `/docs/n8n-veo3-workflow.md`

## N8N Integration

### Simple Request

**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "http://46.250.232.188:3003/veo3/generate",
  "body": {
    "prompt": "A serene sunset over ocean waves"
  }
}
```

### Full Workflow Code

See `/docs/n8n-veo3-workflow.md` for complete examples including:
- Polling for completion
- Video download
- Error handling
- Batch processing

## Service Status

**Port**: 3003
**Status**: Beta ⚠️
**Model**: Google Veo 3.1
**Generation Time**: 2-10 minutes

## Architecture

- **Framework**: Express.js
- **Automation**: Puppeteer
- **Platform**: Google Gemini + Veo 3.1
- **Processing**: Async job queue

## Limitations

- Sequential processing (1 job at a time)
- Requires Google account with Gemini access
- 5-10 second videos only
- High memory usage (Chromium browser)

## Troubleshooting

### Check Service
```bash
curl http://localhost:3003/health
```

### View Logs
```bash
pm2 logs veo3-api
# or
tail -f logs/out.log
```

### Screenshots
Debug screenshots saved to: `./screenshots/`

## Support

For issues, check `/docs/veo3-api-guide.md` troubleshooting section.
