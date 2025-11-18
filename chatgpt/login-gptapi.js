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


const COOKIE_FILE = path.resolve(__dirname, 'chatgpt-cookies.json');

/**
 * loadCookies: Đọc file chatgpt-cookies.json và trả về mảng cookie
 * Nếu file không tồn tại hoặc lỗi, trả về null
 */
async function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const raw = fs.readFileSync(COOKIE_FILE, 'utf-8');
      const cookies = JSON.parse(raw);
      return cookies;
    }
  } catch (e) {
    console.warn('[loadCookies] Không đọc được file cookie:', e);
  }
  return null;
}

let sharedBrowser = null;
let activeCount = 0;
const queue = [];

/**
 * schedule(fn): giới hạn số task đang chạy đồng thời (max 2)
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

(async () => {
  sharedBrowser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    userDataDir: 'gpt-profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('✅ GPT launched');
})().catch(err => {
  console.error('❌ Failed to launch GPT:', err);
  process.exit(1);
});

/**
 * downloadImageToBase64: tải image từ URL và trả về { base64, contentType }
 */
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

/**
 * runGeneration: chạy Puppeteer để paste image + prompt lên ChatGPT và thu về conversationId, assetPointers
 * Lần đầu mở, nếu cookie chưa hợp lệ, sẽ chuyển sang flow đăng nhập thủ công và sau đó lưu cookie mới
 */
async function runGeneration(imageUrl, promptText) {
  if (!sharedBrowser) {
    throw new Error('Browser chưa sẵn sàng');
  }

  
  const { base64, contentType } = await downloadImageToBase64(imageUrl);

  
  const page = await sharedBrowser.newPage();

  
  try {
    const cookies = await loadCookies();
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log('[runGeneration] Đã nạp cookie từ file.');
    } else {
      console.log('[runGeneration] Không tìm thấy cookie hoặc file rỗng.');
    }
  } catch (e) {
    console.warn('[runGeneration] Lỗi khi nạp cookie:', e);
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

    
    await page.goto(
      'https://chatgpt.com/g/g-682b4c8d88848191accff36501109e7e-wowz-ai-assistant-remix-design',
      { waitUntil: 'networkidle2', timeout: 0 }
    );

    
    const promptSel = '#prompt-textarea[contenteditable="true"]';
    const signBtnSel = 'button.btn-primary.btn-giant';
    const first = await Promise.race([
      page.waitForSelector(promptSel, { visible: true }).then(() => 'prompt'),
      page.waitForSelector(signBtnSel, { visible: true }).then(() => 'signup'),
    ]);

    if (first === 'signup') {
      console.log('[runGeneration] Chưa đăng nhập – chuyển sang flow đăng nhập thủ công.');
      await page.click(signBtnSel);
      await page.waitForSelector(promptSel, { visible: true });

      
      const newCookies = await page.cookies();
      try {
        fs.writeFileSync(COOKIE_FILE, JSON.stringify(newCookies, null, 2), 'utf-8');
        console.log('[runGeneration] Lưu cookie mới vào chatgpt-cookies.json.');
      } catch (e) {
        console.warn('[runGeneration] Lỗi khi ghi cookie mới:', e);
      }
    } else {
      console.log('[runGeneration] Đã vào được prompt ngay lập tức (cookie hợp lệ).');
    }
    

    
    await page.focus(promptSel);
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

    
    await page.type(promptSel, promptText, { delay: 5 });
    await new Promise(resolve => setTimeout(resolve, 500));
    await new Promise(resolve => setTimeout(resolve, 3000));

    
    const submitBtn = await page.$('#composer-submit-button');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      throw new Error('Không tìm thấy nút submit sau khi chờ');
    }

    
    const conversationId = await page.evaluate(() => {
      return new Promise((resolve) => {
        const check = () => {
          if (window.__conversationId) return resolve(window.__conversationId);
          setTimeout(check, 100);
        };
        check();
      });
    });

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

    return { conversationId, assetPointers };
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

/**
 * runGenerationWithLimit: Gói runGeneration vào schedule để giới hạn concurrency
 */
async function runGenerationWithLimit(imageUrl, promptText) {
  return schedule(() => runGeneration(imageUrl, promptText));
}

/**
 * getAuthTokenFromProfile: mở trang ChatGPT, tự động nạp cookie và lấy token
 * Nếu chưa có cookie hợp lệ, sẽ yêu cầu đăng nhập thủ công
 */
async function getAuthTokenFromProfile() {
  if (!sharedBrowser) {
    throw new Error('Browser chưa sẵn sàng');
  }
  const page = await sharedBrowser.newPage();

  
  try {
    const cookies = await loadCookies();
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log('[getAuthTokenFromProfile] Đã nạp cookie từ file.');
    }
  } catch (e) {
    console.warn('[getAuthTokenFromProfile] Lỗi khi nạp cookie:', e);
  }
  

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
      
      if (!authToken) {
        throw new Error('Không lấy được authToken, bạn cần đăng nhập thủ công trước.');
      }
    }
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }

  return authToken;
}

/**
 * fetchRecentImageGen: Lấy danh sách ảnh đã generate gần đây (có pagination)
 */
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

app.post('/gptgen', async (req, res) => {
  const { prompt, imageUrl } = req.body;
  if (!prompt || !imageUrl) {
    return res.status(400).json({ error: 'Thiếu prompt hoặc imageUrl trong request body.' });
  }
  try {
    const result = await runGenerationWithLimit(imageUrl, prompt);
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
