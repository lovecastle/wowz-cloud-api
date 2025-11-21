# N8N Webhook Integration - Midjourney API

## Overview

Integration guide for sending Midjourney image generation requests from N8N workflows to the WOWZ Cloud API.

## Endpoint Details

**URL**: `http://46.250.232.188:3002/midjourney/genimage`
**Method**: `POST`
**Content-Type**: `application/json`
**Timeout**: 300000ms (5 minutes recommended)

## Request Payload

### Minimal Request

```json
{
  "prompt": "create a dragon design",
  "idea_id": "336f5a1a-0329-4f01-a19e-8e99f0e37b73"
}
```

### Full Request with Options

```json
{
  "prompt": "create a dragon design",
  "url_image": "",
  "design_id": "336f5a1a-0329-4f01-a19e-8e99f0e37b73",
  "options": {
    "chaos": 0,
    "ar": "1:1",
    "stylize": 100,
    "weird": 0,
    "mode": "relaxed",
    "version": 7
  }
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ Yes | Text description for image generation |
| `design_id` | string | ⚠️ Recommended | UUID for database tracking. Required for Supabase integration |
| `idea_id` | string | ❌ No | **Deprecated** - Use `design_id` instead. Kept for backward compatibility |
| `user_id` | string | ❌ No | User identifier for tracking |
| `url_image` | string | ❌ No | Reference image URL for style transfer |
| `options` | object | ❌ No | Midjourney generation parameters |

### Options Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `chaos` | number | 0 | 0-100 | Randomness level |
| `ar` | string | "1:1" | - | Aspect ratio: "1:1", "16:9", "9:16", "4:3", "3:4" |
| `stylize` | number | 100 | 0-1000 | Style strength |
| `weird` | number | 0 | 0-3000 | Weirdness level |
| `mode` | string | "relaxed" | - | Generation mode: "fast", "relaxed", "turbo" |
| `version` | number | 7 | - | Midjourney model version |

## Response Format

### Success Response (202 Accepted)

```json
{
  "success": true,
  "message": "Yêu cầu tạo ảnh đã được gửi thành công",
  "data": {
    "success": [{
      "job_id": "afab1842-f295-48ba-9aa3-ccc2cd955dd0",
      "prompt": "test connection --ar 1:1 --weird 200 --v 7.0",
      "is_queued": false,
      "softban": false,
      "event_type": "diffusion",
      "flags": {
        "mode": "relaxed",
        "visibility": "public"
      },
      "meta": {
        "height": 1024,
        "width": 1024,
        "batch_size": 4,
        "parent_id": null,
        "parent_grid": null
      }
    }],
    "failure": []
  },
  "jobId": "afab1842-f295-48ba-9aa3-ccc2cd955dd0",
  "batchSize": 4,
  "retryCount": 0,
  "mode": "database",
  "timestamp": "2025-11-20T11:05:56.703Z"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "timestamp": "2025-11-20T11:05:56.703Z"
}
```

## N8N HTTP Request Node Configuration

### Method 1: Simple JSON Body

**Node Settings**:
- Authentication: None
- Request Method: POST
- URL: `http://46.250.232.188:3002/midjourney/genimage`
- Send Body: true
- Body Content Type: JSON
- Specify Body: Using JSON

**Body**:
```json
{
  "prompt": "{{$json.prompt}}",
  "design_id": "{{$json.design_id}}",
  "options": {
    "chaos": {{$json.chaos || 0}},
    "ar": "{{$json.ar || '2:3'}}",
    "stylize": {{$json.stylize || 100}},
    "mode": "{{$json.mode || 'relaxed'}}"
  }
}
```

### Method 2: Full Configuration (Your Current Setup)

**Node Settings**:
- Request Method: POST
- URL: `http://46.250.232.188:3002/midjourney/genimage`
- Send Body: true
- Body Content Type: JSON
- Timeout: 300000 (5 minutes)
- Follow Redirects: true
- Use Stream: true

**Body**:
```json
{
  "prompt": "The design features a vertical arrangement of three distinct fantasy dragons with accompanying text elements, swords, a quill feather, and a castle in the background",
  "url_image": "",
  "design_id": "336f5a1a-0329-4f01-a19e-8e99f0e37b73",
  "options": {
    "chaos": 0,
    "ar": "2:3",
    "stylize": 100,
    "weird": 0,
    "mode": "relaxed"
  }
}
```

## Integration Modes

### Mode 1: Database Tracking (Recommended)

**Use Case**: Production workflows with result tracking

**Requirements**:
- Provide `idea_id` parameter
- Supabase configured on server
- Database table `product_design` exists

**Behavior**:
1. Request accepted immediately
2. Job status updated to "processing" in database
3. Background polling starts automatically
4. Results uploaded to Supabase Storage
5. Database updated with image URLs when complete
6. Job status set to "completed"

**Advantages**:
- Automatic result storage
- Status tracking via database
- No need to poll API manually
- Results persist in Supabase

### Mode 2: Standalone Mode

**Use Case**: Testing, development, external workflows

**Requirements**:
- Omit `idea_id` parameter

**Behavior**:
1. Request accepted, job created
2. Returns job_id only
3. No database updates
4. No automatic storage
5. Manual polling required

**Advantages**:
- No database dependency
- Faster response
- Simpler integration

## Workflow Examples

### N8N Workflow 1: Simple Generation

```
[Webhook/Trigger]
    → [HTTP Request: Midjourney API]
    → [Response Handler]
```

### N8N Workflow 2: With Database Polling

```
[Webhook/Trigger]
    → [HTTP Request: Midjourney API]
    → [Wait 30s]
    → [Supabase: Check job_status]
    → [IF: status == "completed"]
        → [Supabase: Get generated_designs_url]
        → [Process Images]
```

### N8N Workflow 3: Batch Processing

```
[Trigger: Multiple Ideas]
    → [Split in Batches: 3]
    → [HTTP Request: Midjourney API]
    → [Merge Results]
    → [Notify Completion]
```

## Polling for Results

### Option 1: Database Polling (Recommended)

Query Supabase directly:

```sql
SELECT
  id,
  job_id,
  job_status,
  generated_designs_url
FROM product_design
WHERE id = '336f5a1a-0329-4f01-a19e-8e99f0e37b73'
```

**Status Values**:
- `processing` - Job in progress
- `completed` - Images ready in `generated_designs_url`
- `failed` - Generation failed

### Option 2: Manual API Polling (Not Implemented Yet)

Future endpoint: `GET /midjourney/job/:jobId`

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Prompt là bắt buộc` | Missing prompt | Add prompt field |
| `Connection refused` | Service down | Check PM2 status: `pm2 status midjourney-api` |
| `Timeout` | Long generation | Increase timeout to 300000ms |
| `Cookie expired` | Authentication failed | Update cookies.json |
| `Softban detected` | Rate limit hit | Wait 10 minutes, use "relaxed" mode |

### N8N Error Handling

**Retry Settings**:
- Max Retries: 3
- Retry Interval: 30 seconds
- Exponential Backoff: Enabled

**Error Workflow**:
```
[HTTP Request: Midjourney]
    → [IF: Error]
        → [Log Error]
        → [Update DB: status="failed"]
        → [Send Alert]
```

## Testing

### Health Check

```bash
curl http://46.250.232.188:3002/health
```

**Expected Response**:
```json
{
  "status": "running",
  "uptime": 300,
  "totalRequests": 45,
  "successfulRequests": 42,
  "failedRequests": 3,
  "successRate": 93.33,
  "lastRequest": "2025-11-20T11:05:56.703Z",
  "timestamp": "2025-11-20T11:06:00.000Z"
}
```

### Test Request (curl)

```bash
curl -X POST http://46.250.232.188:3002/midjourney/genimage \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test dragon design",
    "idea_id": "test-123",
    "options": {
      "chaos": 0,
      "ar": "1:1",
      "stylize": 100,
      "mode": "relaxed"
    }
  }'
```

## Performance Metrics

**API Response Time**: < 5 seconds
**Generation Time**: 30-120 seconds (depends on mode)
**Batch Size**: 4 images per request
**Rate Limit**: ~10 requests/hour (Midjourney "relaxed" mode)
**Concurrent Requests**: Supported (queued automatically)

## Security Considerations

⚠️ **Current Status**: No authentication implemented

**Recommendations**:
1. Add API key authentication
2. Implement rate limiting per client
3. Use HTTPS via reverse proxy
4. Whitelist N8N server IP
5. Add webhook signature verification

## Service Status

**Current Status**: ✅ Online
**Port**: 3002
**Public IP**: 46.250.232.188
**Process Manager**: PM2
**Auto-restart**: Enabled
**Uptime**: Monitored via PM2

### Check Service Status

```bash
# Via PM2
pm2 status midjourney-api

# Via Health Endpoint
curl http://46.250.232.188:3002/health
```

## Troubleshooting

### Service Not Responding

```bash
# Check PM2 status
pm2 status midjourney-api

# Restart service
pm2 restart midjourney-api

# View logs
pm2 logs midjourney-api --lines 100
```

### Authentication Issues

```bash
# Check Midjourney login status
curl http://localhost:3002/midjourney/status

# Re-initialize client
curl -X POST http://localhost:3002/midjourney/init
```

### Database Issues

- Check Supabase credentials in `/root/wowz-cloud-api/midjourney/.env`
- Verify `product_design` table exists
- Check `generated_designs_url` column is jsonb or text

## Support

**Service Location**: `/root/wowz-cloud-api/midjourney/`
**Configuration**: `/root/wowz-cloud-api/midjourney/.env`
**Logs**: `/root/wowz-cloud-api/midjourney/logs/`
**PM2 Logs**: `~/.pm2/logs/midjourney-api-*.log`

**Contact**: Check main README for support channels

---

**Last Updated**: 2025-11-20
**API Version**: 1.0.0
**Status**: Production Ready ✅
