import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Service status
let healthStatus = {
  status: 'running',
  uptime: 0,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastRequest: null,
  lastError: null
};

const startTime = Date.now();

// Configuration
const EMAIL = process.env.GOOGLE_EMAIL || 'b10@khokho15.dpdns.org';
const PASSWORD = process.env.GOOGLE_PASSWORD || 'Az123456@';
const DOWNLOAD_ROOT = process.env.VEO_DOWNLOAD_DIR || path.resolve(__dirname, 'downloads');
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
const GEMINI_URL = 'https://gemini.google.com/u/1/app?hl=vi&pageId=none';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(DOWNLOAD_ROOT, { recursive: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

ensureDirectories();

// Job tracking
const jobs = new Map();

// Helper functions from original script
async function setDownloadBehavior(page) {
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_ROOT,
  });
}

async function login(page) {
  console.log('🔐 Logging in to Google...');
  await page.goto(
    'https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fgemini.google.com%2Fapp%3Fhl%3Dvi%26pageId%3Dnone&dsh=S-1859710577%3A1763113314026234&ec=GAZAkgU&flowEntry=ServiceLogin&flowName=GlifWebSignIn&followup=https%3A%2F%2Fgemini.google.com%2Fapp%3Fhl%3Dvi%26pageId%3Dnone&hl=vi&ifkv=ARESoU2UShxioi5RIaFtjVgt2kgfxX9wWEK_ckTt86Z97fapimMnoGHQmlz0ChSejdbf7UrpOpPe',
    { waitUntil: 'networkidle2', timeout: 60000 },
  );

  await page.setViewport({ width: 1200, height: 900 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.type('input[type="email"]', EMAIL, { delay: 25 });
  await page.keyboard.press('Enter');

  await page.waitForSelector('input[type="password"]', { visible: true, timeout: 60000 });
  await page.type('input[type="password"]', PASSWORD, { delay: 25 });
  await page.keyboard.press('Enter');

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
  console.log('✅ Login successful');
}

async function openGemini(page) {
  console.log('🌐 Navigating to Gemini / Veo...');
  await page.goto(GEMINI_URL, { waitUntil: 'networkidle2', timeout: 60000 });
}

async function acceptChromiumPrompt(page) {
  console.log('Checking for Chromium profile prompt...');
  try {
    await delay(2000);
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent?.toLowerCase(), button);
      if (text && (text.includes('tiếp tục là') || text.includes('continue as'))) {
        await button.click();
        await delay(1000);
        console.log('✅ Chromium profile prompt accepted');
        return;
      }
    }
  } catch (err) {
    console.warn('No Chromium prompt found');
  }
}

async function selectVeoTool(page) {
  console.log('🎬 Opening Veo tool...');
  await delay(1500);

  const buttons = await page.$$('button');
  let toolsButton = null;
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent, button);
    if (text && text.includes('Công cụ')) {
      toolsButton = button;
      break;
    }
  }

  if (!toolsButton) {
    throw new Error('Tools button not found');
  }
  await toolsButton.click();

  await delay(500);

  const allButtons = await page.$$('button');
  let veoOption = null;
  for (const button of allButtons) {
    const text = await page.evaluate(el => el.textContent, button);
    if (text && text.includes('Tạo video bằng Veo')) {
      veoOption = button;
      break;
    }
  }

  if (!veoOption) {
    throw new Error('Veo option not found');
  }
  await veoOption.click();
  await page.waitForSelector('[role="textbox"], textarea, input[type="text"]', { timeout: 60000 });
  console.log('✅ Veo tool selected');
}

async function submitPrompt(page, prompt, jobId) {
  console.log(`📝 Submitting prompt for job ${jobId}...`);

  await delay(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${jobId}-1-ready.png`) });

  const inputHandle = await page.waitForSelector('[role="textbox"], textarea, input[type="text"]', {
    visible: true,
    timeout: 60000,
  });

  await inputHandle.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await delay(500);
  await inputHandle.type(prompt, { delay: 80 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${jobId}-2-typed.png`) });

  await page.keyboard.press('Enter');
  await delay(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${jobId}-3-submitted.png`) });
  console.log('✅ Prompt submitted');
}

async function waitForVideoAndDownload(page, jobId) {
  console.log(`⏳ Waiting for video generation (job ${jobId})...`);

  let attempts = 0;
  const maxAttempts = 60; // 10 minutes

  while (attempts < maxAttempts) {
    attempts++;
    await delay(10000);

    console.log(`Check ${attempts}/${maxAttempts} - Looking for video...`);

    const video = await page.$('video');
    if (video) {
      console.log('✅ Video found!');
      await delay(3000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${jobId}-4-ready.png`) });
      break;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Timeout: Video did not appear after 10 minutes');
    }
  }

  console.log('🎥 Looking for download button...');
  await delay(2000);

  let downloadButton = await page.$('button[aria-label*="Tải video xuống"]');

  if (!downloadButton) {
    const allButtons = await page.$$('button, a');
    for (const button of allButtons) {
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label')?.toLowerCase() || '', button);
      if (ariaLabel.includes('tải video xuống') || ariaLabel.includes('download')) {
        downloadButton = button;
        break;
      }
    }
  }

  if (!downloadButton) {
    throw new Error('Download button not found');
  }

  console.log('⬇️ Downloading video...');
  await downloadButton.click();
  await delay(5000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${jobId}-5-downloaded.png`) });

  await delay(30000); // Wait for download to complete

  // Find the downloaded video file
  const files = await fs.readdir(DOWNLOAD_ROOT);
  const videoFiles = files.filter(f => f.endsWith('.mp4') || f.endsWith('.webm'));

  if (videoFiles.length === 0) {
    throw new Error('No video file found in downloads directory');
  }

  // Return the most recent file
  const sortedFiles = videoFiles.sort((a, b) => {
    const aPath = path.join(DOWNLOAD_ROOT, a);
    const bPath = path.join(DOWNLOAD_ROOT, b);
    return fs.stat(bPath).then(bStat =>
      fs.stat(aPath).then(aStat => bStat.mtimeMs - aStat.mtimeMs)
    );
  });

  return path.join(DOWNLOAD_ROOT, sortedFiles[0]);
}

// Background job processor
async function processVideoGeneration(jobId, prompt) {
  const job = jobs.get(jobId);
  if (!job) return;

  let browser;

  try {
    job.status = 'processing';
    job.startedAt = new Date().toISOString();

    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: false,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await setDownloadBehavior(page);

    await login(page);
    await openGemini(page);
    await acceptChromiumPrompt(page);
    await selectVeoTool(page);
    await submitPrompt(page, prompt, jobId);
    const videoPath = await waitForVideoAndDownload(page, jobId);

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.videoPath = videoPath;
    job.videoUrl = `/veo3/download/${path.basename(videoPath)}`;

    healthStatus.successfulRequests++;
    console.log(`✅ Job ${jobId} completed successfully`);

  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date().toISOString();

    healthStatus.failedRequests++;
    console.error(`❌ Job ${jobId} failed:`, error.message);

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// API Endpoints

// Health check
app.get('/health', (req, res) => {
  healthStatus.uptime = Math.floor((Date.now() - startTime) / 1000);
  const successRate = healthStatus.totalRequests > 0
    ? ((healthStatus.successfulRequests / healthStatus.totalRequests) * 100).toFixed(2)
    : 0;

  res.json({
    ...healthStatus,
    successRate: parseFloat(successRate),
    timestamp: new Date().toISOString()
  });
});

// Generate video
app.post('/veo3/generate', async (req, res) => {
  healthStatus.totalRequests++;
  healthStatus.lastRequest = new Date().toISOString();

  try {
    const { prompt, image_url } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
        timestamp: new Date().toISOString()
      });
    }

    // Generate job ID
    const jobId = `veo3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create job
    jobs.set(jobId, {
      jobId,
      prompt,
      image_url: image_url || null,
      status: 'queued',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      videoPath: null,
      videoUrl: null,
      error: null
    });

    console.log(`🎬 New video generation job: ${jobId}`);
    console.log(`📝 Prompt: ${prompt}`);
    if (image_url) {
      console.log(`🖼️ Image: ${image_url}`);
    }

    // Start background processing
    processVideoGeneration(jobId, prompt).catch(err => {
      console.error(`Job ${jobId} processing error:`, err);
    });

    res.json({
      success: true,
      jobId,
      message: 'Video generation started',
      estimatedTime: '2-10 minutes',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    healthStatus.failedRequests++;
    healthStatus.lastError = error.message;

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check job status
app.get('/veo3/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    ...job,
    timestamp: new Date().toISOString()
  });
});

// Download video
app.get('/veo3/download/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(DOWNLOAD_ROOT, filename);

  try {
    await fs.access(filePath);
    res.download(filePath);
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'File not found',
      timestamp: new Date().toISOString()
    });
  }
});

// List all jobs
app.get('/veo3/jobs', (req, res) => {
  const allJobs = Array.from(jobs.values());
  res.json({
    success: true,
    count: allJobs.length,
    jobs: allJobs,
    timestamp: new Date().toISOString()
  });
});

// API documentation
app.get('/', (req, res) => {
  res.json({
    service: 'Veo3 Video Generation API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      generate: 'POST /veo3/generate',
      jobStatus: 'GET /veo3/job/:jobId',
      download: 'GET /veo3/download/:filename',
      listJobs: 'GET /veo3/jobs'
    },
    documentation: 'https://github.com/lovecastle/wowz-cloud-api'
  });
});

app.listen(PORT, () => {
  console.log(`🎬 Veo3 Video Generation API`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 API docs: http://localhost:${PORT}/`);
});
