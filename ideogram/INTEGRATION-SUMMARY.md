# N8N Integration Summary

## ✅ What Was Created

### 1. New Unified Endpoint: `/api/remix`
**Location:** `server.js` (lines 516-789)

A single endpoint that handles everything:
- ✅ Upload image from URL
- ✅ Generate AI caption (optional)
- ✅ Create variations with custom settings
- ✅ Background processing with job tracking
- ✅ Auto-save results to Supabase

**Why it's better:**
- No need to call multiple endpoints
- Automatic polling and result storage
- Perfect for N8N workflows

### 2. Job Status Endpoint: `/api/job/:jobId`
**Location:** `server.js` (lines 791-841)

Check job progress and get results:
```bash
GET /api/job/ideogram-1234567890-abc
```

Returns:
- Job status (pending/processing/completed/failed)
- Result images (when complete)
- Error messages (if failed)

---

## 🔌 How to Use with N8N

### Option 1: Import Pre-Built Workflow (Easiest)

1. Open N8N
2. Import **[N8N-SIMPLE-WORKFLOW.json](./N8N-SIMPLE-WORKFLOW.json)**
3. Update the server URL if needed
4. Test with your image URL

### Option 2: Manual Setup

**Step 1: Webhook Node**
- Method: POST
- Path: `ideogram-remix`

**Step 2: HTTP Request - Start Job**
```
POST http://46.250.232.188:3000/api/remix
Body: {
  "imageUrl": "{{ $json.body.imageUrl }}",
  "imageWeight": {{ $json.body.imageWeight || 70 }},
  "style": "{{ $json.body.style || 'AUTO' }}",
  "magicPrompt": "{{ $json.body.magicPrompt || 'AUTO' }}"
}
```

**Step 3: Wait 30s**

**Step 4: HTTP Request - Check Status**
```
GET http://46.250.232.188:3000/api/job/{{ $('Start Job').json.jobId }}
```

**Step 5: IF Node**
- Condition: `{{ $json.isComplete }}` equals `true`
- True: Return results
- False: Wait 15s and loop back to Step 4

---

## 📋 Request Format from Your App

Your application should send this to the N8N webhook:

```json
{
  "imageUrl": "https://vilyavgrknohxhfvvayc.supabase.co/storage/v1/object/public/product-ideas/22115bd6/1750317478540-uploaded-il_fullxfull.jpg",
  "prompt": "",
  "imageWeight": 70,
  "magicPrompt": "AUTO",
  "style": "AUTO",
  "promptSource": "AUTO"
}
```

**Parameters explained:**
- `imageUrl` (required): URL of the image to remix
- `prompt` (optional): Custom description. Leave empty for AI caption
- `imageWeight` (0-100): How similar to original (70 = recommended)
- `magicPrompt`: "AUTO", "ON", or "OFF"
- `style`: "AUTO", "DESIGN", "REALISTIC", "3D", etc.
- `promptSource`: "AUTO" (use AI if prompt empty) or "MANUAL" (always use prompt)

---

## 🎯 Comparison: Old vs New Workflow

### ❌ Old Complex Workflow
```
1. Your App → N8N Webhook
2. N8N → Resize Image
3. N8N → AI Caption (Gemini/OpenAI)
4. N8N → Fix Prompt (escape characters)
5. N8N → Upload Image (/api/upload)
6. N8N → Generate Caption (/api/caption)
7. N8N → Generate Custom (/api/gencustom)
8. N8N → Wait & Poll
9. N8N → Multiple conditional checks
10. N8N → Return results
```

**Issues:**
- Too many steps
- Duplicate AI captioning
- Complex prompt escaping
- Hard to debug
- Multiple API calls

### ✅ New Simple Workflow
```
1. Your App → N8N Webhook
2. N8N → Call /api/remix (one request)
3. N8N → Wait 30s
4. N8N → Check status (loop until done)
5. N8N → Return results
```

**Benefits:**
- ✅ 5 steps instead of 10+
- ✅ One API call to start job
- ✅ No prompt escaping needed
- ✅ Server handles everything
- ✅ Easy to debug (check server logs)
- ✅ Automatic result storage

---

## 📊 Expected Timeline

**Fast job (simple image, low weight):**
```
0s    - POST /api/remix → jobId returned immediately
0-3s  - Upload image
3-5s  - AI caption
5-40s - Generation
40s   - Results ready
```

**Typical job:**
```
0s     - POST /api/remix → jobId returned
0-3s   - Upload
3-5s   - Caption
5-90s  - Generation
~60s   - Results ready
```

**Slow job (complex image, high quality):**
```
0s      - POST /api/remix → jobId returned
0-3s    - Upload
3-5s    - Caption
5-180s  - Generation (up to 3 minutes)
~120s   - Results ready
```

**Maximum timeout:** 10 minutes (job will fail)

---

## 🔍 Debugging

### Check Server Logs

Jobs log every step:
```bash
[ideogram-1234567890-abc] Step 1: Uploading image from URL...
[ideogram-1234567890-abc] Upload successful. Upload ID: xyz123
[ideogram-1234567890-abc] Step 2: Generating AI caption...
[ideogram-1234567890-abc] AI Caption generated: A vintage t-shirt...
[ideogram-1234567890-abc] Step 3: Generating variations...
[ideogram-1234567890-abc] Settings: imageWeight=70, style=AUTO
[ideogram-1234567890-abc] Step 4: Polling for results...
[ideogram-1234567890-abc] Polling attempt 1/40
[ideogram-1234567890-abc] Polling attempt 2/40
[ideogram-1234567890-abc] Step 5: Downloading 1 images...
[ideogram-1234567890-abc] ✓ Completed successfully with 1 images
```

### Check Job Status Anytime

```bash
curl http://46.250.232.188:3000/api/job/ideogram-1234567890-abc
```

Response shows:
- Current status
- Created/updated timestamps
- Error message (if failed)
- Result image URLs (if completed)

---

## 🚀 Quick Test

### Test from Command Line

```bash
# Start a job
curl -X POST http://46.250.232.188:3000/api/remix \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://vilyavgrknohxhfvvayc.supabase.co/storage/v1/object/public/product-ideas/22115bd6/1750317478540-uploaded-il_fullxfull.jpg",
    "imageWeight": 70,
    "style": "DESIGN"
  }'

# Copy the jobId from response, then check status:
curl http://46.250.232.188:3000/api/job/YOUR_JOB_ID_HERE
```

### Test from N8N

1. Import the workflow
2. Activate it
3. Get the webhook URL
4. Send a POST request:

```bash
curl -X POST https://your-n8n.com/webhook/ideogram-remix \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "imageWeight": 70
  }'
```

---

## 📝 Next Steps

1. ✅ **Import N8N workflow** from `N8N-SIMPLE-WORKFLOW.json`
2. ✅ **Update your application** to send requests to N8N webhook
3. ✅ **Test with a sample image** to verify everything works
4. ✅ **Monitor server logs** to see job progress
5. ✅ **Adjust parameters** (imageWeight, style) based on results

---

## 💡 Tips for Best Results

**For similar designs (remixing):**
- Use `imageWeight: 70-85`
- Use `style: "DESIGN"`
- Leave `promptSource: "AUTO"` for AI caption

**For creative variations:**
- Use `imageWeight: 30-50`
- Use `style: "AUTO"`
- Use `magicPrompt: "ON"`

**For exact replicas with small changes:**
- Use `imageWeight: 90-95`
- Use `magicPrompt: "OFF"`
- Provide specific `prompt`

**For faster results:**
- Use `num_images: 1`
- Use smaller `resolution`
- Use `magicPrompt: "OFF"`

---

## 📚 Documentation Files

1. **[README.md](./README.md)** - Main documentation
2. **[API-REMIX-ENDPOINT.md](./API-REMIX-ENDPOINT.md)** - Complete API reference
3. **[N8N-SIMPLE-WORKFLOW.json](./N8N-SIMPLE-WORKFLOW.json)** - Import to N8N
4. **[INTEGRATION-SUMMARY.md](./INTEGRATION-SUMMARY.md)** - This file

---

## ✅ Summary

**What changed:**
- ✅ Added `/api/remix` - single endpoint for everything
- ✅ Added `/api/job/:jobId` - check job status anytime
- ✅ Created simple N8N workflow (5 steps vs 10+)
- ✅ Automatic background processing
- ✅ Better error handling and logging

**What you need to do:**
1. Import N8N workflow
2. Update app to send to N8N webhook
3. Test and monitor

**Result:**
- Simpler integration
- Easier debugging
- Faster development
- More reliable processing

---

**Questions?** Check the logs or API documentation!
