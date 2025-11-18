# Ideogram API Server

A Node.js Express API server that provides a programmatic interface to Ideogram.ai's image generation and manipulation capabilities using Puppeteer automation.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server (runs on port 3000)
npm start
```

Server will run at: `http://localhost:3000`

---

## ⭐ NEW: Unified Remix Endpoint (Recommended for N8N)

The `/api/remix` endpoint is a simplified, all-in-one solution perfect for N8N workflows!

### Quick Example

```bash
curl -X POST http://localhost:3000/api/remix \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "imageWeight": 70,
    "style": "DESIGN"
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "ideogram-1234567890-abc",
  "message": "Job started. Processing in background."
}
```

**Check Status:**
```bash
curl http://localhost:3000/api/job/ideogram-1234567890-abc
```

📖 **[View Full Documentation](./API-REMIX-ENDPOINT.md)** for complete details on all parameters and options.

---

## 🔌 N8N Integration

### Import Pre-Built Workflow

Use the ready-made N8N workflow: **[N8N-SIMPLE-WORKFLOW.json](./N8N-SIMPLE-WORKFLOW.json)**

This workflow handles:
1. ✅ Receives webhook with image URL
2. ✅ Calls `/api/remix` endpoint
3. ✅ Polls job status automatically
4. ✅ Returns results when complete

### Request Format

Your application should send this to N8N webhook:

```json
{
  "imageUrl": "https://your-supabase.co/.../image.jpg",
  "prompt": "",
  "imageWeight": 70,
  "magicPrompt": "AUTO",
  "style": "AUTO",
  "promptSource": "AUTO"
}
```

---

## 📋 All Available Endpoints

| Endpoint | Method | Description | Best For |
|----------|--------|-------------|----------|
| `/api/remix` | POST | **🆕 Unified endpoint** - All-in-one solution | N8N, External APIs |
| `/api/job/:jobId` | GET | Check job status | Monitoring |
| `/api/upload` | POST | Upload image only | Multi-step workflows |
| `/api/caption` | POST | Get AI caption | Getting descriptions |
| `/api/generate-variations` | POST | Generate variations (async) | Standard remixing |
| `/api/gencustom` | POST | Full control generation | Advanced users |
| `/api/upscale` | POST | Upscale images | Quality improvement |
| `/api/removebackground` | POST | Remove backgrounds | Background removal |
| `/api/genimageprompt` | POST | Text-to-image | Prompt-only generation |

---

## 💡 Common Use Cases

### 1. T-Shirt Design Remixing (Your Use Case)

```javascript
POST /api/remix
{
  "imageUrl": "https://supabase.co/.../tshirt.jpg",
  "imageWeight": 75,
  "style": "DESIGN",
  "num_images": 1
}
```

### 2. Batch Process Multiple Designs

```javascript
const jobs = await Promise.all(
  urls.map(url =>
    fetch('/api/remix', {
      body: JSON.stringify({ imageUrl: url })
    })
  )
);
```

### 3. Custom Prompt Control

```javascript
POST /api/remix
{
  "imageUrl": "https://example.com/logo.png",
  "prompt": "Modern minimalist logo, flat design",
  "promptSource": "MANUAL",
  "imageWeight": 30,
  "magicPrompt": "OFF"
}
```

---

## ⚙️ Configuration

### Environment Variables

```bash
PORT=3000
CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Supabase Settings

Update in `server.js` (lines 11-12) or use environment variables (recommended):

```javascript
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
```

---

## 🔍 Job Status Tracking

Jobs are stored in Supabase `product_design` table:

**Job Statuses:**
- `pending` → Job created, waiting
- `processing` → Currently working
- `completed` → ✅ Done! Images available
- `failed` → ❌ Error occurred
- `timeout` → ⏱️ Took too long (10+ min)

**Check any job:**
```bash
GET /api/job/{jobId}
```

---

## 📊 Monitoring & Logs

Server logs show detailed progress:

```
[ideogram-123] Step 1: Uploading image...
[ideogram-123] Upload successful. Upload ID: xyz
[ideogram-123] Step 2: Generating AI caption...
[ideogram-123] Step 3: Generating variations...
[ideogram-123] Step 4: Polling for results...
[ideogram-123] ✓ Completed successfully with 1 images
```

Search logs:
```bash
grep "ideogram-123" server.log
```

---

## 🐛 Troubleshooting

**"Failed to upload image"**
- ✓ Check if imageUrl is accessible
- ✓ Verify image format (PNG, JPG)
- ✓ Ensure token is valid

**"Timeout after 10 minutes"**
- ✓ Try with fewer `num_images`
- ✓ Check Ideogram service status
- ✓ Retry the request

**"Job not found"**
- ✓ Verify jobId is correct
- ✓ Check Supabase connection
- ✓ Ensure `idea_id` exists in database

---

## 🔐 Security (Production)

⚠️ **For production, implement:**

1. **Environment Variables** for secrets
2. **API Key Authentication**
3. **Rate Limiting**
4. **CORS Restrictions**

Example:
```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// API Key
app.use('/api', (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

---

## 📈 Performance Tips

- Use `num_images: 1` for faster results
- Lower `imageWeight` for more creativity (faster)
- Set `magicPrompt: "OFF"` to skip enhancement
- Use smaller resolutions for quick generation

**Average Times:**
- Image upload: 2-3 seconds
- AI caption: 3-5 seconds
- Generation: 30-90 seconds
- Total: ~40-100 seconds

---

## 📚 Documentation Files

- **[API-REMIX-ENDPOINT.md](./API-REMIX-ENDPOINT.md)** - Complete `/api/remix` docs
- **[N8N-SIMPLE-WORKFLOW.json](./N8N-SIMPLE-WORKFLOW.json)** - Import to N8N
- **[server.js](./server.js)** - Main server code

---

## 🎯 Recommendations

✅ **Use `/api/remix`** for N8N integrations (simplest)
✅ **Use `/api/gencustom`** for advanced control
✅ **Always poll job status** - don't assume instant completion
✅ **Check server logs** when debugging
✅ **Start with `num_images: 1`** for testing

---

**Status**: ✅ Active
**Version**: 1.0.0
**Updated**: 2025-11-17
