const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

puppeteer.use(StealthPlugin());

// Supabase configuration
const supabaseUrl = 'https://vilyavgrknohxhfvvayc.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbHlhdmdya25vaHhoZnZ2YXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzUyODY3MiwiZXhwIjoyMDU5MTA0NjcyfQ.-8XVkjF-I0pWKjbwqfTVpLmBh9-nEyORR8SWGUg93w4";
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();

// CORS configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function checkToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      req.access_token = authHeader.split(' ')[1];
      return next();
    }

    await initBrowser();

    if (!cachedToken || Date.now() >= tokenExpiry) {
      await fetchNewToken();
    }
    req.access_token = cachedToken;
    next();

  } catch (err) {
    console.error('checkToken error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

app.use('/api', checkToken);

let browser;
let cachedToken = null;
let tokenExpiry = 0;

// Job management
const activeJobs = new Map();

// Job statuses
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing', 
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
};

async function initBrowser() {
  if (browser && browser.isConnected()) {
    return;
  }
  browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
      //  userDataDir: 'C:\\Users\\ROG\\AppData\\Local\\Google\\Chrome\\User Data',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    async function fetchNewToken() {
      const page = await browser.newPage();
      try {
        await page.goto('https://ideogram.cryptovn.news/', { waitUntil: 'networkidle2' });
        const content = await page.evaluate(() => document.querySelector("pre")?.innerText);
        const data = JSON.parse(content);
        const ttl = data.expires_in || 300; 
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + ttl * 1000 - 5000; 
      } finally {
        await page.close();
      }
    }

async function getImageFromUrl(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
}

// Job management functions
function generateJobId() {
    return `ideogram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function updateJobStatus(jobId, status, errorMessage = null) {
    try {
        const updateData = {
            job_status: status,
            job_updated_at: new Date().toISOString()
        };
        
        if (errorMessage) {
            updateData.error_message = errorMessage;
        }
        
        const { error } = await supabase
            .from('product_design')
            .update(updateData)
            .eq('job_id', jobId);
            
        if (error) {
            console.error('Error updating job status:', error);
        }
    } catch (err) {
        console.error('Error in updateJobStatus:', err);
    }
}

async function updateJobResults(jobId, newResults, fieldName) {
    try {
        // 1. Lấy kết quả cũ
        const { data, error: fetchError } = await supabase
            .from('product_design')
            .select(fieldName)
            .eq('job_id', jobId)
            .single();

        let mergedResults = [];
        if (data && data[fieldName]) {
            try {
                const oldArr = JSON.parse(data[fieldName]);
                if (Array.isArray(oldArr)) mergedResults = oldArr;
            } catch (e) { mergedResults = []; }
        }
        // 2. Append kết quả mới
        mergedResults = [...mergedResults, ...newResults];
        // 3. Lọc trùng
        mergedResults = [...new Set(mergedResults)];
        // 4. Update lên DB
        const { error } = await supabase
            .from('product_design')
            .update({
                [fieldName]: JSON.stringify(mergedResults),
                job_status: JOB_STATUS.COMPLETED,
                job_updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId);
        if (error) console.error('Error updating job results:', error);
    } catch (err) {
        console.error('Error in updateJobResults:', err);
    }
}

// Upload image to Supabase Storage
async function uploadToStorage(base64Data, filename) {
    try {
        const { data, error } = await supabase.storage
            .from('product-ideas')
            .upload(filename, Buffer.from(base64Data, 'base64'), {
                contentType: 'image/png'
            });
            
        if (error) {
            console.error('Error uploading to storage:', error);
            return null;
        }
        
        const { data: publicData } = supabase.storage
            .from('product-ideas')
            .getPublicUrl(filename);
            
        return publicData.publicUrl;
    } catch (err) {
        console.error('Error in uploadToStorage:', err);
        return null;
    }
}

app.post('/api/upload', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        const access_token = req.access_token;

        const uploadPage = await browser.newPage();
        await uploadPage.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

        const base64Image = await getImageFromUrl(imageUrl);

        const uploadResponse = await uploadPage.evaluate(async (access_token, base64Image) => {
            const blob = await (await fetch(`data:image/png;base64,${base64Image}`)).blob();
            const formData = new FormData();
            formData.append('file', blob, 'upload.png');

            const res = await fetch('https://ideogram.ai/api/uploads/upload', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                },
                body: formData,
            });

            return await res.json();
        }, access_token, base64Image);

        if (!uploadResponse.success) {
            return res.status(400).json({ error: 'Upload failed' });
        }

        await uploadPage.close();

        res.json({
            success: true,
            uploadId: uploadResponse.id
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Describe
app.post('/api/caption', async (req, res) => {
    try {
        const { uploadId } = req.body;
        
        if (!uploadId) {
            return res.status(400).json({ error: 'Upload ID is required' });
        }

        const access_token = req.access_token;

        const uploadPage = await browser.newPage();
        await uploadPage.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

        const describeResponse = await uploadPage.evaluate(async (access_token, uploadId) => {
            const res = await fetch('https://ideogram.ai/api/describe', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    image_id: uploadId,
                    captioner_model_version: 'V_3_0'
                }),
            });

            return await res.json();
        }, access_token, uploadId);

        await uploadPage.close();

        res.json({
            success: true,
            caption: describeResponse.data?.[0]?.caption || 'No caption available'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/generate-variations', async (req, res) => {
    try {
        const { 
            imageUrl, 
            idea_id, 
            user_id,
            // Ideogram options from frontend
            imageWeight = 70,
            magicPrompt = 'AUTO',
            style = 'AUTO',
            prompt = ''
        } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Generate job ID
        const jobId = generateJobId();
        
        // Initialize job in database
        await supabase
            .from('product_design')
            .update({
                job_id: jobId,
                job_status: JOB_STATUS.PENDING,
                job_created_at: new Date().toISOString(),
                job_updated_at: new Date().toISOString()
            })
            .eq('id', idea_id);

        // Return job ID immediately
        res.json({
            success: true,
            jobId: jobId
        });

        // Start background processing with options
        processGenerateVariations(jobId, imageUrl, idea_id, {
            imageWeight,
            magicPrompt,
            style,
            prompt
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Background processing function
async function processGenerateVariations(jobId, imageUrl, ideaId, options = {}) {
    const access_token = cachedToken;
    let page = null;
    
    try {
        // Update job status to processing
        await updateJobStatus(jobId, JOB_STATUS.PROCESSING);
        
        page = await browser.newPage();
        await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

        // Step 1: Upload image
        console.log(`[${jobId}] Step 1: Uploading image...`);
        const base64Image = await getImageFromUrl(imageUrl);

        const uploadResponse = await page.evaluate(async (access_token, base64Image) => {
            const blob = await (await fetch(`data:image/png;base64,${base64Image}`)).blob();
            const formData = new FormData();
            formData.append('file', blob, 'upload.png');

            const res = await fetch('https://ideogram.ai/api/uploads/upload', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                },
                body: formData,
            });

            return await res.json();
        }, access_token, base64Image);

        if (!uploadResponse.success) {
            throw new Error('Upload failed');
        }

        // Step 2: Get caption
        console.log(`[${jobId}] Step 2: Getting caption...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        const describeResponse = await page.evaluate(async (access_token, uploadId) => {
            const res = await fetch('https://ideogram.ai/api/describe', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    image_id: uploadId,
                    captioner_model_version: 'V_3_0'
                }),
            });

            return await res.json();
        }, access_token, uploadResponse.id);

        // Step 3: Generate variations
        console.log(`[${jobId}] Step 3: Generating variations with options:`, options);
        const generateVariationResponse = await page.evaluate(async (access_token, imageId, promptText, options) => {
            const res = await fetch('https://ideogram.ai/api/images/sample', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: promptText,
                    user_id: 'MstsNwxQQPOMctpkgjL_zA',
                    private: true,
                    model_version: 'V_3_0',
                    use_autoprompt_option: options.magicPrompt || 'ON',
                    sampling_speed: -2,
                    parent: {
                        image_id: imageId,
                        weight: parseInt(options.imageWeight) || 50,
                        type: 'VARIATION'
                    },
                    style_reference_parents: [],
                    style_expert: options.style || 'AUTO',
                    resolution: {
                        width: 832,
                        height: 1248
                    },
                    use_random_style_codes: false,
                    num_images: 4
                })
            });

            return await res.json();
        }, access_token, uploadResponse.id, describeResponse.data?.[0]?.caption, options);

        // Debug response
        console.log(`[${jobId}] Generate variations response:`, JSON.stringify(generateVariationResponse, null, 2));

        // Step 4: Poll for results
        console.log(`[${jobId}] Step 4: Polling for results...`);
        const requestId = generateVariationResponse.request_id;
        
        if (!requestId) {
            console.error(`[${jobId}] No request ID in response:`, generateVariationResponse);
            throw new Error('No request ID received');
        }
        
        console.log(`[${jobId}] Found request_id: ${requestId}`);

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 40; // 10 minutes with 15s intervals
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay
            
            const metadata = await page.evaluate(async (access_token, requestId) => {
                const resp = await fetch(
                    `https://ideogram.ai/api/images/retrieve_metadata_request_id/${encodeURIComponent(requestId)}`, 
                    {
                        method: 'GET',
                        headers: {
                            'authorization': `Bearer ${access_token}`,
                            'accept': '*/*'
                        }
                    }
                );
                
                if (!resp.ok) {
                    throw new Error(`Status ${resp.status}`);
                }
                return await resp.json();
            }, access_token, requestId);

            // Debug polling response
            console.log(`[${jobId}] Polling response (attempt ${attempts + 1}):`, JSON.stringify(metadata, null, 2));

            if (metadata.responses && metadata.responses.length > 0) {
                const responseIds = metadata.responses.map(item => item.response_id).filter(Boolean);
                
                if (responseIds.length > 0) {
                    // Step 5: Download images
                    console.log(`[${jobId}] Step 5: Downloading ${responseIds.length} images...`);
                    const imageUrls = [];
                    
                    for (const responseId of responseIds) {
                        const base64 = await page.evaluate(async (access_token, responseId) => {
                            const url = `https://ideogram.ai/api/download/response/${encodeURIComponent(responseId)}/image?quality=PNG`;
                            const resp = await fetch(url, {
                                method: 'GET',
                                headers: { 'authorization': `Bearer ${access_token}` },
                            });
                            
                            if (!resp.ok) throw new Error(`Status ${resp.status}`);
                            const blob = await resp.blob();
                            const data = await blob.arrayBuffer();
                            
                            return btoa(
                                new Uint8Array(data)
                                    .reduce((s, byte) => s + String.fromCharCode(byte), '')
                            );
                        }, access_token, responseId);
                        
                        // Upload to Supabase Storage
                        const filename = `ideogram-remix-${jobId}-${responseId}.png`;
                        const imageUrl = await uploadToStorage(base64, filename);
                        
                        if (imageUrl) {
                            imageUrls.push(imageUrl);
                        }
                    }
                    
                    if (imageUrls.length > 0) {
                        // Update database with results
                        await updateJobResults(jobId, imageUrls, 'remixed_designs_url');
                        console.log(`[${jobId}] Completed successfully with ${imageUrls.length} images`);
                        return;
                    }
                }
            }
            
            attempts++;
            console.log(`[${jobId}] Attempt ${attempts}/${maxAttempts} - still processing...`);
        }
        
        throw new Error('Timeout waiting for results');
        
    } catch (error) {
        console.error(`[${jobId}] Error:`, error);
        await updateJobStatus(jobId, JOB_STATUS.FAILED, error.message);
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Unified endpoint for N8N integration - handles upload + caption + generation
app.post('/api/remix', async (req, res) => {
    try {
        const {
            imageUrl,
            prompt = '',
            idea_id,
            user_id,
            // Ideogram customization options
            imageWeight = 70,
            magicPrompt = 'AUTO',
            style = 'AUTO',
            promptSource = 'AUTO', // 'AUTO' = use AI caption, 'MANUAL' = use provided prompt
            resolution = { width: 800, height: 1280 },
            num_images = 1
        } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'imageUrl is required' });
        }

        // Generate job ID
        const jobId = generateJobId();

        // Initialize job in database if idea_id provided
        if (idea_id) {
            await supabase
                .from('product_design')
                .update({
                    job_id: jobId,
                    job_status: JOB_STATUS.PENDING,
                    job_created_at: new Date().toISOString(),
                    job_updated_at: new Date().toISOString()
                })
                .eq('id', idea_id);
        }

        // Return job ID immediately
        res.json({
            success: true,
            jobId: jobId,
            message: 'Job started. Processing in background.'
        });

        // Start background processing
        processRemix(jobId, {
            imageUrl,
            prompt,
            imageWeight,
            magicPrompt,
            style,
            promptSource,
            resolution,
            num_images
        }, idea_id);

    } catch (error) {
        console.error('Error in /api/remix:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Background processing for unified remix endpoint
async function processRemix(jobId, options, ideaId) {
    const access_token = cachedToken;
    let page = null;

    try {
        // Update job status to processing
        await updateJobStatus(jobId, JOB_STATUS.PROCESSING);

        page = await browser.newPage();
        await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

        // Step 1: Upload image
        console.log(`[${jobId}] Step 1: Uploading image from URL: ${options.imageUrl}`);
        const base64Image = await getImageFromUrl(options.imageUrl);

        const uploadResponse = await page.evaluate(async (access_token, base64Image) => {
            const blob = await (await fetch(`data:image/png;base64,${base64Image}`)).blob();
            const formData = new FormData();
            formData.append('file', blob, 'upload.png');

            const res = await fetch('https://ideogram.ai/api/uploads/upload', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                },
                body: formData,
            });

            return await res.json();
        }, access_token, base64Image);

        if (!uploadResponse.success) {
            throw new Error('Failed to upload image to Ideogram');
        }

        const uploadId = uploadResponse.id;
        console.log(`[${jobId}] Upload successful. Upload ID: ${uploadId}`);

        // Step 2: Determine prompt text
        let finalPrompt = options.prompt || '';

        if (options.promptSource === 'AUTO' || !finalPrompt) {
            console.log(`[${jobId}] Step 2: Generating AI caption...`);
            await new Promise(resolve => setTimeout(resolve, 1500));

            const describeResponse = await page.evaluate(async (access_token, uploadId) => {
                const res = await fetch('https://ideogram.ai/api/describe', {
                    method: 'POST',
                    headers: {
                        'authorization': `Bearer ${access_token}`,
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        image_id: uploadId,
                        captioner_model_version: 'V_3_0'
                    }),
                });

                return await res.json();
            }, access_token, uploadId);

            finalPrompt = describeResponse.data?.[0]?.caption || 'A beautiful design';
            console.log(`[${jobId}] AI Caption generated: ${finalPrompt.substring(0, 100)}...`);
        } else {
            console.log(`[${jobId}] Step 2: Using provided prompt`);
        }

        // Step 3: Generate variations
        console.log(`[${jobId}] Step 3: Generating variations with custom settings...`);
        console.log(`[${jobId}] Settings: imageWeight=${options.imageWeight}, style=${options.style}, magicPrompt=${options.magicPrompt}`);

        const generateResponse = await page.evaluate(async (
            access_token,
            imageId,
            promptText,
            style_expert,
            use_autoprompt_option,
            parent_weight,
            resolution,
            num_images
        ) => {
            const body = {
                prompt: promptText,
                user_id: 'MstsNwxQQPOMctpkgjL_zA',
                private: true,
                model_version: 'V_3_0',
                use_autoprompt_option,
                sampling_speed: -2,
                parent: {
                    image_id: imageId,
                    weight: parent_weight,
                    type: 'VARIATION'
                },
                style_reference_parents: [],
                style_expert,
                resolution,
                use_random_style_codes: false,
                num_images
            };

            const res = await fetch('https://ideogram.ai/api/images/sample', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(body)
            });
            return await res.json();
        }, access_token, uploadId, finalPrompt, options.style, options.magicPrompt,
           parseInt(options.imageWeight), options.resolution, options.num_images);

        // Step 4: Poll for results
        console.log(`[${jobId}] Step 4: Polling for results...`);
        const requestId = generateResponse.data?.request_id || generateResponse.request_id;

        if (!requestId) {
            console.error(`[${jobId}] No request ID in response:`, generateResponse);
            throw new Error('No request ID received from Ideogram');
        }

        console.log(`[${jobId}] Request ID: ${requestId}`);

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 40; // 10 minutes with 15s intervals

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay

            const metadata = await page.evaluate(async (access_token, requestId) => {
                const resp = await fetch(
                    `https://ideogram.ai/api/images/retrieve_metadata_request_id/${encodeURIComponent(requestId)}`,
                    {
                        method: 'GET',
                        headers: {
                            'authorization': `Bearer ${access_token}`,
                            'accept': '*/*'
                        }
                    }
                );

                if (!resp.ok) {
                    throw new Error(`Status ${resp.status}`);
                }
                return await resp.json();
            }, access_token, requestId);

            console.log(`[${jobId}] Polling attempt ${attempts + 1}/${maxAttempts}`);

            if (metadata.responses && metadata.responses.length > 0) {
                const responseIds = metadata.responses.map(item => item.response_id).filter(Boolean);

                if (responseIds.length > 0) {
                    // Step 5: Download images
                    console.log(`[${jobId}] Step 5: Downloading ${responseIds.length} images...`);
                    const imageUrls = [];

                    for (const responseId of responseIds) {
                        const base64 = await page.evaluate(async (access_token, responseId) => {
                            const url = `https://ideogram.ai/api/download/response/${encodeURIComponent(responseId)}/image?quality=PNG`;
                            const resp = await fetch(url, {
                                method: 'GET',
                                headers: { 'authorization': `Bearer ${access_token}` },
                            });

                            if (!resp.ok) throw new Error(`Status ${resp.status}`);
                            const blob = await resp.blob();
                            const data = await blob.arrayBuffer();

                            return btoa(
                                new Uint8Array(data)
                                    .reduce((s, byte) => s + String.fromCharCode(byte), '')
                            );
                        }, access_token, responseId);

                        // Upload to Supabase Storage
                        const filename = `${jobId}/${responseId}.png`;
                        const imageUrl = await uploadToStorage(base64, filename);

                        if (imageUrl) {
                            imageUrls.push(imageUrl);
                        }
                    }

                    if (imageUrls.length > 0) {
                        // Update database with results
                        if (ideaId) {
                            await updateJobResults(jobId, imageUrls, 'remixed_designs_url');
                        }
                        console.log(`[${jobId}] ✓ Completed successfully with ${imageUrls.length} images`);
                        console.log(`[${jobId}] Images:`, imageUrls);
                        return;
                    }
                }
            }

            attempts++;
        }

        throw new Error('Timeout waiting for results after 10 minutes');

    } catch (error) {
        console.error(`[${jobId}] ✗ Error:`, error.message);
        await updateJobStatus(jobId, JOB_STATUS.FAILED, error.message);
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Get job status endpoint
app.get('/api/job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!jobId) {
            return res.status(400).json({ error: 'Job ID is required' });
        }

        // Query Supabase for job status
        const { data, error } = await supabase
            .from('product_design')
            .select('job_id, job_status, job_created_at, job_updated_at, error_message, remixed_designs_url')
            .eq('job_id', jobId)
            .single();

        if (error || !data) {
            return res.status(404).json({
                error: 'Job not found',
                jobId: jobId
            });
        }

        // Parse remixed_designs_url if it's a JSON string
        let imageUrls = [];
        if (data.remixed_designs_url) {
            try {
                imageUrls = JSON.parse(data.remixed_designs_url);
            } catch (e) {
                imageUrls = [data.remixed_designs_url];
            }
        }

        res.json({
            success: true,
            jobId: data.job_id,
            status: data.job_status,
            createdAt: data.job_created_at,
            updatedAt: data.job_updated_at,
            errorMessage: data.error_message,
            images: imageUrls,
            isComplete: data.job_status === JOB_STATUS.COMPLETED,
            isFailed: data.job_status === JOB_STATUS.FAILED,
            isProcessing: data.job_status === JOB_STATUS.PROCESSING || data.job_status === JOB_STATUS.PENDING
        });

    } catch (error) {
        console.error('Error in /api/job/:jobId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/gencustom', async (req, res) => {
    try {
      const {
        imageId,
        promptText,
        idea_id,
        user_id,
        style_expert = 'AUTO',
        use_autoprompt_option = 'ON',
        sampling_speed = -2,
        parent_type = 'VARIATION', 
        parent_weight = 50,
        resolution = { width: 832, height: 1248 },
        use_random_style_codes = false,
        num_images = 4
      } = req.body;
  
      if (!imageId || !promptText) {
        return res.status(400).json({ error: 'Image ID and prompt text are required' });
      }

      // Generate job ID
      const jobId = generateJobId();
      
      // Initialize job in database
      await supabase
          .from('product_design')
          .update({
              job_id: jobId,
              job_status: JOB_STATUS.PENDING,
              job_created_at: new Date().toISOString(),
              job_updated_at: new Date().toISOString()
          })
          .eq('id', idea_id);

      // Return job ID immediately
      res.json({
          success: true,
          jobId: jobId
      });

      // Start background processing
      processGenCustom(jobId, {
          imageId,
          promptText,
          style_expert,
          use_autoprompt_option,
          sampling_speed,
          parent_type,
          parent_weight,
          resolution,
          use_random_style_codes,
          num_images
      }, idea_id);

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
});

// Background processing for gencustom
async function processGenCustom(jobId, options, ideaId) {
    const access_token = cachedToken;
    let page = null;
    
    try {
        // Update job status to processing
        await updateJobStatus(jobId, JOB_STATUS.PROCESSING);
        
        page = await browser.newPage();
        await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

        // Step 1: Generate custom variations
        console.log(`[${jobId}] Step 1: Generating custom variations...`);
        const generateResponse = await page.evaluate(async (
            access_token,
            imageId,
            promptText,
            style_expert,
            use_autoprompt_option,
            sampling_speed,
            parent_type,
            parent_weight,
            resolution,
            use_random_style_codes,
            num_images
        ) => {
            const body = {
                prompt: promptText,
                user_id: 'MstsNwxQQPOMctpkgjL_zA',
                private: true,
                model_version: 'V_3_0',
                use_autoprompt_option,
                sampling_speed,
                parent: {
                    image_id: imageId,
                    weight: parent_weight,
                    type: parent_type
                },
                style_reference_parents: [],
                style_expert,
                resolution,
                use_random_style_codes,
                num_images
            };

            const res = await fetch('https://ideogram.ai/api/images/sample', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(body)
            });
            return await res.json();
        }, access_token, options.imageId, options.promptText, options.style_expert,
           options.use_autoprompt_option, options.sampling_speed, options.parent_type,
           options.parent_weight, options.resolution, options.use_random_style_codes,
           options.num_images);

        // Step 2: Poll for results
        console.log(`[${jobId}] Step 2: Polling for results...`);
        const requestId = generateResponse.data?.request_id;
        
        if (!requestId) {
            throw new Error('No request ID received');
        }

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 40; // 10 minutes with 15s intervals
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay
            
            const metadata = await page.evaluate(async (access_token, requestId) => {
                const resp = await fetch(
                    `https://ideogram.ai/api/images/retrieve_metadata_request_id/${encodeURIComponent(requestId)}`, 
                    {
                        method: 'GET',
                        headers: {
                            'authorization': `Bearer ${access_token}`,
                            'accept': '*/*'
                        }
                    }
                );
                
                if (!resp.ok) {
                    throw new Error(`Status ${resp.status}`);
                }
                return await resp.json();
            }, access_token, requestId);

            if (metadata.responses && metadata.responses.length > 0) {
                const responseIds = metadata.responses.map(item => item.response_id).filter(Boolean);
                
                if (responseIds.length > 0) {
                    // Step 3: Download images
                    console.log(`[${jobId}] Step 3: Downloading ${responseIds.length} images...`);
                    const imageUrls = [];
                    
                    for (const responseId of responseIds) {
                        const base64 = await page.evaluate(async (access_token, responseId) => {
                            const url = `https://ideogram.ai/api/download/response/${encodeURIComponent(responseId)}/image?quality=PNG`;
                            const resp = await fetch(url, {
                                method: 'GET',
                                headers: { 'authorization': `Bearer ${access_token}` },
                            });
                            
                            if (!resp.ok) throw new Error(`Status ${resp.status}`);
                            const blob = await resp.blob();
                            const data = await blob.arrayBuffer();
                            
                            return btoa(
                                new Uint8Array(data)
                                    .reduce((s, byte) => s + String.fromCharCode(byte), '')
                            );
                        }, access_token, responseId);
                        
                        // Upload to Supabase Storage
                        const filename = `ideogram-custom-${jobId}-${responseId}.png`;
                        const imageUrl = await uploadToStorage(base64, filename);
                        
                        if (imageUrl) {
                            imageUrls.push(imageUrl);
                        }
                    }
                    
                    if (imageUrls.length > 0) {
                        // Update database with results
                        await updateJobResults(jobId, imageUrls, 'remixed_designs_url');
                        console.log(`[${jobId}] Completed successfully with ${imageUrls.length} images`);
                        return;
                    }
                }
            }
            
            attempts++;
            console.log(`[${jobId}] Attempt ${attempts}/${maxAttempts} - still processing...`);
        }
        
        throw new Error('Timeout waiting for results');
        
    } catch (error) {
        console.error(`[${jobId}] Error:`, error);
        await updateJobStatus(jobId, JOB_STATUS.FAILED, error.message);
    } finally {
        if (page) {
            await page.close();
        }
    }
}
  

app.post('/api/upscale', async (req, res) => {
    try {
      const {
        request_id,
        response_id,
        promptText,
        model_version = 'V_0_3',
        use_autoprompt_option = 'OFF',
        sampling_speed = -2,
        parent_weight = 100,              
        upscale_details_weight = null,
        resolution = { width: 896, height: 1024 },
        use_random_style_codes = false,
        num_images = 1,
        privateGeneration = true
      } = req.body;
  
      if (!request_id || !response_id || !promptText) {
        return res.status(400).json({
          error: 'Phải cung cấp request_id, response_id và promptText'
        });
      }
  
      const access_token = req.access_token;
      const page = await browser.newPage();
      await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });
  
      const result = await page.evaluate(async (
        access_token,
        promptText,
        model_version,
        use_autoprompt_option,
        sampling_speed,
        request_id,
        response_id,
        parent_weight,
        upscale_details_weight,
        resolution,
        use_random_style_codes,
        num_images,
        privateGeneration
      ) => {
        const body = {
          prompt: promptText,
          user_id: 'MstsNwxQQPOMctpkgjL_zA',
          private: privateGeneration,
          model_version,
          use_autoprompt_option,
          sampling_speed,
          parent: {
            request_id,
            response_id,
            weight: parent_weight,  
            type: 'SUPER_RES'
          },
          style_reference_parents: [],
          character_reference_parents: [],
          resolution,
          use_random_style_codes,
          num_images
        };
        if (typeof upscale_details_weight === 'number') {
          body.upscale_details_weight = upscale_details_weight;
        }
  
        const resp = await fetch('https://ideogram.ai/api/images/sample', {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${access_token}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        return await resp.json();
      }, access_token,
         promptText,
         model_version,
         use_autoprompt_option,
         sampling_speed,
         request_id,
         response_id,
         parent_weight,
         upscale_details_weight,
         resolution,
         use_random_style_codes,
         num_images,
         privateGeneration
      );
  
      await page.close();
      res.json({ success: true, result });
    } catch (error) {
      console.error('Error in /api/upscale:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
//Remove background
  app.post('/api/removebackground', async (req, res) => {
    try {
      const {
        asset_type = 'RESPONSE',  
        asset_id                  
      } = req.body;
  
      if (!asset_id) {
        return res.status(400).json({ error: 'asset_id là bắt buộc' });
      }
  
      const access_token = req.access_token;
      const page = await browser.newPage();
      await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });
  
      const result = await page.evaluate(async (access_token, asset_type, asset_id) => {
        const body = { asset_type, asset_id };
        const resp = await fetch(
          'https://ideogram.ai/api/images/masks/removeImageBackground',
          {
            method: 'POST',
            headers: {
              'authorization': `Bearer ${access_token}`,
              'content-type': 'application/json'
            },
            body: JSON.stringify(body)
          }
        );
        return await resp.json();
      }, access_token, asset_type, asset_id);
  
      await page.close();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error in /api/removebackground:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
app.post('/api/genimageprompt', async (req, res) => {
    try {
      const {
        prompt,                              
        style_expert = 'AUTO',              // AUTO, PHOTO, ILLUSTRATION, …
        model_version = 'V_3_0',            // V_3_0, V_0_3, …
        use_autoprompt_option = 'ON',       // ON, OFF
        sampling_speed = -2,                // số nguyên
        resolution = { width: 1312, height: 736 },
        use_random_style_codes = false,
        num_images = 4,
        privateGeneration = true,
        style_reference_parents = [],       
        character_reference_parents = []   
      } = req.body;
  
      if (!prompt) {
        return res.status(400).json({ error: 'prompt là bắt buộc' });
      }
  
      const access_token = req.access_token;
      const page = await browser.newPage();
      await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });
  
      const response = await page.evaluate(async (
        access_token,
        prompt,
        style_expert,
        model_version,
        use_autoprompt_option,
        sampling_speed,
        resolution,
        use_random_style_codes,
        num_images,
        privateGeneration,
        style_reference_parents,
        character_reference_parents
      ) => {
        const body = {
          prompt,
          user_id: 'MstsNwxQQPOMctpkgjL_zA',
          private: privateGeneration,
          model_version,
          use_autoprompt_option,
          sampling_speed,
          style_reference_parents,
          character_reference_parents,
          style_expert,
          resolution,
          use_random_style_codes,
          num_images
        };
  
        const resp = await fetch('https://ideogram.ai/api/images/sample', {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${access_token}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        return await resp.json();
      }, access_token,
         prompt,
         style_expert,
         model_version,
         use_autoprompt_option,
         sampling_speed,
         resolution,
         use_random_style_codes,
         num_images,
         privateGeneration,
         style_reference_parents,
         character_reference_parents
      );
  
      await page.close();
      res.json({ success: true, data: response });
    } catch (err) {
      console.error('Error in /api/genimageprompt:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// Get request_id
  app.get('/api/getrequestid', async (req, res) => {
    try {
      const id = req.query.id;
      if (!id) {
        return res.status(400).json({ error: 'Tham số id là bắt buộc' });
      }
  
      const access_token = req.access_token;
      if (!access_token) {
        return res.status(401).json({ error: 'Không có access token' });
      }
  
      const page = await browser.newPage();
      await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });
  
      const metadata = await page.evaluate(
        async (access_token, id) => {
          const resp = await fetch(
            `https://ideogram.ai/api/images/retrieve_metadata_request_id/${encodeURIComponent(id)}`, 
            {
              method: 'GET',
              headers: {
                'authorization': `Bearer ${access_token}`,
                'accept': '*/*'
              }
            }
          );
          if (!resp.ok) {
            throw new Error(`Status ${resp.status}`);
          }
          return await resp.json();
        },
        access_token,
        id
      );
  
      await page.close();
  
      res.json({ success: true, metadata });
    } catch (err) {
      console.error('Error in /api/getrequestid:', err);
      const status = err.message.includes('Status') ? parseInt(err.message.split(' ')[1]) : 500;
      res.status(status).json({ error: err.message });
    }
  });
  
  
// API GET /api/download/response/:response_id/image tải ảnh Remove
app.get('/api/download/response/:response_id/image', async (req, res) => {
  try {
    const { response_id } = req.params;
    const { quality = 'PNG' } = req.query;
    if (!response_id) {
      return res.status(400).json({ error: 'response_id là bắt buộc' });
    }
    const access_token = req.access_token;
    if (!access_token) {
      return res.status(401).json({ error: 'Không có access token' });
    }

    const page = await browser.newPage();
    await page.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

    const base64 = await page.evaluate(
      async (access_token, response_id, quality) => {
        const url = `https://ideogram.ai/api/download/response/${encodeURIComponent(response_id)}/image?quality=${encodeURIComponent(quality)}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: { 'authorization': `Bearer ${access_token}` },
        });
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const blob = await resp.blob();
        const data = await blob.arrayBuffer();
        // convert to base64
        const b64 = btoa(
          new Uint8Array(data)
            .reduce((s, byte) => s + String.fromCharCode(byte), '')
        );
        return b64;
      },
      access_token,
      response_id,
      quality
    );
    await page.close();

    const imgBuffer = Buffer.from(base64, 'base64');
    res
      .contentType(`image/${quality.toLowerCase() === 'png' ? 'png' : 'jpeg'}`)
      .send(imgBuffer);

  } catch (err) {
    console.error('Error in /api/download/response/:response_id/image:', err);
    const status = err.message.includes('Status') ? parseInt(err.message.split(' ')[1]) : 500;
    res.status(status).json({ error: err.message });
  }
});

// API POST /api/d/images tải ảnh Remix
app.post('/api/d/images', async (req, res) => {
  try {
    const { image_ids, cover_only = false, request_ids = [] } = req.body;
    if (!Array.isArray(image_ids) || image_ids.length === 0) {
      return res.status(400).json({ error: 'Phải có mảng image_ids không rỗng' });
    }

    const access_token = req.access_token;
    if (!access_token) {
      return res.status(401).json({ error: 'Không có access token' });
    }

    const page = await browser.newPage();
    await page.goto('https://ideogram.ai/t/my-images', { waitUntil: 'networkidle2' });

    const { b64, contentType } = await page.evaluate(
      async (access_token, image_ids, cover_only, request_ids) => {
        const body = { image_ids, cover_only, request_ids };
        const resp = await fetch('https://ideogram.ai/api/d/images', {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${access_token}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const blob = await resp.blob();
        const ct = resp.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await blob.arrayBuffer();
        // convert to base64
        const binary = Array.from(new Uint8Array(arrayBuffer))
                            .map(b => String.fromCharCode(b))
                            .join('');
        const b64str = btoa(binary);
        return { b64: b64str, contentType: ct };
      },
      access_token,
      image_ids,
      cover_only,
      request_ids
    );

    await page.close();

    const buffer = Buffer.from(b64, 'base64');
    res
      .set('Content-Type', contentType)
      .send(buffer);

  } catch (err) {
    console.error('Error in /api/d/images:', err);
    const status = err.message.includes('Status') ? Number(err.message.split(' ')[1]) : 500;
    res.status(status).json({ error: err.message });
  }
});


app.get('/api/u', async (req, res) => {
    try {
        const { user_id, all_privacy, filters } = req.query;
        
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const access_token = req.access_token;

        const uploadPage = await browser.newPage();
        await uploadPage.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

        const imagesResponse = await uploadPage.evaluate(async (access_token, user_id, all_privacy, filters) => {
            const res = await fetch(`https://ideogram.ai/api/g/u?user_id=${user_id}&all_privacy=${all_privacy}&filters=${filters}`, {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'vi,en;q=0.9,en-GB;q=0.8,en-US;q=0.7',
                    'authorization': `Bearer ${access_token}`,
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    'pragma': 'no-cache',
                    'priority': 'u=1, i',
                    'referer': 'https://ideogram.ai/t/my-images',
                    'sec-ch-ua': '"Chromium";v="136", "Microsoft Edge";v="136", "Not.A/Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0'
                }
            });

            return await res.json();
        }, access_token, user_id, all_privacy || 'true', filters || 'everything');

        await uploadPage.close();

        res.json(imagesResponse);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await initBrowser();
});