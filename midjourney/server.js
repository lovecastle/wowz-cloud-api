require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const PuppeteerMidjourneyAPI = require('./puppeteer-client.js');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let client = null;
let isInitializing = false;
let healthStatus = {
  status: 'stopped',
  uptime: 0,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastRequest: null,
  lastError: null
};

// ==== Supabase Admin Client (Service Role) ====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'product-designs';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY chưa được thiết lập. Upload/DB update sẽ không hoạt động.');
}

const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

async function uploadToSupabase(ideaId, idx, buffer, contentType = 'image/png') {
  if (!supabaseAdmin) throw new Error('Supabase admin client chưa được cấu hình');
  const ts = Date.now();
  const filePath = `product_design/${ideaId}/generated_${ts}_${idx}.png`;
  const { error: upErr } = await supabaseAdmin.storage.from(SUPABASE_BUCKET).upload(filePath, buffer, {
    contentType,
    upsert: false
  });
  if (upErr) throw upErr;
  const { data: publicData } = supabaseAdmin.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath);
  return publicData.publicUrl;
}

async function appendGeneratedDesignUrl(ideaId, imageUrl) {
  if (!supabaseAdmin) throw new Error('Supabase admin client chưa được cấu hình');
  const { data, error } = await supabaseAdmin
    .from('product_design')
    .select('generated_designs_url')
    .eq('id', ideaId)
    .single();
  if (error) throw error;

  let list = [];
  if (data && data.generated_designs_url) {
    try {
      if (Array.isArray(data.generated_designs_url)) {
        list = data.generated_designs_url;
      } else if (typeof data.generated_designs_url === 'string') {
        list = JSON.parse(data.generated_designs_url);
      }
    } catch (_) {
      list = [];
    }
  }
  list.push(imageUrl);

// Validate trước khi update
if (!ideaId || typeof ideaId !== 'string') {
    throw new Error('Missing ideaId for DB update');
  }
  
  const { error: updErr } = await supabaseAdmin
    .from('product_design')
    .update({ 
      generated_designs_url: JSON.stringify(list),
      job_status: 'completed',
      job_updated_at: new Date().toISOString()
    })
    .eq('id', ideaId); // <- thêm WHERE ở đây
  if (updErr) throw updErr;
}

// ==== Background Poll Jobs ====
const jobs = new Map(); // jobId -> { ideaId, userId, batchSize, found: Set<number>, attempts: number, timer }

function startPollingJob(jobId, ideaId, userId, batchSize = 4) {
  const maxImages = Math.min(Number(batchSize) || 4, 4);
  const state = {
    ideaId,
    userId: userId || null,
    batchSize: maxImages,
    found: new Set(),
    attempts: 0,
    timer: null
  };
  jobs.set(jobId, state);

  const intervalMs = 15000; // 15s
  const maxAttempts = 24;   // ~6 phút

  async function attemptOnce() {
    state.attempts += 1;
    console.log(`[Poll] job ${jobId} attempt ${state.attempts}/${maxAttempts}`);
    
    // Update job_updated_at to show job is still active
    if (supabaseAdmin && state.ideaId) {
      try {
        const updateTime = new Date().toISOString();
        console.log(`[Poll] Updating job_updated_at for idea ${state.ideaId}: ${updateTime}`);
        
        const { error } = await supabaseAdmin
          .from('product_design')
          .update({ 
            job_updated_at: updateTime
          })
          .eq('id', state.ideaId);
          
        if (error) {
          console.error('❌ Error updating job_updated_at:', error.message);
        } else {
          console.log(`✅ Successfully updated job_updated_at for idea ${state.ideaId}`);
        }
      } catch (dbError) {
        console.error('❌ Error updating job_updated_at:', dbError.message);
      }
    } else {
      console.log(`[Poll] Skipping job_updated_at update - supabaseAdmin: ${!!supabaseAdmin}, ideaId: ${state.ideaId}`);
    }
    
    if (!client || healthStatus.status !== 'running') {
      await initializeClient();
    }
    for (let idx = 0; idx < state.batchSize; idx++) {
      if (state.found.has(idx)) continue;
      const cdnUrl = `https://cdn.midjourney.com/${jobId}/0_${idx}.png`;
      const cb = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const urlWithCb = `${cdnUrl}?cb=${cb}`;
      try {
        const { buffer, contentType } = await client.downloadImageViaBrowser(urlWithCb);
        if (buffer && buffer.length > 0) {
          // Upload and update DB
          try {
            const publicUrl = await uploadToSupabase(ideaId, idx, buffer, contentType || 'image/png');
            await appendGeneratedDesignUrl(ideaId, publicUrl);
            state.found.add(idx);
            console.log(`[Poll] Stored image idx=${idx} for job ${jobId} at ${publicUrl}`);
        } catch (storeErr) {
          console.error('[Poll] Store error:', storeErr.message);
          // Update job status to 'failed' when storage fails
          if (supabaseAdmin && ideaId) {
            try {
              await supabaseAdmin
                .from('product_design')
                .update({ 
                  job_status: 'failed',
                  error_message: `Storage error: ${storeErr.message}`,
                  job_updated_at: new Date().toISOString()
                })
                .eq('id', ideaId);
              console.log('✅ Updated job status to failed due to storage error for idea:', ideaId);
            } catch (dbError) {
              console.error('❌ Error updating job status to failed:', dbError.message);
            }
          }
        }
        }
      } catch (err) {
        // Not ready yet or network error; skip
      }
    }

    if (state.found.size >= state.batchSize || state.attempts >= maxAttempts) {
      clearInterval(state.timer);
      jobs.delete(jobId);
      console.log(`[Poll] Finished job ${jobId}. Found ${state.found.size}/${state.batchSize}`);
      
      // Update job status to 'timeout' if no images found after max attempts
      if (state.found.size === 0 && state.attempts >= maxAttempts) {
        if (supabaseAdmin && state.ideaId) {
          try {
            await supabaseAdmin
              .from('product_design')
              .update({ 
                job_status: 'timeout',
                error_message: 'Job timeout after maximum attempts',
                job_updated_at: new Date().toISOString()
              })
              .eq('id', state.ideaId);
            console.log('✅ Updated job status to timeout for idea:', state.ideaId);
          } catch (dbError) {
            console.error('❌ Error updating job status to timeout:', dbError.message);
          }
        }
      }
    }
  }

  // Kick off immediately, then interval
  attemptOnce().catch(() => {});
  state.timer = setInterval(() => attemptOnce().catch(() => {}), intervalMs);
}

function buildFullPrompt(prompt, options = {}) {
  const {
    chaos = 5,
    ar = '4:3',
    stylize = 150,
    weird = 200,
    version = 7,
    quality = 'normal',
    stop = null,
    tile = false,
    niji = false,
    mode = 'relaxed',
    private: isPrivate = false
  } = options;

  let fullPrompt = prompt;
  
  fullPrompt += ` --chaos ${chaos}`;
  fullPrompt += ` --ar ${ar}`;
  fullPrompt += ` --stylize ${stylize}`;
  fullPrompt += ` --weird ${weird}`;
  fullPrompt += ` --v ${version}`;
  
  if (quality !== 'normal') {
    fullPrompt += ` --q ${quality}`;
  }
  
  if (stop) {
    fullPrompt += ` --stop ${stop}`;
  }
  
  if (tile) {
    fullPrompt += ' --tile';
  }
  
  if (niji) {
    fullPrompt += ' --niji';
  }

  return fullPrompt;
}

async function initializeClient() {
  if (isInitializing) {
    console.log('⏳ Client đang được khởi tạo...');
    return;
  }

  isInitializing = true;
  try {
    console.log('🚀 Đang khởi tạo Puppeteer client...');
    client = new PuppeteerMidjourneyAPI();
    await client.initBrowser();
    
    const authStatus = await client.checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      throw new Error('Không thể đăng nhập vào Midjourney');
    }
    
    healthStatus.status = 'running';
    healthStatus.uptime = Date.now();
    console.log('✅ Client đã được khởi tạo thành công!');
  } catch (error) {
    console.error('❌ Lỗi khởi tạo client:', error.message);
    healthStatus.status = 'error';
    healthStatus.lastError = error.message;
    throw error;
  } finally {
    isInitializing = false;
  }
}

async function gracefulShutdown() {
  console.log('🛑 Đang tắt server...');
  if (client) {
    try {
      await client.closeBrowser();
      console.log('✅ Browser đã được đóng');
    } catch (error) {
      console.error('❌ Lỗi đóng browser:', error.message);
    }
  }
  process.exit(0);
}

app.get('/health', (req, res) => {
  const uptime = healthStatus.uptime ? Date.now() - healthStatus.uptime : 0;
  res.json({
    status: healthStatus.status,
    uptime: Math.floor(uptime / 1000), 
    totalRequests: healthStatus.totalRequests,
    successfulRequests: healthStatus.successfulRequests,
    failedRequests: healthStatus.failedRequests,
    successRate: healthStatus.totalRequests > 0 ? 
      Math.round((healthStatus.successfulRequests / healthStatus.totalRequests) * 100) : 0,
    lastRequest: healthStatus.lastRequest,
    lastError: healthStatus.lastError,
    timestamp: new Date().toISOString()
  });
});

app.post('/midjourney/init', async (req, res) => {
  try {
    await initializeClient();
    res.json({
      success: true,
      message: 'Client đã được khởi tạo thành công',
      status: healthStatus.status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/midjourney/genimage', async (req, res) => {
  healthStatus.totalRequests++;
  healthStatus.lastRequest = new Date().toISOString();

  try {
    // Accept both design_id and idea_id for backward compatibility
    const { prompt, url_image, options = {}, design_id, idea_id, user_id: userId } = req.body;
    const designId = design_id || idea_id; // Prefer design_id, fallback to idea_id

    if (!prompt) {
      throw new Error('Prompt là bắt buộc');
    }

    console.log('🎨 Nhận yêu cầu generate ảnh:');
    console.log('📝 Prompt:', prompt);
    console.log('⚙️ Options:', options);
    console.log('🆔 Design ID:', designId || 'N/A (standalone mode)');
    console.log('👤 User ID:', userId || 'N/A');

    // Update job status to 'processing' when request is received (only if design_id provided)
    if (supabaseAdmin && designId) {
      try {
        await supabaseAdmin
          .from('product_design')
          .update({
            job_status: 'processing',
            job_created_at: new Date().toISOString(),
            job_updated_at: new Date().toISOString()
          })
          .eq('id', designId);
        console.log('✅ Updated job status to processing for design:', designId);
      } catch (dbError) {
        console.error('❌ Error updating job status to processing:', dbError.message);
      }
    } else if (!designId) {
      console.log('ℹ️ Running in standalone mode (no database tracking)');
    }

    if (!client || healthStatus.status !== 'running') {
      console.log('🔄 Client chưa sẵn sàng, đang khởi tạo...');
      await initializeClient();
    }

    const fullPrompt = await client.createPrompt(url_image, prompt, options);
    console.log('📝 Full prompt:', fullPrompt);

    const result = await client.generateImageViaAPI(fullPrompt, options);

    if (result.success) {
      healthStatus.successfulRequests++;
      // Extract jobId and batchSize
      const jobId = (result.jobId) || (result.data && result.data.success && result.data.success[0] && result.data.success[0].job_id);
      const batchSize = (result.data && result.data.success && result.data.success[0] && result.data.success[0].meta && result.data.success[0].meta.batch_size) || 4;

      // Update job_id in database (only if design_id provided)
      if (supabaseAdmin && designId && jobId) {
        try {
          await supabaseAdmin
            .from('product_design')
            .update({
              job_id: jobId,
              job_updated_at: new Date().toISOString()
            })
            .eq('id', designId);
          console.log('✅ Updated job_id in database:', jobId);
        } catch (dbError) {
          console.error('❌ Error updating job_id:', dbError.message);
        }
      }

      // Start polling job (only if design_id provided)
      if (jobId && designId) {
        try {
          startPollingJob(jobId, designId, userId, batchSize);
          console.log('✅ Started polling job for design:', designId);
        } catch (e) {
          console.error('❌ Không thể khởi động poll job:', e.message);
        }
      } else if (jobId && !designId) {
        console.log('ℹ️ Job created but not polling (standalone mode):', jobId);
      }

      // Respond immediately
      res.json({
        success: true,
        message: result.message,
        data: result.data,
        jobId,
        batchSize,
        status: result.status,
        retryCount: result.retryCount,
        mode: designId ? 'database' : 'standalone',
        timestamp: new Date().toISOString()
      });
    } else {
      healthStatus.failedRequests++;

      // Update job status to 'failed' when generation fails (only if design_id provided)
      if (supabaseAdmin && designId) {
        try {
          await supabaseAdmin
            .from('product_design')
            .update({
              job_status: 'failed',
              error_message: result.error || 'Generation failed',
              job_updated_at: new Date().toISOString()
            })
            .eq('id', designId);
          console.log('✅ Updated job status to failed for design:', designId);
        } catch (dbError) {
          console.error('❌ Error updating job status to failed:', dbError.message);
        }
      }

      res.status(500).json({
        success: false,
        error: result.error,
        retryCount: result.retryCount,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    healthStatus.failedRequests++;
    healthStatus.lastError = error.message;
    console.error('❌ Lỗi generate ảnh:', error.message);

    // Update job status to 'failed' when there's an error (only if idea_id provided)
    const { idea_id: ideaId } = req.body;
    if (supabaseAdmin && ideaId) {
      try {
        await supabaseAdmin
          .from('product_design')
          .update({
            job_status: 'failed',
            error_message: error.message,
            job_updated_at: new Date().toISOString()
          })
          .eq('id', ideaId);
        console.log('✅ Updated job status to failed for idea:', ideaId);
      } catch (dbError) {
        console.error('❌ Error updating job status to failed:', dbError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/midjourney/genimage', async (req, res) => {
  healthStatus.totalRequests++;
  healthStatus.lastRequest = new Date().toISOString();
  
  try {
    const { prompt, url_image, chaos, ar, stylize, weird, version, quality, stop, tile, niji, mode, private: isPrivate } = req.query;
    
    if (!prompt) {
      throw new Error('Prompt là bắt buộc');
    }

    console.log('🎨 Nhận yêu cầu generate ảnh:');
    console.log('📝 Prompt:', prompt);
    
    const options = {};
    if (chaos) options.chaos = parseInt(chaos);
    if (ar) options.ar = ar;
    if (stylize) options.stylize = parseInt(stylize);
    if (weird) options.weird = parseInt(weird);
    if (version) options.version = parseInt(version);
    if (quality) options.quality = parseFloat(quality);
    if (stop) options.stop = parseInt(stop);
    if (tile) options.tile = tile === 'true';
    if (niji) options.niji = parseInt(niji);
    if (mode) options.mode = mode;
    if (isPrivate) options.private = isPrivate === 'true';
    
    console.log('⚙️ Options:', options);

    if (!client || healthStatus.status !== 'running') {
      console.log('🔄 Client chưa sẵn sàng, đang khởi tạo...');
      await initializeClient();
    }

    const fullPrompt = await client.createPrompt(url_image, prompt, options);
    console.log('📝 Full prompt:', fullPrompt);

    const result = await client.generateImageViaAPI(fullPrompt, options);
    
    if (result.success) {
      healthStatus.successfulRequests++;
      res.json({
        success: true,
        message: result.message,
        data: result.data,
        jobId: result.jobId,
        status: result.status,
        retryCount: result.retryCount,
        timestamp: new Date().toISOString()
      });
    } else {
      healthStatus.failedRequests++;
      res.status(500).json({
        success: false,
        error: result.error,
        retryCount: result.retryCount,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    healthStatus.failedRequests++;
    healthStatus.lastError = error.message;
    console.error('❌ Lỗi generate ảnh:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/midjourney/status', async (req, res) => {
  try {
    if (!client) {
      res.json({
        success: false,
        message: 'Client chưa được khởi tạo',
        status: healthStatus.status
      });
      return;
    }

    const authStatus = await client.checkAuthStatus();
    res.json({
      success: true,
      isLoggedIn: authStatus.isLoggedIn,
      status: healthStatus.status,
      uptime: healthStatus.uptime ? Math.floor((Date.now() - healthStatus.uptime) / 1000) : 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.post('/midjourney/genvideo', async (req, res) => {
  healthStatus.totalRequests++;
  healthStatus.lastRequest = new Date().toISOString();
  
  try {
    const { image_url, text_prompt, options = {} } = req.body;
    
    if (!image_url) {
      throw new Error('image_url là bắt buộc');
    }

    console.log('🎬 Nhận yêu cầu generate video:');
    console.log('🖼️ Image URL:', image_url);
    console.log('📝 Text Prompt:', text_prompt);
    console.log('⚙️ Options:', options);
    if (!client || healthStatus.status !== 'running') {
      console.log('🔄 Client chưa sẵn sàng, đang khởi tạo...');
      await initializeClient();
    }
    const videoOptions = { ...options };
    if (text_prompt) {
      videoOptions.text_prompt = text_prompt;
    }
    const result = await client.generateVideoFromImage(image_url, videoOptions);
    
    if (result.success) {
      healthStatus.successfulRequests++;
      res.json({
        success: true,
        message: result.message,
        data: result.data,
        retryCount: result.retryCount,
        imageUrl: result.imageUrl,
        prompt: result.prompt,
        timestamp: new Date().toISOString()
      });
    } else {
      healthStatus.failedRequests++;
      res.status(500).json({
        success: false,
        error: result.error,
        retryCount: result.retryCount,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    healthStatus.failedRequests++;
    healthStatus.lastError = error.message;
    console.error('❌ Lỗi generate video:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
app.get('/midjourney/genvideo', async (req, res) => {
  healthStatus.totalRequests++;
  healthStatus.lastRequest = new Date().toISOString();
  
  try {
    const { image_url, text_prompt, chaos, ar, motion, mode, private: isPrivate } = req.query;
    
    if (!image_url) {
      throw new Error('image_url là bắt buộc');
    }

    console.log('🎬 Nhận yêu cầu generate video:');
    console.log('🖼️ Image URL:', image_url);
    console.log('📝 Text Prompt:', text_prompt);
    
    const options = {};
    if (text_prompt) options.text_prompt = text_prompt;
    if (chaos) options.chaos = parseInt(chaos);
    if (ar) options.ar = ar;
    if (motion) options.motion = motion;
    if (mode) options.mode = mode;
    if (isPrivate) options.private = isPrivate === 'true';
    
    console.log('⚙️ Options:', options);
    if (!client || healthStatus.status !== 'running') {
      console.log('🔄 Client chưa sẵn sàng, đang khởi tạo...');
      await initializeClient();
    }
    const result = await client.generateVideoFromImage(image_url, options);
    
    if (result.success) {
      healthStatus.successfulRequests++;
      res.json({
        success: true,
        message: result.message,
        data: result.data,
        retryCount: result.retryCount,
        imageUrl: result.imageUrl,
        prompt: result.prompt,
        timestamp: new Date().toISOString()
      });
    } else {
      healthStatus.failedRequests++;
      res.status(500).json({
        success: false,
        error: result.error,
        retryCount: result.retryCount,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    healthStatus.failedRequests++;
    healthStatus.lastError = error.message;
    console.error('❌ Lỗi generate video:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/midjourney/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Thiếu tham số url' });
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'cdn.midjourney.com') {
      return res.status(403).json({ success: false, error: 'Chỉ proxy ảnh từ cdn.midjourney.com' });
    }
  } catch (e) {
    return res.status(400).json({ success: false, error: 'URL không hợp lệ' });
  }
  try {
    if (!client || healthStatus.status !== 'running') {
      await initializeClient();
    }
    const { buffer, contentType } = await client.downloadImageViaBrowser(url);
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', 'inline; filename="image"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Midjourney API Server',
    version: '1.0.0',
    endpoints: {
      'POST /midjourney/init': 'Khởi tạo client',
      'POST /midjourney/genimage': 'Generate ảnh (POST)',
      'GET /midjourney/genimage': 'Generate ảnh (GET)',
      'POST /midjourney/genvideo': 'Generate video từ ảnh (POST)',
      'GET /midjourney/genvideo': 'Generate video từ ảnh (GET)',
      'GET /midjourney/status': 'Kiểm tra trạng thái',
      'GET /health': 'Health check'
    },
    status: healthStatus.status,
    uptime: healthStatus.uptime ? Math.floor((Date.now() - healthStatus.uptime) / 1000) : 0
  });
});

app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint không tồn tại',
    timestamp: new Date().toISOString()
  });
});
function cleanupMemory() {
  if (global.gc) {
    global.gc();
    console.log('🧹 Memory cleanup completed');
  }
}
setInterval(cleanupMemory, 30 * 60 * 1000);
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 API docs: http://localhost:${PORT}/`);
  setTimeout(async () => {
    try {
      await initializeClient();
    } catch (error) {
      console.log('⚠️ Không thể tự động khởi tạo client, vui lòng gọi /midjourney/init');
    }
  }, 2000);
});

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  healthStatus.lastError = error.message;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  healthStatus.lastError = reason;
});

module.exports = app; 