# Veo3 Video Generation API Guide

## Overview

Google Veo 3.1 video generation API powered by Puppeteer automation. Generate high-quality videos from text prompts using Google's latest video generation model.

## Service Information

**Port**: 3003
**Status**: Beta
**Technology**: Puppeteer + Express.js
**Model**: Google Veo 3.1
**Generation Time**: 2-10 minutes per video

## Features

- Text-to-video generation with Veo 3.1
- Image-to-video (planned)
- Async job processing with status tracking
- Automatic video download
- Screenshot capture for debugging
- Job history tracking

## Quick Start

### Prerequisites

- Node.js 18+
- Google account with Gemini access
- Chromium browser (installed by Puppeteer)

### Installation

```bash
cd veo3
npm install
```

### Configuration

Create `.env` file:

```env
PORT=3003
GOOGLE_EMAIL=your-email@gmail.com
GOOGLE_PASSWORD=your-password
VEO_DOWNLOAD_DIR=./downloads
```

### Start Service

```bash
npm start
```

The API will be available at `http://localhost:3003`

## API Endpoints

### 1. Health Check

**GET** `/health`

Check service status and metrics.

**Response:**
```json
{
  "status": "running",
  "uptime": 3600,
  "totalRequests": 25,
  "successfulRequests": 23,
  "failedRequests": 2,
  "successRate": 92.00,
  "lastRequest": "2025-11-21T00:30:15.123Z",
  "lastError": null,
  "timestamp": "2025-11-21T00:35:00.000Z"
}
```

### 2. Generate Video

**POST** `/veo3/generate`

Start video generation job.

**Request Body:**
```json
{
  "prompt": "A cat playing with a ball of yarn in slow motion",
  "image_url": ""
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ Yes | Text description for video generation |
| `image_url` | string | ❌ No | Reference image URL (future feature) |

**Response:**
```json
{
  "success": true,
  "jobId": "veo3-1732147815123-abc123def",
  "message": "Video generation started",
  "estimatedTime": "2-10 minutes",
  "timestamp": "2025-11-21T00:30:15.123Z"
}
```

### 3. Check Job Status

**GET** `/veo3/job/:jobId`

Check the status of a video generation job.

**Example:**
```bash
GET /veo3/job/veo3-1732147815123-abc123def
```

**Response (Processing):**
```json
{
  "success": true,
  "jobId": "veo3-1732147815123-abc123def",
  "prompt": "A cat playing with a ball of yarn in slow motion",
  "image_url": null,
  "status": "processing",
  "createdAt": "2025-11-21T00:30:15.123Z",
  "startedAt": "2025-11-21T00:30:20.456Z",
  "completedAt": null,
  "videoPath": null,
  "videoUrl": null,
  "error": null,
  "timestamp": "2025-11-21T00:32:00.000Z"
}
```

**Response (Completed):**
```json
{
  "success": true,
  "jobId": "veo3-1732147815123-abc123def",
  "prompt": "A cat playing with a ball of yarn in slow motion",
  "status": "completed",
  "createdAt": "2025-11-21T00:30:15.123Z",
  "startedAt": "2025-11-21T00:30:20.456Z",
  "completedAt": "2025-11-21T00:35:45.789Z",
  "videoPath": "/root/wowz-cloud-api/veo3/downloads/video-123.mp4",
  "videoUrl": "/veo3/download/video-123.mp4",
  "error": null,
  "timestamp": "2025-11-21T00:36:00.000Z"
}
```

**Status Values:**
- `queued` - Job waiting to start
- `processing` - Video generation in progress
- `completed` - Video ready for download
- `failed` - Generation failed

### 4. Download Video

**GET** `/veo3/download/:filename`

Download generated video file.

**Example:**
```bash
GET /veo3/download/video-123.mp4
```

**Response:** Binary video file (MP4 or WebM)

### 5. List All Jobs

**GET** `/veo3/jobs`

Get list of all video generation jobs.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "jobs": [
    {
      "jobId": "veo3-1732147815123-abc123def",
      "prompt": "A cat playing with a ball of yarn",
      "status": "completed",
      "createdAt": "2025-11-21T00:30:15.123Z",
      "completedAt": "2025-11-21T00:35:45.789Z",
      "videoUrl": "/veo3/download/video-123.mp4"
    }
  ],
  "timestamp": "2025-11-21T00:36:00.000Z"
}
```

## N8N Integration

### Method 1: Simple HTTP Request

**Step 1: Generate Video**

**N8N HTTP Request Node:**
- Method: POST
- URL: `http://46.250.232.188:3003/veo3/generate`
- Body Type: JSON
- Body:
```json
{
  "prompt": "{{$json.prompt}}"
}
```

**Step 2: Wait for Completion**

Add **Wait** node: 3-5 minutes

**Step 3: Check Status**

**N8N HTTP Request Node:**
- Method: GET
- URL: `http://46.250.232.188:3003/veo3/job/{{$json.jobId}}`

**Step 4: Download Video**

**N8N HTTP Request Node:**
- Method: GET
- URL: `http://46.250.232.188:3003{{$json.videoUrl}}`
- Response Format: File

### Method 2: Polling Workflow

```
[Trigger]
    ↓
[HTTP Request: Generate Video]
    ↓
[Wait 30s]
    ↓
[HTTP Request: Check Status] ← Loop until completed
    ↓
[IF: status == "completed"]
    ↓
[HTTP Request: Download Video]
    ↓
[Save to Storage]
```

### Method 3: N8N Code Node with Polling

```javascript
// Generate video
const generateResponse = await this.helpers.request({
  method: 'POST',
  url: 'http://46.250.232.188:3003/veo3/generate',
  body: {
    prompt: $input.item.json.prompt
  },
  json: true
});

const jobId = generateResponse.jobId;
console.log('Job created:', jobId);

// Poll for completion
let status = 'processing';
let attempts = 0;
const maxAttempts = 60; // 10 minutes with 10s interval

while (status === 'processing' && attempts < maxAttempts) {
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s

  const statusResponse = await this.helpers.request({
    method: 'GET',
    url: `http://46.250.232.188:3003/veo3/job/${jobId}`,
    json: true
  });

  status = statusResponse.status;
  attempts++;
  console.log(`Attempt ${attempts}: Status = ${status}`);

  if (status === 'completed') {
    // Download video
    const video = await this.helpers.request({
      method: 'GET',
      url: `http://46.250.232.188:3003${statusResponse.videoUrl}`,
      encoding: null, // Binary data
    });

    return [{
      json: {
        ...statusResponse,
        success: true
      },
      binary: {
        video: {
          data: video.toString('base64'),
          mimeType: 'video/mp4',
          fileName: `veo-${jobId}.mp4`
        }
      }
    }];
  }

  if (status === 'failed') {
    throw new Error(statusResponse.error || 'Video generation failed');
  }
}

if (attempts >= maxAttempts) {
  throw new Error('Timeout: Video generation took too long');
}
```

## Testing

### Test with cURL

**1. Generate Video:**
```bash
curl -X POST http://localhost:3003/veo3/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene sunset over ocean waves"
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "veo3-1732147815123-abc123def",
  "message": "Video generation started",
  "estimatedTime": "2-10 minutes"
}
```

**2. Check Status:**
```bash
curl http://localhost:3003/veo3/job/veo3-1732147815123-abc123def
```

**3. Download Video:**
```bash
curl -O http://localhost:3003/veo3/download/video-123.mp4
```

### Test with Postman

**Collection:** Import from `docs/veo3-postman-collection.json` (to be created)

## Example Prompts

### Good Prompts

✅ **Cinematic with details:**
```
"A majestic eagle soaring through mountain valleys at golden hour,
camera tracking smoothly, cinematic 4K quality"
```

✅ **Action sequence:**
```
"Time-lapse of a flower blooming from bud to full bloom,
morning light streaming through petals"
```

✅ **Nature scene:**
```
"Underwater view of colorful tropical fish swimming through coral reef,
gentle water movement, bright natural lighting"
```

### Bad Prompts

❌ **Too vague:**
```
"A video"
"Something cool"
```

❌ **Too complex:**
```
"A cat playing piano while a dog dances and a bird sings opera
in a spaceship flying to Mars during sunset"
```

## Performance Metrics

**API Response Time**: < 1 second
**Video Generation Time**: 2-10 minutes (depends on Veo processing)
**Video Quality**: Up to 1080p
**Video Length**: 5-10 seconds (Veo 3.1 default)
**Concurrent Jobs**: 1 (sequential processing)
**Success Rate**: ~85% (depends on prompt quality)

## Troubleshooting

### Common Issues

**Issue: "Login failed"**
- **Cause**: Invalid Google credentials or 2FA enabled
- **Solution**:
  - Check GOOGLE_EMAIL and GOOGLE_PASSWORD in .env
  - Disable 2FA or use app-specific password
  - Check if account has Gemini access

**Issue: "Timeout: Video did not appear"**
- **Cause**: Veo generation taking longer than expected
- **Solution**:
  - Wait longer (some prompts take 10+ minutes)
  - Check screenshots in `veo3/screenshots/` folder
  - Simplify prompt

**Issue: "Download button not found"**
- **Cause**: UI changed or video not ready
- **Solution**:
  - Check screenshots for current UI state
  - Update selectors in server.js if needed
  - Manual download from browser

**Issue: "No video file found"**
- **Cause**: Download failed or completed outside downloads folder
- **Solution**:
  - Check `veo3/downloads/` folder manually
  - Verify download permissions
  - Check browser download settings

### Debug Mode

Check screenshots in `veo3/screenshots/`:
- `{jobId}-1-ready.png` - Veo tool opened
- `{jobId}-2-typed.png` - Prompt entered
- `{jobId}-3-submitted.png` - Prompt submitted
- `{jobId}-4-ready.png` - Video ready
- `{jobId}-5-downloaded.png` - Download initiated

### Logs

**Start with logging:**
```bash
npm start | tee veo3-service.log
```

**Check service status:**
```bash
curl http://localhost:3003/health
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Veo3 Video Generation API               │
│                                                      │
│  ┌────────────┐        ┌──────────────────┐        │
│  │  Express   │───────▶│  Job Queue       │        │
│  │  REST API  │        │  (In-Memory Map) │        │
│  └────────────┘        └──────────────────┘        │
│         │                       │                    │
│         │                       ▼                    │
│         │              ┌──────────────────┐         │
│         │              │  Puppeteer       │         │
│         │              │  Browser         │         │
│         │              │  Automation      │         │
│         │              └──────────────────┘         │
│         │                       │                    │
│         │                       ▼                    │
│         │              ┌──────────────────┐         │
│         └─────────────▶│  Google Gemini   │         │
│                        │  Veo 3.1         │         │
│                        └──────────────────┘         │
│                                 │                    │
│                                 ▼                    │
│                        ┌──────────────────┐         │
│                        │  Video Download  │         │
│                        │  ./downloads/    │         │
│                        └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

## Limitations

1. **Sequential Processing**: Only one job at a time (Google account limitation)
2. **Browser Required**: Needs headless browser (high memory usage)
3. **No Authentication**: No API key authentication (security risk)
4. **No Rate Limiting**: Can overload Google account
5. **Session Management**: Requires re-login periodically
6. **Video Length**: Limited to 5-10 seconds per generation
7. **No Retry Logic**: Failed jobs must be manually restarted

## Roadmap

### Phase 1: Current ✅
- ✅ Basic text-to-video generation
- ✅ Job tracking and status API
- ✅ Video download endpoint

### Phase 2: Enhancement
- [ ] Image-to-video support (with reference image)
- [ ] Job retry mechanism
- [ ] API key authentication
- [ ] Rate limiting per client
- [ ] Session persistence (cookie storage)

### Phase 3: Scalability
- [ ] Multi-account support
- [ ] Job queue with priorities
- [ ] Webhook notifications
- [ ] Cloud storage integration (S3/Supabase)
- [ ] Docker containerization

### Phase 4: Advanced
- [ ] Video editing endpoints (trim, merge)
- [ ] Batch generation
- [ ] Video analytics (duration, resolution, size)
- [ ] Custom video parameters (resolution, length)

## Security Considerations

⚠️ **Current Issues:**
- No API authentication
- Credentials in environment variables
- No CORS restrictions
- No rate limiting
- No input validation

**Recommendations:**
1. Add API key authentication middleware
2. Use secure credential storage (e.g., Vault)
3. Implement rate limiting per IP/API key
4. Add request validation schema
5. Enable CORS only for trusted origins
6. Use HTTPS in production

## Support

**Service Location**: `/root/wowz-cloud-api/veo3/`
**Logs**: Console output
**Screenshots**: `veo3/screenshots/`
**Downloads**: `veo3/downloads/`
**Port**: 3003

---

**Last Updated**: 2025-11-21
**API Version**: 1.0.0
**Status**: Beta ⚠️
