const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const axios = require('axios');
const config = require('./config');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.resolve(__dirname, 'cookies.json');
const PROFILE_PATH = path.resolve(__dirname, 'midjourney-profile');

class PuppeteerMidjourneyAPI {
  constructor() {
    this.apiUrl = config.apiUrl;
    this.channelId = config.channelId;
    this.browser = null;
    this.page = null;
    this.cookies = null;
    this.isAuthenticated = false;
  }
  async initBrowser() {
    try {
      console.log('🚀 Đang khởi tạo browser với profile:', PROFILE_PATH);
      
      this.browser = await puppeteer.launch({
        headless: "new",
        userDataDir: PROFILE_PATH,
        defaultViewport: { width: 1280, height: 720 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-plugins',
          '--memory-pressure-off',
          '--max_old_space_size=256',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });
      if (fs.existsSync(COOKIES_PATH)) {
        console.log('🍪 Đang import cookies từ file:', COOKIES_PATH);
        const cookiesArr = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        await this.page.goto('https://www.midjourney.com', { waitUntil: 'networkidle2' });
        for (const cookie of cookiesArr) {
          await this.page.setCookie({ ...cookie, url: 'https://www.midjourney.com' });
        }
        console.log('✅ Đã import cookies thành công!');
      }

      console.log('✅ Browser đã được khởi tạo thành công!');
      return true;
    } catch (error) {
      console.error('❌ Lỗi khởi tạo browser:', error.message);
      return false;
    }
  }
  async extractCookies() {
    try {
      console.log('🍪 Đang lấy cookies...');
      
      const cookies = await this.page.cookies();
      this.cookies = {};
      
      cookies.forEach(cookie => {
        this.cookies[cookie.name] = cookie.value;
      });
      
      console.log('✅ Đã lấy được cookies:', Object.keys(this.cookies));
      return this.cookies;
    } catch (error) {
      console.error('❌ Lỗi lấy cookies:', error.message);
      return null;
    }
  }
  async getBrowserData() {
    try {
      console.log('🔍 Đang lấy dữ liệu từ browser...');
      await this.page.goto('https://www.midjourney.com/imagine', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      const browserData = await this.page.evaluate(() => {
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        }, {});
        const channelId = localStorage.getItem('channelId') || 
                         sessionStorage.getItem('channelId') ||
                         window.channelId ||
                         document.querySelector('[data-channel-id]')?.getAttribute('data-channel-id') ||
                         window.__MIDJOURNEY_CHANNEL_ID__;
        const midjourneyData = window.__MIDJOURNEY_DATA__ || {};
        
        return {
          cookies,
          channelId,
          midjourneyData,
          userAgent: navigator.userAgent,
          url: window.location.href
        };
      });
      
      this.cookies = browserData.cookies;
      this.channelId = browserData.channelId || this.channelId;
      
      console.log('✅ Đã lấy được dữ liệu từ browser:');
      console.log('🍪 Cookies:', Object.keys(this.cookies));
      console.log('🆔 ChannelId:', this.channelId);
      console.log('🌐 URL:', browserData.url);
      
      return browserData;
    } catch (error) {
      console.error('❌ Lỗi lấy dữ liệu từ browser:', error.message);
      return null;
    }
  }
  async generateImageFromConsole(prompt, options = {}) {
    try {
      console.log('🎨 Đang gọi API generate ảnh từ browser context...');
      console.log('📝 Prompt:', prompt);
      if (!this.cookies) {
        console.log('⚠️ Chưa có cookies, đang lấy từ browser...');
        await this.getBrowserData();
      }
      await this.page.goto('https://www.midjourney.com/imagine', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await this.page.evaluate(async (prompt, options, channelId) => {
        try {
          const requestData = {
            f: {
              mode: options.mode || "relaxed",
              private: options.private || false
            },
            channelId: channelId,
            roomId: null,
            metadata: {
              isMobile: null,
              imagePrompts: 1,
              imageReferences: 0,
              characterReferences: 0,
              depthReferences: 0,
              lightboxOpen: null
            },
            t: "imagine",
            prompt: prompt
          };

          console.log('🚀 Đang gửi request đến API...');
          console.log('📊 Request data:', requestData);
          const response = await fetch('/api/submit-jobs', {
            method: 'POST',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          });

          const data = await response.json();
          
          console.log('📊 Response status:', response.status);
          console.log('📊 Response data:', data);
          
          return {
            success: response.ok,
            status: response.status,
            data: data,
            headers: Object.fromEntries(response.headers.entries())
          };
        } catch (error) {
          console.error('❌ Lỗi trong browser:', error);
          return {
            success: false,
            error: error.message
          };
        }
      }, prompt, options, this.channelId);

      if (result.success) {
        console.log('✅ API call thành công!');
        console.log('📊 Full Response Data:', JSON.stringify(result.data, null, 2));
        
        const jobId = result.data?.id || 
                     result.data?.jobId || 
                     result.data?.job_id || 
                     result.data?.taskId ||
                     result.data?.task_id ||
                     result.data?.requestId ||
                     result.data?.request_id;
        
        const status = result.data?.status || 
                      result.data?.state || 
                      result.data?.phase ||
                      result.data?.progress;
        
        console.log('📊 Job ID:', jobId || 'Không tìm thấy');
        console.log('📊 Status:', status || 'Không tìm thấy');
        
        return {
          success: true,
          data: result.data,
          message: 'Yêu cầu tạo ảnh đã được gửi thành công',
          retryCount: retryCount,
          jobId: jobId,
          status: status
        };
      } else {
        console.error('❌ API call thất bại:', result.error);
        console.error('📊 Error data:', result.data);
        return {
          success: false,
          error: result.error,
          data: result.data
        };
      }

    } catch (error) {
      console.error('❌ Lỗi khi gọi API từ browser context:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  async saveCookiesToFile() {
    try {
      if (!this.cookies) {
        console.log('⚠️ Chưa có cookies để lưu');
        return false;
      }
      const cookiesArray = Object.entries(this.cookies).map(([name, value]) => ({
        name,
        value,
        domain: '.midjourney.com',
        path: '/'
      }));

      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookiesArray, null, 2));
      console.log('✅ Đã lưu cookies vào file:', COOKIES_PATH);
      return true;
    } catch (error) {
      console.error('❌ Lỗi lưu cookies:', error.message);
      return false;
    }
  }
  async extractChannelId() {
    try {
      console.log('🆔 Đang lấy channelId...');
      await this.page.goto('https://www.midjourney.com/imagine', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      const channelId = await this.page.evaluate(() => {
        return localStorage.getItem('channelId') || 
               sessionStorage.getItem('channelId') ||
               window.channelId ||
               document.querySelector('[data-channel-id]')?.getAttribute('data-channel-id');
      });
      
      if (channelId) {
        this.channelId = channelId;
        console.log('✅ Đã lấy được channelId:', channelId);
        return channelId;
      } else {
        console.log('⚠️ Không tìm thấy channelId, sử dụng giá trị mặc định');
        return this.channelId;
      }
    } catch (error) {
      console.error('❌ Lỗi lấy channelId:', error.message);
      return this.channelId;
    }
  }
  getCookieString() {
    if (!this.cookies) return '';
    
    return Object.entries(this.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }
  sanitizePrompt(description) {
    if (!description || typeof description !== 'string') {
      return description;
    }

    // Remove all quote types that confuse Midjourney's parameter parser
    // Midjourney's CLI-style parser treats text after quotes as parameter flags
    let sanitized = description
      .replace(/[\u201C\u201D]/g, '')   // Remove smart double quotes (" ")
      .replace(/[\u2018\u2019]/g, '')   // Remove smart single quotes (' ')
      .replace(/["'`]/g, '')            // Remove all regular quotes and backticks
      .replace(/\\/g, '');              // Remove backslashes (escape characters)

    // Remove or escape characters that might confuse Midjourney's parser
    // Keep the prompt readable but safe
    sanitized = sanitized
      .replace(/\s+/g, ' ')   // Normalize multiple spaces to single space
      .trim();                // Remove leading/trailing whitespace

    return sanitized;
  }

  async createPrompt(url_image, description, options = {}) {
    const {
      chaos = 5,
      ar = '4:3',
      stylize = 150,
      weird = 200,
      version = 7,
      quality = 'normal',
      stop = null,
      tile = false,
      niji = false
    } = options;

    // Sanitize the description to prevent parsing issues
    const originalLength = description ? description.length : 0;
    let prompt = this.sanitizePrompt(description);
    const sanitizedLength = prompt ? prompt.length : 0;

    if (originalLength !== sanitizedLength) {
      console.log(`🧹 Prompt sanitized: ${originalLength} chars → ${sanitizedLength} chars`);
    }

    if (url_image) {
      try {
        console.log('🖼️ Đang upload ảnh từ URL:', url_image);
        const shortUrl = await this.uploadImageToMidjourney(url_image);
        console.log('✅ Upload ảnh thành công, shortUrl:', shortUrl);
        prompt = `${shortUrl} ${prompt}`;
      } catch (error) {
        console.error('❌ Lỗi upload ảnh:', error.message);
        // Keep the sanitized prompt even if image upload fails
      }
    }
    
    prompt += ` --chaos ${chaos}`;
    prompt += ` --ar ${ar}`;
    prompt += ` --stylize ${stylize}`;
    prompt += ` --weird ${weird}`;
    prompt += ` --v ${version}`;
    
    if (quality !== 'normal') {
      prompt += ` --q ${quality}`;
    }
    
    if (stop) {
      prompt += ` --stop ${stop}`;
    }
    
    if (tile) {
      prompt += ' --tile';
    }
    
    if (niji) {
      prompt += ' --niji';
    }

    return prompt;
  }
  async generateImage(prompt, options = {}) {
    try {
      console.log('🚀 Đang gửi yêu cầu tạo ảnh...');
      console.log('📝 Prompt:', prompt);
      if (!this.cookies) {
        console.log('⚠️ Chưa có cookies, đang lấy...');
        await this.extractCookies();
      }

      const requestData = {
        f: {
          mode: options.mode || "relaxed",
          private: options.private || false
        },
        channelId: this.channelId,
        roomId: null,
        metadata: {
          isMobile: null,
          imagePrompts: 1,
          imageReferences: 0,
          characterReferences: 0,
          depthReferences: 0,
          lightboxOpen: null
        },
        t: "imagine",
        prompt: prompt
      };

      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Content-Type': 'application/json',
          'Origin': 'https://www.midjourney.com',
          'Referer': 'https://www.midjourney.com/imagine',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'Cookie': this.getCookieString()
        },
        timeout: 30000
      });

      console.log('✅ Yêu cầu thành công!');
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      
      return {
        success: true,
        data: response.data,
        message: 'Yêu cầu tạo ảnh đã được gửi thành công'
      };

    } catch (error) {
      console.error('❌ Lỗi khi gọi API:', error.message);
      
      if (error.response) {
        console.error('📊 Response data:', error.response.data);
        console.error('📊 Response status:', error.response.status);
      }

      return {
        success: false,
        error: error.message,
        data: error.response?.data || null,
        status: error.response?.status || null
      };
    }
  }
  async generateImageFromUrl(imageUrl, description, options = {}) {
    const prompt = await this.createPrompt(imageUrl, description, options);
    return await this.generateImage(prompt, options);
  }
  async generateImageDirectly(prompt, options = {}) {
    try {
      console.log('🎨 Đang tạo ảnh trực tiếp từ browser...');
      console.log('📝 Prompt:', prompt);
      await this.page.goto('https://www.midjourney.com/imagine', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await this.page.waitForSelector('input[placeholder*="prompt"], textarea[placeholder*="prompt"], input[type="text"]', { timeout: 10000 });
      await this.page.click('input[placeholder*="prompt"], textarea[placeholder*="prompt"], input[type="text"]');
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('A');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      await this.page.type('input[placeholder*="prompt"], textarea[placeholder*="prompt"], input[type="text"]', prompt);
      await this.page.keyboard.press('Enter');
      
      console.log('✅ Đã gửi prompt thành công!');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return {
        success: true,
        message: 'Prompt đã được gửi thành công qua browser'
      };

    } catch (error) {
      console.error('❌ Lỗi tạo ảnh trực tiếp:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  async checkAuthStatus() {
    try {
      console.log('🔍 Kiểm tra trạng thái đăng nhập...');
      
      if (!this.page) {
        return { isLoggedIn: false, error: 'Browser chưa được khởi tạo' };
      }
      await this.page.goto('https://www.midjourney.com/imagine', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      const isLoggedIn = await this.page.evaluate(() => {
        const createButton = document.querySelector('p.relative.truncate.text-sm.font-semibold');
        if (createButton && createButton.textContent.trim() === 'Create') {
          return true;
        }
        const promptInput = document.querySelector('textarea#desktop_input_bar');
        if (promptInput && promptInput.placeholder === 'What will you imagine?') {
          return true;
        }
        const inputContainer = document.querySelector('div.flex.shrink-0.rounded-xl.border.border-light-100.bg-light-input');
        if (inputContainer) {
          return true;
        }
        const userSelectors = [
          '.user-avatar',
          '[data-user]',
          '.profile',
          '.user-menu',
          '.account-menu',
          '[data-testid="user-menu"]',
          '.avatar',
          '.user-info'
        ];
        const loginSelectors = [
          'a[href*="login"]',
          'a[href*="signin"]',
          '.login-button',
          '.signin-button',
          '[data-testid="login"]'
        ];
        const hasUser = userSelectors.some(selector => document.querySelector(selector));
        const hasLogin = loginSelectors.some(selector => document.querySelector(selector));
        const hasAuthToken = localStorage.getItem('authToken') || 
                           sessionStorage.getItem('authToken') ||
                           localStorage.getItem('token') ||
                           sessionStorage.getItem('token');
        
        return hasUser || hasAuthToken || !hasLogin;
      });

      if (isLoggedIn) {
        console.log('✅ Đã đăng nhập thành công!');
        this.isAuthenticated = true;
        await this.extractCookies();
        return { isLoggedIn: true, success: true };
      } else {
        console.log('❌ Chưa đăng nhập - cần đăng nhập thủ công');
        return { isLoggedIn: false, success: false, error: 'Chưa đăng nhập' };
      }
    } catch (error) {
      console.error('❌ Lỗi kiểm tra auth:', error.message);
      return { isLoggedIn: false, success: false, error: error.message };
    }
  }
  async closeBrowser() {
    if (this.browser) {
      console.log('🔒 Đang đóng browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('✅ Browser đã được đóng');
    }
  }
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async main() {
    try {
      const browserInit = await this.initBrowser();
      if (!browserInit) {
        console.log('❌ Không thể khởi tạo browser');
        return;
      }
      const authStatus = await this.checkAuthStatus();
      
      if (!authStatus.success) {
        console.log('⚠️ Chưa đăng nhập, vui lòng đăng nhập thủ công trong browser');
        console.log('📝 Sau khi đăng nhập xong, nhấn Enter để tiếp tục...');
        await new Promise(resolve => {
          process.stdin.once('data', resolve);
        });
        const newAuthStatus = await this.checkAuthStatus();
        if (!newAuthStatus.success) {
          console.log('❌ Vẫn chưa đăng nhập thành công');
          return;
        }
      }
      console.log('\n=== LẤY DỮ LIỆU TỪ BROWSER ===');
      const browserData = await this.getBrowserData();
      if (browserData) {
        await this.saveCookiesToFile();
      }
      console.log('\n=== VÍ DỤ 1: Tạo ảnh qua API Node.js ===');
      const result1 = await this.generateImage("A beautiful cat in a garden, digital art --chaos 5 --ar 4:3 --stylize 150 --v 7");
      console.log('Kết quả:', result1);
      console.log('\n=== VÍ DỤ 2: Tạo ảnh từ browser console ===');
      const result2 = await this.generateImageFromConsole("A majestic dragon flying over mountains at sunset, epic fantasy art --chaos 10 --ar 16:9 --stylize 200 --v 7");
      console.log('Kết quả:', result2);
      console.log('\n=== VÍ DỤ 3: Tạo ảnh trực tiếp từ browser UI ===');
      const result3 = await this.generateImageDirectly("A cute robot playing with a cat, anime style --niji --ar 1:1 --stylize 100");
      console.log('Kết quả:', result3);

    } catch (error) {
      console.error('❌ Lỗi:', error);
    } finally {
      await this.closeBrowser();
    }
  }
  generateConsoleScript(prompt, options = {}) {
    const requestData = {
      f: {
        mode: options.mode || "relaxed",
        private: options.private || false
      },
      channelId: this.channelId,
      roomId: null,
      metadata: {
        isMobile: null,
        imagePrompts: 1,
        imageReferences: 0,
        characterReferences: 0,
        depthReferences: 0,
        lightboxOpen: null
      },
      t: "imagine",
      prompt: prompt
    };

    const script = `
(async () => {
  try {
    console.log('🎨 Đang gửi yêu cầu tạo ảnh...');
    console.log('📝 Prompt: "${prompt}"');
    
    const response = await fetch('/api/submit-jobs', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(${JSON.stringify(requestData, null, 2)})
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Thành công!');
      console.log('📊 Response:', data);
      return data;
    } else {
      console.error('❌ Lỗi:', data);
      return data;
    }
  } catch (error) {
    console.error('❌ Lỗi:', error);
    return { error: error.message };
  }
})();
    `;

    return script;
  }
  printConsoleScript(prompt, options = {}) {
    const script = this.generateConsoleScript(prompt, options);
    console.log('\n📋 Script JavaScript để chạy trong console browser:');
    console.log('='.repeat(60));
    console.log(script);
    console.log('='.repeat(60));
    console.log('📝 Copy script trên và paste vào console của browser (F12)');
    return script;
  }
  async interceptRequests() {
    try {
      console.log('🔍 Đang intercept network requests...');
      await this.page.setRequestInterception(true);
      
      this.page.on('request', request => {
        if (request.url().includes('/api/submit-jobs')) {
          console.log('📡 Intercepted API request:');
          console.log('URL:', request.url());
          console.log('Method:', request.method());
          console.log('Headers:', request.headers());
          console.log('Post Data:', request.postData());
        }
        if (!request.isInterceptResolutionHandled()) {
          request.continue();
        }
      });

      this.page.on('response', response => {
        if (response.url().includes('/api/submit-jobs')) {
          console.log('📡 Intercepted API response:');
          console.log('Status:', response.status());
          console.log('Headers:', response.headers());
          response.text().then(text => {
            console.log('Response body:', text);
          }).catch(err => {
            console.log('Không thể đọc response body:', err.message);
          });
        }
      });

    } catch (error) {
      console.error('❌ Lỗi intercept requests:', error.message);
    }
  }
  async disableRequestInterception() {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.page.setRequestInterception(false);
      console.log('✅ Đã tắt request interception');
    } catch (error) {
      console.log('⚠️ Request interception có thể đã được tắt:', error.message);
    }
  }
  async generateImageRealistic(prompt, options = {}) {
    let apiResponse = null;
    let requestInterceptionEnabled = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`🎨 Đang gọi API generate ảnh (attempt ${retryCount + 1}/${maxRetries})...`);
        console.log('📝 Prompt:', prompt);
        const authStatus = await this.checkAuthStatus();
        if (!authStatus.isLoggedIn) {
          console.log('⚠️ Session đã hết hạn, đang khởi tạo lại...');
          await this.initBrowser();
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        await this.page.goto('https://www.midjourney.com/imagine', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('🔍 Đang intercept network requests...');
        await this.page.setRequestInterception(true);
        requestInterceptionEnabled = true;
        this.page.removeAllListeners('request');
        this.page.removeAllListeners('response');
        
        this.page.on('request', request => {
          if (request.url().includes('/api/submit-jobs')) {
            console.log('📡 Intercepted API request:');
            console.log('URL:', request.url());
            console.log('Method:', request.method());
            console.log('Post Data:', request.postData());
          }
          if (!request.isInterceptResolutionHandled() && requestInterceptionEnabled) {
            try {
              request.continue();
            } catch (e) {
            }
          }
        });

        this.page.on('response', async response => {
          if (response.url().includes('/api/submit-jobs')) {
            console.log('📡 Intercepted API response:');
            console.log('Status:', response.status());
            try {
              const responseText = await response.text();
              console.log('Response body:', responseText);
              apiResponse = JSON.parse(responseText);
            } catch (err) {
              console.log('Không thể đọc response body:', err.message);
            }
          }
        });
        await this.page.waitForSelector('textarea#desktop_input_bar', { timeout: 10000 });
        await this.page.click('textarea#desktop_input_bar');
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('A');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Backspace');
        await this.page.type('textarea#desktop_input_bar', prompt);
        await this.page.keyboard.press('Enter');
        
        console.log('✅ Đã gửi prompt thành công!');
        const responsePromise = new Promise((resolve) => {
          const checkResponse = () => {
            if (apiResponse) {
              resolve();
            } else {
              setTimeout(checkResponse, 1000);
            }
          };
          checkResponse();
        });
        await Promise.race([
          responsePromise,
          new Promise(resolve => setTimeout(resolve, 30000))
        ]);
        if (requestInterceptionEnabled) {
          try {
            requestInterceptionEnabled = false;
            await this.page.setRequestInterception(false);
            console.log('🔍 Đã tắt request interception');
          } catch (e) {
            console.log('⚠️ Không thể tắt request interception:', e.message);
          }
        }
        
        if (apiResponse) {
          return {
            success: true,
            message: 'Prompt đã được gửi thành công',
            data: apiResponse,
            retryCount: retryCount
          };
        } else {
          throw new Error('Không nhận được response từ API');
        }

      } catch (error) {
        console.error(`❌ Lỗi generate ảnh realistic (attempt ${retryCount + 1}):`, error.message);
        if (requestInterceptionEnabled) {
          try {
            requestInterceptionEnabled = false;
            await this.page.setRequestInterception(false);
            console.log('🔍 Đã tắt request interception do lỗi');
          } catch (e) {
          }
        }

        retryCount++;
        
        if (retryCount >= maxRetries) {
          return {
            success: false,
            error: `Đã thử ${maxRetries} lần nhưng không thành công: ${error.message}`,
            retryCount: retryCount
          };
        }
        console.log(`⏳ Đợi ${retryCount * 2} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
      }
    }
  }
  async generateImageSimple(prompt, options = {}) {
    try {
      console.log('🎨 Đang gọi API generate ảnh (simple mode)...');
      console.log('📝 Prompt:', prompt);
      await this.page.goto('https://www.midjourney.com/imagine', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.page.waitForSelector('textarea#desktop_input_bar', { timeout: 10000 });
      await this.page.click('textarea#desktop_input_bar');
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('A');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      await this.page.type('textarea#desktop_input_bar', prompt);
      await this.page.keyboard.press('Enter');
      
      console.log('✅ Đã gửi prompt thành công!');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return {
        success: true,
        message: 'Prompt đã được gửi thành công',
        prompt: prompt
      };

    } catch (error) {
      console.error('❌ Lỗi generate ảnh simple:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  async uploadImageToMidjourney(url_image) {
    try {
      const path = require('path');
      const fs = require('fs');
      const tmp = require('os').tmpdir();
      const res = await axios.get(url_image, { responseType: 'arraybuffer' });
      if (res.status !== 200) throw new Error('Không tải được ảnh từ url_image');
      const buffer = Buffer.from(res.data);
      const ext = path.extname(url_image).split('?')[0] || '.png';
      const filename = `upload_${Date.now()}${ext}`;
      const filepath = path.join(tmp, filename);
      fs.writeFileSync(filepath, buffer);
      const fileData = fs.readFileSync(filepath);
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      const result = await this.page.evaluate(async (fileDataBase64, filename, mimeType) => {
        function base64ToBlob(base64, mimeType) {
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          return new Blob([byteArray], { type: mimeType });
        }
        const base64 = fileDataBase64;
        const blob = base64ToBlob(base64, mimeType);
        const formData = new FormData();
        formData.append('file', blob, filename);
        const resp = await fetch('https://www.midjourney.com/api/storage-upload-file', {
          method: 'POST',
          body: formData,
          headers: {
            'x-csrf-protection': '1',
            'accept': 'application/json',
          },
          credentials: 'include',
        });
        const json = await resp.json();
        return json;
      }, fileData.toString('base64'), filename, mimeType);
      fs.unlinkSync(filepath);

      if (result && result.shortUrl) {
        return result.shortUrl;
      } else {
        throw new Error('Không upload được ảnh lên Midjourney');
      }
    } catch (err) {
      console.error('❌ Lỗi upload ảnh lên Midjourney:', err.message);
      throw err;
    }
  }
  async generateVideoFromImage(imageUrl, options = {}) {
    let apiResponse = null;
    let requestInterceptionEnabled = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log('🎬 Đang generate video từ ảnh...');
        console.log('🖼️ Image URL:', imageUrl);
        console.log('⚙️ Options:', options);

        const authStatus = await this.checkAuthStatus();
        if (!authStatus.isLoggedIn) {
          console.log('⚠️ Session đã hết hạn, đang khởi tạo lại...');
          await this.initBrowser();
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log('🖼️ Đang upload ảnh...');
        const shortUrl = await this.uploadImageToMidjourney(imageUrl);
        console.log('✅ Upload ảnh thành công, shortUrl:', shortUrl);

        const {
          chaos = 5,
          ar = '4:3',
          motion = 'high',
          mode = 'fast',
          private: isPrivate = false,
          text_prompt = 'cinematic video, smooth motion'
        } = options;


        const videoPrompt = `${text_prompt} ${shortUrl} --chaos ${chaos} --ar ${ar} --motion ${motion} --video 1`;
        console.log('📝 Video prompt:', videoPrompt);

        await this.page.goto('https://www.midjourney.com/imagine', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('🔍 Đang intercept network requests...');
        await this.page.setRequestInterception(true);
        requestInterceptionEnabled = true;

        this.page.removeAllListeners('request');
        this.page.removeAllListeners('response');
        
        this.page.on('request', request => {
          if (request.url().includes('/api/submit-jobs')) {
            console.log('📡 Intercepted video API request:');
            console.log('URL:', request.url());
            console.log('Method:', request.method());
            console.log('Post Data:', request.postData());
          }
          
          if (!request.isInterceptResolutionHandled() && requestInterceptionEnabled) {
            try {
              request.continue();
            } catch (e) {

            }
          }
        });

        this.page.on('response', async response => {
          if (response.url().includes('/api/submit-jobs')) {
            console.log('📡 Intercepted video API response:');
            console.log('Status:', response.status());
            try {
              const responseText = await response.text();
              console.log('Response body:', responseText);
              apiResponse = JSON.parse(responseText);
            } catch (err) {
              console.log('Không thể đọc response body:', err.message);
            }
          }
        });


        const result = await this.page.evaluate(async (videoPrompt, options, channelId) => {
          try {
            const requestData = {
              f: {
                mode: options.mode || "fast",
                private: options.private || false
              },
              channelId: channelId,
              roomId: null,
              metadata: {
                isMobile: null,
                imagePrompts: null,
                imageReferences: null,
                characterReferences: null,
                depthReferences: null,
                lightboxOpen: null
              },
              t: "video",
              videoType: "vid_1.1_i2v_480",
              newPrompt: videoPrompt,
              parentJob: null,
              animateMode: "manual"
            };

            console.log('🎬 Đang gửi video request đến API...');
            console.log('📊 Video request data:', requestData);
            
            const response = await fetch('/api/submit-jobs', {
              method: 'POST',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'x-csrf-protection': '1'
              },
              body: JSON.stringify(requestData)
            });

            const data = await response.json();
            
            console.log('📊 Video response status:', response.status);
            console.log('📊 Video response data:', data);
            
            return {
              success: response.ok,
              status: response.status,
              data: data
            };
          } catch (error) {
            console.error('❌ Lỗi gọi video API:', error);
            return {
              success: false,
              error: error.message
            };
          }
        }, videoPrompt, options, this.channelId);


        if (requestInterceptionEnabled) {
          try {
            requestInterceptionEnabled = false;
            await this.page.setRequestInterception(false);
            console.log('🔍 Đã tắt request interception');
          } catch (e) {
            console.log('⚠️ Không thể tắt request interception:', e.message);
          }
        }

        if (result.success) {
          return {
            success: true,
            message: 'Video generation đã được gửi thành công',
            data: result.data,
            retryCount: retryCount,
            imageUrl: shortUrl,
            prompt: videoPrompt
          };
        } else {
          throw new Error(`Video API error: ${result.error || 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`❌ Lỗi generate video (attempt ${retryCount + 1}):`, error.message);
        
        if (requestInterceptionEnabled) {
          try {
            requestInterceptionEnabled = false;
            await this.page.setRequestInterception(false);
            console.log('🔍 Đã tắt request interception do lỗi');
          } catch (e) {

          }
        }

        retryCount++;
        
        if (retryCount >= maxRetries) {
          return {
            success: false,
            error: `Đã thử ${maxRetries} lần nhưng không thành công: ${error.message}`,
            retryCount: retryCount
          };
        }

        console.log(`⏳ Đợi ${retryCount * 2} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
      }
    }
  }
  /**
   * @param {string} url 
   * @returns {Promise<{buffer: Buffer, contentType: string}>}
   */
  async downloadImageViaBrowser(url) {
    try {
      console.log('🌐 Đang tải file qua browser:', url);
      const page = await this.browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
      
      const isVideo = url.includes('.mp4') || url.includes('/video/');
      const timeout = isVideo ? 120000 : 30000; 
      
      await page.setExtraHTTPHeaders({
        'Accept': isVideo ? 'video/mp4,video/*,*/*;q=0.8' : 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.midjourney.com/',
        'Origin': 'https://www.midjourney.com/'
      });
      
      const result = await page.evaluate(async (url, isVideo) => {
        try {
          console.log('🌐 Đang fetch:', url);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': isVideo ? 'video/mp4,video/*,*/*;q=0.8' : 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Referer': 'https://www.midjourney.com/',
              'Origin': 'https://www.midjourney.com/'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          
          return {
            success: true,
            base64: base64,
            contentType: contentType,
            size: arrayBuffer.byteLength
          };
        } catch (error) {
          console.error('❌ Lỗi fetch:', error);
          return {
            success: false,
            error: error.message
          };
        }
      }, url, isVideo);
      
      await page.close();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const buffer = Buffer.from(result.base64, 'base64');
      
      console.log(`✅ Đã tải thành công: ${buffer.length} bytes`);
      console.log(`📊 Content-Type: ${result.contentType}`);
      
      return { buffer, contentType: result.contentType };
    } catch (error) {
      console.error('❌ Lỗi tải file qua browser:', error.message);
      throw error;
    }
  }
  async generateImageViaAPI(prompt, options = {}) {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`🎨 Đang gọi API generate ảnh (attempt ${retryCount + 1}/${maxRetries})...`);
        console.log('📝 Prompt:', prompt);
        
        const authStatus = await this.checkAuthStatus();
        if (!authStatus.isLoggedIn) {
          console.log('⚠️ Session đã hết hạn, đang khởi tạo lại...');
          await this.initBrowser();
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!this.cookies || !this.channelId) {
          console.log('🔄 Đang lấy dữ liệu từ browser...');
          await this.getBrowserData();
        }

        const result = await this.page.evaluate(async (prompt, options, channelId) => {
          try {
            const requestData = {
              f: {
                mode: options.mode || "relaxed",
                private: options.private || false
              },
              channelId: channelId,
              roomId: null,
              metadata: {
                isMobile: null,
                imagePrompts: 1,
                imageReferences: 0,
                characterReferences: 0,
                depthReferences: 0,
                lightboxOpen: null
              },
              t: "imagine",
              prompt: prompt
            };

            console.log('🚀 Đang gửi request đến API...');
            console.log('📊 Request data:', requestData);
            
            const response = await fetch('/api/submit-jobs', {
              method: 'POST',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'x-csrf-protection': '1'
              },
              body: JSON.stringify(requestData)
            });

            const data = await response.json();
            
            console.log('📊 Response status:', response.status);
            console.log('📊 Response data:', data);
            
            return {
              success: response.ok,
              status: response.status,
              data: data,
              headers: Object.fromEntries(response.headers.entries())
            };
          } catch (error) {
            console.error('❌ Lỗi trong browser:', error);
            return {
              success: false,
              error: error.message
            };
          }
        }, prompt, options, this.channelId);

        if (result.success) {
          console.log('✅ API call thành công!');
          console.log('📊 Full Response Data:', JSON.stringify(result.data, null, 2));
          
          // Tìm Job ID từ các field có thể có
          const jobId = result.data?.id || 
                       result.data?.jobId || 
                       result.data?.job_id || 
                       result.data?.taskId ||
                       result.data?.task_id ||
                       result.data?.requestId ||
                       result.data?.request_id;
          
          // Tìm Status từ các field có thể có
          const status = result.data?.status || 
                        result.data?.state || 
                        result.data?.phase ||
                        result.data?.progress;
          
          console.log('📊 Job ID:', jobId || 'Không tìm thấy');
          console.log('📊 Status:', status || 'Không tìm thấy');
          
          return {
            success: true,
            data: result.data,
            message: 'Yêu cầu tạo ảnh đã được gửi thành công',
            retryCount: retryCount,
            jobId: jobId,
            status: status
          };
        } else {
          throw new Error(`API error: ${result.error || 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`❌ Lỗi generate ảnh (attempt ${retryCount + 1}):`, error.message);
        
        retryCount++;
        
        if (retryCount >= maxRetries) {
          return {
            success: false,
            error: `Đã thử ${maxRetries} lần nhưng không thành công: ${error.message}`,
            retryCount: retryCount
          };
        }
        
        console.log(`⏳ Đợi ${retryCount * 2} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
      }
    }
  }
}
if (require.main === module) {
  const client = new PuppeteerMidjourneyAPI();
  client.main();
}

module.exports = PuppeteerMidjourneyAPI; 