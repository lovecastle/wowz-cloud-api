const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(bodyParser.json());

const PROFILE_DIR = path.resolve(__dirname, 'gpt-profile');
if (!fs.existsSync(PROFILE_DIR)) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  console.log('Created profile directory at', PROFILE_DIR);
}

let sharedBrowser = null;

/**
 * If sharedBrowser is null or disconnected, relaunch a new Puppeteer instance.
 */
async function ensureBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  console.log('♻️ Relaunching Puppeteer because sharedBrowser was closed or null.');
  sharedBrowser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-gpu',
      '--single-process'
    ],
    defaultViewport: null,
  });

  sharedBrowser.on('disconnected', () => {
    console.warn('⚠️ sharedBrowser got disconnected—will need to relaunch on next request.');
    sharedBrowser = null;
  });

  console.log('✅ Puppeteer relaunched.');
  return sharedBrowser;
}

(async () => {
  sharedBrowser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-gpu',
      '--single-process'
    ],
    defaultViewport: null,
  });
  console.log('✅ GPT launched');

  sharedBrowser.on('disconnected', () => {
    console.warn('⚠️ sharedBrowser got disconnected—will need to relaunch on next request.');
    sharedBrowser = null;
  });
})().catch(err => {
  console.error('❌ Failed to launch GPT:', err);
  process.exit(1);
});

async function downloadImageToBase64(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    validateStatus: s => s === 200,
  });
  const buffer = Buffer.from(response.data, 'binary');
  const contentType = response.headers['content-type'] || 'image/png';
  return {
    base64: buffer.toString('base64'),
    contentType,
  };
}
const DEFAULT_URL = 'https://chatgpt.com/g/g-682b4c8d88848191accff36501109e7e-wowz-ai-assistant-remix-design';

async function runGeneration(imageUrl, promptText, targetUrl = DEFAULT_URL) {
  await ensureBrowser();
  if (!sharedBrowser) {
    throw new Error('Failed to launch or reconnect Puppeteer');
  }
  let base64 = null;
  let contentType = null;
  console.log('[runGeneration] imageUrl:', imageUrl, '| promptText:', promptText);
  if (typeof imageUrl === 'string' && imageUrl.trim() !== '') {
    const img = await downloadImageToBase64(imageUrl);
    base64 = img.base64;
    contentType = img.contentType;
    console.log('[runGeneration] Downloaded image, contentType:', contentType);
  }
  let page;
  try {
    page = await sharedBrowser.newPage();
  } catch (err) {
    console.warn('⚠️ Error when newPage():', err.message);
    await ensureBrowser();
    page = await sharedBrowser.newPage();
  }
  let authToken = null;
  try {
    page.on('request', (req) => {
      const headers = req.headers();
      if (
        !authToken &&
        req.url().includes('/backend-api/conversation') &&
        headers.authorization
      ) {
        authToken = headers.authorization;
      }
    });
    await page.evaluateOnNewDocument(() => {
      const _origFetch = window.fetch.bind(window);
      window.__conversationId = null;
      window.__assetPointers = [];
      window.fetch = async (...args) => {
        const response = await _origFetch(...args);
        if (typeof args[0] === 'string' && args[0].includes('/backend-api/conversation')) {
          try {
            const reader = response.clone().body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let done = false;
            while (!done) {
              const { value, done: rd } = await reader.read();
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                if (!window.__conversationId) {
                  const m = /"conversation_id"\s*:\s*"([^"]+)"/.exec(buffer);
                  if (m) window.__conversationId = m[1];
                }
                const directRe = /"asset_pointer"\s*:\s*"([^"]+)"/g;
                let dm;
                while ((dm = directRe.exec(buffer))) {
                  if (!window.__assetPointers.includes(dm[1])) {
                    window.__assetPointers.push(dm[1]);
                  }
                }
                const patchRe =
                  /"p"\s*:\s*"[^"]*\/asset_pointer"\s*,\s*"o"\s*:\s*"[^"]+"\s*,\s*"v"\s*:\s*"([^"]+)"/g;
                let pm;
                while ((pm = patchRe.exec(buffer))) {
                  if (!window.__assetPointers.includes(pm[1])) {
                    window.__assetPointers.push(pm[1]);
                  }
                }
              }
              done = rd;
            }
          } catch (e) {
            console.error('❌ Error SSE parsing:', e);
          }
        }
        return response;
      };
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36'
    );
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 0 });
    const promptSel = '#prompt-textarea[contenteditable="true"]';
    const signBtnSel = 'button.btn-primary.btn-giant';
    const first = await Promise.race([
      page.waitForSelector(promptSel, { visible: true }).then(() => 'prompt'),
      page.waitForSelector(signBtnSel, { visible: true }).then(() => 'signup'),
    ]);
    if (first === 'signup') {
      await page.click(signBtnSel);
      await page.waitForSelector(promptSel, { visible: true });
    }
    const promptExists = await page.$(promptSel);
    console.log('[runGeneration] Prompt selector exists:', !!promptExists);
    await page.focus(promptSel);
    if (base64 && contentType) {
      console.log('[runGeneration] Pasting image...');
      await page.evaluate(
        (base64Data, mime) => {
          const byteString = atob(base64Data);
          const len = byteString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mime });
          const file = new File([blob], 'pasted-image.png', { type: mime });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true,
          });
          const editable = document.querySelector('#prompt-textarea[contenteditable="true"]');
          editable.dispatchEvent(pasteEvent);
        },
        base64,
        contentType
      );
      await new Promise(resolve => setTimeout(resolve, 12000));
    }
    if (typeof promptText === 'string' && promptText.length > 0) {
      console.log('[runGeneration] Typing prompt:', promptText);
      await page.type(promptSel, promptText, { delay: 5 });
      await new Promise(resolve => setTimeout(resolve, 500));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log('[runGeneration] Submitting by pressing Enter');
    await page.keyboard.press('Enter');
    const conversationId = await page.evaluate(() => {
      return new Promise((resolve) => {
        const check = () => {
          if (window.__conversationId) return resolve(window.__conversationId);
          setTimeout(check, 100);
        };
        check();
      });
    });
    console.log('[runGeneration] Got conversationId:', conversationId);
    if (!(base64 && contentType)) {
      return { conversationId };
    }
    const assetPointers = await page.evaluate(() => {
      return new Promise((resolve) => {
        const checkArr = () => {
          if (window.__assetPointers.length > 0) return resolve(window.__assetPointers);
          setTimeout(checkArr, 100);
        };
        checkArr();
      });
    });
    while (!authToken) {
      await new Promise(r => setTimeout(r, 100));
    }
    let statusOK = false;
    let tries = 0;
    while (!statusOK && tries < 30) {
      const result = await page.evaluate(
        async (convId, token) => {
          const url = `https://chatgpt.com/backend-api/conversation/${convId}/async-status`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Accept: '*/*',
              'Content-Type': 'application/json',
              Authorization: token,
            },
            body: JSON.stringify({}),
          });
          if (!res.ok) return { error: `HTTP ${res.status}` };
          return await res.json();
        },
        conversationId,
        authToken
      );
      if (result?.status === 'OK') {
        statusOK = true;
      } else {
        await new Promise(r => setTimeout(r, 1500));
        tries++;
      }
    }
    if (!statusOK) {
      console.warn('[runGeneration] ⚠️ Timeout waiting async-status');
    }
    console.log('[runGeneration] Got conversationId:', conversationId, '| assetPointers:', assetPointers);
    return { conversationId, assetPointers };
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

async function runGenerationWithLimit(imageUrl, promptText, targetUrl) {
  return schedule(() => runGeneration(imageUrl, promptText, targetUrl));
}

async function getAuthTokenFromProfile() {
  
  await ensureBrowser();

  if (!sharedBrowser) {
    throw new Error('Browser chưa sẵn sàng');
  }

  const page = await sharedBrowser.newPage();
  let authToken = null;
  try {
    page.on('request', req => {
      const h = req.headers();
      if (
        !authToken &&
        req.url().includes('/backend-api/conversation') &&
        h.authorization
      ) {
        authToken = h.authorization;
      }
    });

    await page.goto(
      'https://chatgpt.com/g/g-682b4c8d88848191accff36501109e7e-wowz-ai-assistant-remix-design',
      { waitUntil: 'networkidle2', timeout: 0 }
    );

    if (!authToken) {
      const cookies = await page.cookies();
      const sessionCookie = cookies.find(c => c.name.toLowerCase().includes('session'));
      if (sessionCookie) {
        authToken = `Bearer ${sessionCookie.value}`;
      }
    }
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }

  if (!authToken) {
    throw new Error('Không lấy được authToken, bạn cần đăng nhập thủ công trước.');
  }
  return authToken;
}

async function fetchRecentImageGen(conversationIdFilter = null, pageNumber = 1) {
  if (pageNumber < 1) pageNumber = 1;
  const authToken = await getAuthTokenFromProfile();

  let currentCursor = null;
  const accumulatedItems = [];

  for (let p = 1; p <= pageNumber; p++) {
    let url = 'https://chatgpt.com/backend-api/my/recent/image_gen?limit=6';
    if (currentCursor) {
      url += `&after=${encodeURIComponent(currentCursor)}`;
    }

    const page = await sharedBrowser.newPage();
    try {
      await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2', timeout: 0 });
      await page.setExtraHTTPHeaders({
        Authorization: authToken,
        Accept: '*/*',
        'Content-Type': 'application/json',
      });

      const resp = await page.evaluate(
        async ({ fetchUrl, token }) => {
          const r = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
              Accept: '*/*',
              'Content-Type': 'application/json',
              Authorization: token,
            },
          });
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}`);
          }
          return await r.json();
        },
        { fetchUrl: url, token: authToken }
      );

      if (!resp.items || resp.items.length === 0) {
        break;
      }

      let itemsPage = resp.items;
      if (conversationIdFilter) {
        itemsPage = itemsPage.filter(item => item.conversation_id === conversationIdFilter);
      }
      accumulatedItems.push(...itemsPage);

      if (resp.cursor) {
        currentCursor = resp.cursor;
      } else {
        break;
      }
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  return accumulatedItems;
}

let activeCount = 0;
const queue = [];

/**
 * schedule(fn) sẽ đếm số task đang chạy (activeCount).
 * - Nếu activeCount < 2 → chạy ngay fn().
 * - Nếu activeCount ≥ 2 → đẩy fn() vào queue chờ.
 * Khi một fn() kết thúc hoặc ném lỗi, activeCount-- và
 * nếu queue còn fn chờ, lấy fn đầu queue chạy tiếp.
 */
function schedule(fn) {
  return new Promise((resolve, reject) => {
    const runOrEnqueue = () => {
      if (activeCount < 2) {
        activeCount++;
        fn()
          .then(result => {
            resolve(result);
            activeCount--;
            if (queue.length > 0) {
              const next = queue.shift();
              next();
            }
          })
          .catch(err => {
            reject(err);
            activeCount--;
            if (queue.length > 0) {
              const next = queue.shift();
              next();
            }
          });
      } else {
        queue.push(runOrEnqueue);
      }
    };
    runOrEnqueue();
  });
}

app.post('/gptgen', async (req, res) => {
  const { prompt, imageUrl, url } = req.body;
  console.log('Received /gptgen:', { prompt, imageUrl, url });
  if (!prompt && !imageUrl) {
    return res.status(400).json({ error: 'Thiếu prompt và imageUrl trong request body.' });
  }
  const targetUrl = url || DEFAULT_URL;
  try {
    const result = await runGenerationWithLimit(imageUrl, prompt, targetUrl);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[POST /gptgen] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/recent-images', async (req, res) => {
  try {
    const { conversationId, page } = req.body || {};
    const pageNum = parseInt(page) || 1;

    const items = await fetchRecentImageGen(conversationId, pageNum);
    return res.json({ success: true, items });
  } catch (err) {
    console.error('[POST /recent-images] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function fetchConversationViaPuppeteer(conversationId) {
  const authToken = await getAuthTokenFromProfile();
  return await schedule(async () => {
    const page = await sharedBrowser.newPage();
    try {
      await page.setExtraHTTPHeaders({
        Authorization: authToken,
        Accept: 'application/json',
      });
      await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2', timeout: 0 });
      const data = await page.evaluate(async (convId) => {
        const resp = await fetch(
          `https://chatgpt.com/backend-api/conversation/${convId}`,
          { credentials: 'include' }
        );
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        return await resp.json();
      }, conversationId);

      return data;
    } finally {
      await page.close();
    }
  });
}

app.post('/conversation-prompt', async (req, res) => {
  const { conversationId } = req.body;
  if (!conversationId) {
    return res.status(400).json({ error: 'Thiếu conversationId trong body.' });
  }

  try {
    const conversationData = await fetchConversationViaPuppeteer(conversationId);

    let promptText = null;
    let foundNode = null;

    for (const [nodeId, node] of Object.entries(conversationData.mapping || {})) {
      const parts = node.message?.content?.parts;
      if (!Array.isArray(parts)) continue;

      const strings = parts.filter(p => typeof p === 'string');
      for (const txt of strings) {
        const m = /```([\s\S]*?)```/.exec(txt);
        if (m && m[1]) {
          promptText = m[1].trim();
          foundNode = nodeId;
          break;
        }
      }
      if (promptText) break;
    }

    if (!promptText) {
      return res.status(200).json({
        success: false,
        prompt: '',
        debugCheckedNodes: Object.keys(conversationData.mapping || {}),
      });
    }

    return res.json({ success: true, nodeId: foundNode, prompt: promptText });

  } catch (err) {
    console.error('[POST /conversation-prompt] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
