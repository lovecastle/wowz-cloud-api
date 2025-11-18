# Unified Remix API Endpoint Documentation

## Overview

The `/api/remix` endpoint is a unified API that simplifies the image remixing workflow by handling all steps internally:
1. Upload image to Ideogram
2. Generate AI caption (optional)
3. Generate variations with custom settings
4. Poll for results
5. Download and store images in Supabase

Perfect for N8N integrations and external workflows.

---

## Endpoint: POST /api/remix

### URL
```
POST http://46.250.232.188:3000/api/remix
```

### Request Body

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "prompt": "",
  "idea_id": "optional-database-id",
  "imageWeight": 70,
  "magicPrompt": "AUTO",
  "style": "AUTO",
  "promptSource": "AUTO",
  "resolution": {
    "width": 800,
    "height": 1280
  },
  "num_images": 1
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `imageUrl` | string | ✅ Yes | - | URL of the image to remix |
| `prompt` | string | ❌ No | `""` | Custom prompt text. If empty and `promptSource` is "AUTO", AI will generate caption |
| `idea_id` | string | ❌ No | - | Database ID to track job in Supabase `product_design` table |
| `imageWeight` | number | ❌ No | `70` | How much the original image influences the result (0-100). Higher = more similar |
| `magicPrompt` | string | ❌ No | `"AUTO"` | Ideogram's Magic Prompt setting: `"AUTO"`, `"ON"`, `"OFF"` |
| `style` | string | ❌ No | `"AUTO"` | Style preset: `"AUTO"`, `"GENERAL"`, `"REALISTIC"`, `"DESIGN"`, `"3D"`, `"ANIME"` |
| `promptSource` | string | ❌ No | `"AUTO"` | `"AUTO"` = use AI caption, `"MANUAL"` = use provided prompt |
| `resolution` | object | ❌ No | `{width: 800, height: 1280}` | Output image dimensions |
| `num_images` | number | ❌ No | `1` | Number of variations to generate (1-4) |

---

## Response

### Immediate Response (Job Created)

The endpoint returns immediately with a job ID:

```json
{
  "success": true,
  "jobId": "ideogram-1234567890-abc123xyz",
  "message": "Job started. Processing in background."
}
```

### Job Processing

The actual image generation happens asynchronously in the background. Use the job status endpoint to check progress.

---

## Check Job Status: GET /api/job/:jobId

### URL
```
GET http://46.250.232.188:3000/api/job/{jobId}
```

### Example Request
```bash
curl http://46.250.232.188:3000/api/job/ideogram-1234567890-abc123xyz
```

### Response

```json
{
  "success": true,
  "jobId": "ideogram-1234567890-abc123xyz",
  "status": "completed",
  "createdAt": "2025-11-17T10:30:00.000Z",
  "updatedAt": "2025-11-17T10:32:15.000Z",
  "errorMessage": null,
  "images": [
    "https://vilyavgrknohxhfvvayc.supabase.co/storage/v1/object/public/product-ideas/ideogram-1234567890-abc123xyz/response-001.png"
  ],
  "isComplete": true,
  "isFailed": false,
  "isProcessing": false
}
```

### Job Status Values

- `pending` - Job created, waiting to start
- `processing` - Job is being processed
- `completed` - Job finished successfully, images available
- `failed` - Job failed, check `errorMessage`
- `timeout` - Job timed out (max 10 minutes)

---

## Usage Examples

### Example 1: Basic Usage with Auto Caption

```bash
curl -X POST http://46.250.232.188:3000/api/remix \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/design.jpg",
    "imageWeight": 70,
    "style": "DESIGN"
  }'
```

**What happens:**
1. Image is uploaded to Ideogram
2. AI generates a detailed caption
3. Generates 1 variation using the caption
4. Returns job ID immediately

---

### Example 2: With Custom Prompt

```bash
curl -X POST http://46.250.232.188:3000/api/remix \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/tshirt.jpg",
    "prompt": "Vintage t-shirt design with retro typography, distressed texture",
    "promptSource": "MANUAL",
    "imageWeight": 80,
    "magicPrompt": "ON",
    "style": "DESIGN",
    "num_images": 4
  }'
```

**What happens:**
1. Image is uploaded to Ideogram
2. Uses your provided prompt (skips AI caption)
3. Generates 4 variations with your prompt
4. Returns job ID immediately

---

### Example 3: High Resolution with Low Image Weight

```bash
curl -X POST http://46.250.232.188:3000/api/remix \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/logo.png",
    "prompt": "Modern minimalist logo design",
    "promptSource": "MANUAL",
    "imageWeight": 30,
    "style": "DESIGN",
    "resolution": {
      "width": 1024,
      "height": 1024
    }
  }'
```

---

## N8N Integration Example

### Simple N8N Workflow

```
Webhook → HTTP Request (POST /api/remix) → Wait → HTTP Request (GET /api/job/:jobId) → Continue
```

### N8N HTTP Request Node Configuration

**Step 1: Call /api/remix**

```javascript
{
  "method": "POST",
  "url": "http://46.250.232.188:3000/api/remix",
  "body": {
    "imageUrl": "{{ $json.imageUrl }}",
    "prompt": "{{ $json.prompt }}",
    "imageWeight": "{{ $json.imageWeight || 70 }}",
    "magicPrompt": "{{ $json.magicPrompt || 'AUTO' }}",
    "style": "{{ $json.style || 'AUTO' }}"
  }
}
```

**Step 2: Wait 30 seconds**

Add a Wait node with 30 second delay.

**Step 3: Check job status**

```javascript
{
  "method": "GET",
  "url": "http://46.250.232.188:3000/api/job/{{ $json.jobId }}"
}
```

**Step 4: Loop until complete**

Use an IF node to check `isComplete === true`, then either:
- Complete: Continue with result
- Not complete: Loop back to Wait node

---

## Understanding Parameters

### imageWeight (0-100)

Controls how much the output resembles the original image:

- **10-30**: Very loose interpretation, more creative freedom
- **40-60**: Balanced, keeps main elements but adds variation
- **70-90**: Strong resemblance, preserves most details
- **90-100**: Almost identical, minimal changes

### magicPrompt Options

- `"AUTO"`: Ideogram decides whether to enhance the prompt
- `"ON"`: Always enhance the prompt with additional details
- `"OFF"`: Use prompt exactly as provided

### style Options

- `"AUTO"`: Ideogram auto-detects best style
- `"GENERAL"`: Versatile style for general use
- `"REALISTIC"`: Photo-realistic rendering
- `"DESIGN"`: Optimized for graphic design/logos
- `"3D"`: 3D rendered look
- `"ANIME"`: Anime/manga style

### promptSource

- `"AUTO"`: If `prompt` is empty, generate AI caption. Otherwise use provided prompt.
- `"MANUAL"`: Always use the provided `prompt`, never generate caption.

---

## Workflow Timeline

```
0s   - POST /api/remix → Returns jobId immediately
0-3s - Upload image + Generate caption (if needed)
3-5s - Submit generation request to Ideogram
5s+  - Poll every 15 seconds for up to 10 minutes
      ↓
   When complete: Download images + Upload to Supabase
```

**Average completion time:** 30-90 seconds
**Maximum timeout:** 10 minutes

---

## Error Handling

### Common Errors

```json
// Invalid image URL
{
  "error": "imageUrl is required"
}

// Job not found
{
  "error": "Job not found",
  "jobId": "ideogram-123"
}

// Job failed
{
  "success": true,
  "status": "failed",
  "errorMessage": "Failed to upload image to Ideogram",
  "isFailed": true
}
```

### Best Practices

1. **Always check job status** after creating a job
2. **Implement polling** with 15-30 second intervals
3. **Set a timeout** (10 minutes recommended)
4. **Handle failures** gracefully with retry logic
5. **Validate imageUrl** before sending request

---

## Comparison with Other Endpoints

| Feature | `/api/remix` | `/api/generate-variations` | `/api/gencustom` |
|---------|--------------|---------------------------|------------------|
| Accepts imageUrl directly | ✅ Yes | ✅ Yes | ❌ No |
| Auto-generates caption | ✅ Yes | ✅ Yes | ❌ No |
| Custom prompt support | ✅ Yes | ⚠️ Limited | ✅ Yes |
| Returns jobId | ✅ Yes | ✅ Yes | ✅ Yes |
| Full control | ✅ Yes | ⚠️ Some | ✅ Yes |
| Best for | N8N/External | Quick variations | Advanced usage |

**Recommendation:** Use `/api/remix` for all new integrations.

---

## Support

For issues or questions, check the server logs:

```bash
# View logs
tail -f /path/to/server.log

# Search for specific job
grep "ideogram-1234567890" /path/to/server.log
```

Job logs include:
- `[jobId] Step 1: Uploading image...`
- `[jobId] Step 2: Generating AI caption...`
- `[jobId] Step 3: Generating variations...`
- `[jobId] Step 4: Polling for results...`
- `[jobId] Step 5: Downloading images...`
- `[jobId] ✓ Completed successfully`
