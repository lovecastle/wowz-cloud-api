
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');


const COOKIES_FILE = path.join(__dirname, 'chatgpt-cookies.json');


async function loadSavedCookies(page) {
  if (fs.existsSync(COOKIES_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE));
    await page.setCookie(...cookies);
    console.log('✅ Loaded saved cookies');
    return true;
  }
  return false;
}


async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log('✅ Cookies saved');
}


function setupManualCookies() {
  console.log('\n🔧 MANUAL COOKIE SETUP REQUIRED:');
  console.log('1. Mở trình duyệt trên máy khác (Windows/Mac/phone)');
  console.log('2. Đăng nhập https://chatgpt.com');
  console.log('3. Mở Developer Tools (F12)');
  console.log('4. Vào tab Application/Storage → Cookies → https://chatgpt.com');
  console.log('5. Copy tất cả cookies và tạo file chatgpt-cookies.json như sau:');
  
  const exampleCookies = [
    {
      "name": "__Secure-next-auth.session-token",
      "value": "YOUR_SESSION_TOKEN_HERE",
      "domain": ".chatgpt.com",
      "path": "/",
      "expires": -1,
      "httpOnly": true,
      "secure": true
    },
    {
      "name": "cf_clearance",
      "value": "YOUR_CF_CLEARANCE_HERE", 
      "domain": ".chatgpt.com",
      "path": "/",
      "expires": -1,
      "httpOnly": false,
      "secure": true
    }
  ];
  
  console.log('\nExample chatgpt-cookies.json:');
  console.log(JSON.stringify(exampleCookies, null, 2));
  console.log('\n6. Lưu file và chạy lại script');
}


async function initializeBrowserWithCookies() {
  const browser = await puppeteer.launch({
    headless: 'new', 
    executablePath: '/usr/bin/chromium-browser',
    userDataDir: 'gpt-profile',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();
  
  
  const hasValidCookies = await loadSavedCookies(page);
  
  if (!hasValidCookies) {
    setupManualCookies();
    await browser.close();
    process.exit(1);
  }

  
  await page.goto('https://chatgpt.com');
  
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  
  const needLogin = await page.$('button[data-testid="login-button"]') !== null;
  
  if (needLogin) {
    console.log('❌ Cookies không hợp lệ hoặc đã hết hạn');
    setupManualCookies();
    await browser.close();
    process.exit(1);
  }

  console.log('✅ ChatGPT login successful with cookies!');
  
  
  await saveCookies(page);
  await page.close();
  
  return browser;
}


(async () => {
  try {
    sharedBrowser = await initializeBrowserWithCookies();
    console.log('✅ Browser ready!');
  } catch (err) {
    console.error('❌ Failed to initialize browser:', err);
    process.exit(1);
  }
})();