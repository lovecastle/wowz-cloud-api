# N8N Workflow: Veo3 Video Generation

## Simple Workflow

### Step 1: HTTP Request - Generate Video

**Node**: HTTP Request
**Method**: POST
**URL**: `http://46.250.232.188:3003/veo3/generate`

**Headers**:
```json
{
  "Content-Type": "application/json"
}
```

**Body**:
```json
{
  "prompt": "{{$json.prompt}}"
}
```

**Example Input**:
```json
{
  "prompt": "A serene sunset over calm ocean waves, cinematic 4K"
}
```

---

### Step 2: Wait - Allow Processing Time

**Node**: Wait
**Time**: 3 minutes
**Resume On**: Timer

---

### Step 3: Code Node - Poll Until Complete

**Node**: Code
**Language**: JavaScript

```javascript
const jobId = $input.first().json.jobId;
const baseUrl = 'http://46.250.232.188:3003';

// Poll for completion
let status = 'processing';
let attempts = 0;
const maxAttempts = 60; // 10 minutes

while (status === 'processing' && attempts < maxAttempts) {
  // Wait 10 seconds between checks
  await new Promise(resolve => setTimeout(resolve, 10000));

  const response = await this.helpers.request({
    method: 'GET',
    url: `${baseUrl}/veo3/job/${jobId}`,
    json: true
  });

  status = response.status;
  attempts++;

  console.log(`Check ${attempts}/${maxAttempts}: Status = ${status}`);

  if (status === 'completed') {
    return [{
      json: {
        success: true,
        ...response
      }
    }];
  }

  if (status === 'failed') {
    throw new Error(response.error || 'Video generation failed');
  }
}

throw new Error('Timeout: Video generation took too long');
```

---

### Step 4: HTTP Request - Download Video

**Node**: HTTP Request
**Method**: GET
**URL**: `http://46.250.232.188:3003{{$json.videoUrl}}`
**Response Format**: File

**Options**:
- Download: true
- Response Type: arraybuffer

---

### Step 5: Move Binary Data (Optional)

**Node**: Move Binary Data
**Mode**: JSON to Binary
**Source Key**: data
**Destination Key**: video

---

## Alternative: Single Code Node Workflow

This approach handles everything in one node:

```javascript
// Configuration
const baseUrl = 'http://46.250.232.188:3003';
const prompt = $input.first().json.prompt;

// Step 1: Generate video
console.log('Starting video generation...');
const generateResponse = await this.helpers.request({
  method: 'POST',
  url: `${baseUrl}/veo3/generate`,
  body: { prompt },
  json: true
});

const jobId = generateResponse.jobId;
console.log(`Job created: ${jobId}`);

// Step 2: Poll for completion
let status = 'processing';
let attempts = 0;
const maxAttempts = 60;
let jobData;

console.log('Waiting for video generation...');

while (status === 'processing' && attempts < maxAttempts) {
  await new Promise(resolve => setTimeout(resolve, 10000));

  jobData = await this.helpers.request({
    method: 'GET',
    url: `${baseUrl}/veo3/job/${jobId}`,
    json: true
  });

  status = jobData.status;
  attempts++;

  console.log(`Check ${attempts}/${maxAttempts}: ${status}`);

  if (status === 'failed') {
    throw new Error(jobData.error || 'Video generation failed');
  }
}

if (status !== 'completed') {
  throw new Error('Timeout: Video generation took too long');
}

// Step 3: Download video
console.log('Downloading video...');
const videoBuffer = await this.helpers.request({
  method: 'GET',
  url: `${baseUrl}${jobData.videoUrl}`,
  encoding: null
});

// Return with binary data
return [{
  json: {
    success: true,
    jobId: jobId,
    prompt: prompt,
    completedAt: jobData.completedAt,
    videoUrl: jobData.videoUrl
  },
  binary: {
    video: {
      data: videoBuffer.toString('base64'),
      mimeType: 'video/mp4',
      fileName: `veo-${jobId}.mp4`,
      fileExtension: 'mp4'
    }
  }
}];
```

---

## Production Workflow with Error Handling

```javascript
const baseUrl = 'http://46.250.232.188:3003';
const prompt = $input.first().json.prompt || 'A beautiful landscape';
const maxWaitTime = 10 * 60 * 1000; // 10 minutes
const checkInterval = 10000; // 10 seconds

try {
  // Generate video
  const generateResp = await this.helpers.request({
    method: 'POST',
    url: `${baseUrl}/veo3/generate`,
    body: { prompt },
    json: true,
    timeout: 30000
  });

  if (!generateResp.success) {
    throw new Error('Failed to start video generation');
  }

  const jobId = generateResp.jobId;
  console.log(`✅ Job created: ${jobId}`);

  // Poll for completion
  const startTime = Date.now();
  let jobData;

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));

    try {
      jobData = await this.helpers.request({
        method: 'GET',
        url: `${baseUrl}/veo3/job/${jobId}`,
        json: true,
        timeout: 10000
      });
    } catch (err) {
      console.warn('Status check failed, retrying...', err.message);
      continue;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️  ${elapsed}s - Status: ${jobData.status}`);

    if (jobData.status === 'completed') {
      console.log('✅ Video generation completed!');
      break;
    }

    if (jobData.status === 'failed') {
      throw new Error(`Generation failed: ${jobData.error}`);
    }
  }

  if (!jobData || jobData.status !== 'completed') {
    throw new Error('Timeout: Video took too long to generate');
  }

  // Download video
  console.log('⬇️  Downloading video...');
  const videoBuffer = await this.helpers.request({
    method: 'GET',
    url: `${baseUrl}${jobData.videoUrl}`,
    encoding: null,
    timeout: 60000
  });

  const fileSize = (videoBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`✅ Downloaded ${fileSize} MB`);

  return [{
    json: {
      success: true,
      jobId: jobId,
      prompt: prompt,
      duration: Math.round((Date.now() - startTime) / 1000),
      fileSize: `${fileSize} MB`,
      completedAt: jobData.completedAt
    },
    binary: {
      video: {
        data: videoBuffer.toString('base64'),
        mimeType: 'video/mp4',
        fileName: `veo3-${Date.now()}.mp4`,
        fileExtension: 'mp4'
      }
    }
  }];

} catch (error) {
  console.error('❌ Error:', error.message);

  return [{
    json: {
      success: false,
      error: error.message,
      prompt: prompt,
      timestamp: new Date().toISOString()
    }
  }];
}
```

---

## Workflow Tips

### 1. Prompt Optimization

**Good prompts:**
- Include camera movement: "camera slowly panning"
- Specify quality: "cinematic 4K quality"
- Add lighting: "golden hour lighting"
- Describe motion: "slow motion", "time-lapse"

**Example:**
```
"A majestic eagle soaring through mountain valleys at golden hour,
camera tracking smoothly from behind, cinematic 4K quality with
dramatic lighting and cloud shadows"
```

### 2. Timeout Handling

Adjust `maxAttempts` based on prompt complexity:
- Simple scenes: 30 attempts (5 minutes)
- Complex scenes: 60 attempts (10 minutes)
- Very complex: 90 attempts (15 minutes)

### 3. Error Recovery

Add retry logic for network errors:

```javascript
async function requestWithRetry(options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.helpers.request(options);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
```

### 4. Batch Processing

Process multiple prompts sequentially:

```javascript
const prompts = $input.all().map(item => item.json.prompt);
const results = [];

for (const prompt of prompts) {
  console.log(`Processing: ${prompt}`);
  // ... generation logic ...
  results.push(result);
}

return results;
```

---

## Webhook Integration

To receive notifications when video is ready:

### Setup Webhook Endpoint

**N8N Webhook Node:**
- Method: POST
- Path: `/webhook/veo3-complete`

### Modify Veo3 Service

Add webhook notification to `veo3/server.js`:

```javascript
// After video completion
if (job.webhookUrl) {
  await axios.post(job.webhookUrl, {
    jobId: job.jobId,
    status: 'completed',
    videoUrl: job.videoUrl,
    completedAt: job.completedAt
  });
}
```

### N8N Workflow

```
[HTTP Request: Generate] → [Webhook: Wait for Complete] → [Download]
```

---

## Storage Integration

### Save to Supabase

```javascript
// After downloading video
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

const fileName = `videos/veo3-${jobId}.mp4`;
const { data, error } = await supabase.storage
  .from('videos')
  .upload(fileName, videoBuffer, {
    contentType: 'video/mp4'
  });

if (error) throw error;

const { data: publicUrlData } = supabase.storage
  .from('videos')
  .getPublicUrl(fileName);

console.log('Video URL:', publicUrlData.publicUrl);
```

### Save to Google Drive

Use N8N Google Drive node after download step.

---

## Testing Workflow

### Test Prompt

```json
{
  "prompt": "A cat playing with a ball of yarn in slow motion, soft lighting"
}
```

### Expected Timeline

1. **0:00** - Request sent, jobId received
2. **0:10** - First status check (processing)
3. **2:00** - Video generation in progress
4. **3:30** - Video completed
5. **3:35** - Video downloaded
6. **3:40** - Workflow complete

### Debug Checklist

- [ ] Service running on port 3003
- [ ] Google credentials valid
- [ ] Gemini access enabled
- [ ] Network connectivity OK
- [ ] Sufficient disk space
- [ ] Browser automation working

---

**Last Updated**: 2025-11-21
**Workflow Version**: 1.0.0
