import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EMAIL = process.env.GOOGLE_EMAIL || 'b10@khokho15.dpdns.org';
const PASSWORD = process.env.GOOGLE_PASSWORD || 'Az123456@';
const PROMPT = process.env.VEO_PROMPT || 'Create video cat playing with dog';
const DOWNLOAD_ROOT = process.env.VEO_DOWNLOAD_DIR || path.resolve(process.cwd(), 'downloads');
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
const GEMINI_URL = 'https://gemini.google.com/u/1/app?hl=vi&pageId=none';

async function ensureDownloadDir() {
  await fs.mkdir(DOWNLOAD_ROOT, { recursive: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

async function setDownloadBehavior(page) {
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_ROOT,
  });
}

async function login(page) {
  console.log('Navigating to Google login...');
  await page.goto(
    'https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fgemini.google.com%2Fapp%3Fhl%3Dvi%26pageId%3Dnone&dsh=S-1859710577%3A1763113314026234&ec=GAZAkgU&flowEntry=ServiceLogin&flowName=GlifWebSignIn&followup=https%3A%2F%2Fgemini.google.com%2Fapp%3Fhl%3Dvi%26pageId%3Dnone&hl=vi&ifkv=ARESoU2UShxioi5RIaFtjVgt2kgfxX9wWEK_ckTt86Z97fapimMnoGHQmlz0ChSejdbf7UrpOpPe',
    { waitUntil: 'networkidle2', timeout: 60000 },
  );

  await page.setViewport({ width: 1200, height: 900 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  console.log('Entering email...');
  await page.type('input[type="email"]', EMAIL, { delay: 25 });
  await page.keyboard.press('Enter');

  await page.waitForSelector('input[type="password"]', { visible: true, timeout: 60000 });
  console.log('Entering password...');
  await page.type('input[type="password"]', PASSWORD, { delay: 25 });
  await page.keyboard.press('Enter');

  console.log('Waiting for login to complete...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
  console.log('Login successful!');
}

async function openGemini(page) {
  console.log('Navigating to Gemini / Veo...');
  await page.goto(GEMINI_URL, { waitUntil: 'networkidle2', timeout: 60000 });
}

async function acceptChromiumPrompt(page) {
  console.log('Checking for Chromium profile prompt...');
  try {
    // Wait a bit for the modal to appear
    await delay(2000);
    
    // Try to find the "Continue as b10" button using CSS selectors
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent?.toLowerCase(), button);
      if (text && (text.includes('tiếp tục là b10') || text.includes('continue as b10'))) {
        await button.click();
        await delay(1000);
        console.log('Chromium profile prompt accepted.');
        return;
      }
    }
    console.log('Chromium prompt not found, continue normally.');
  } catch (err) {
    console.warn('Error while handling Chromium prompt:', err);
  }
}

async function selectVeoTool(page) {
  console.log('Opening tools drawer...');
  await delay(1500); // allow UI to settle
  
  // Find and click the "Công cụ" (Tools) button
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
    throw new Error('Không tìm thấy nút "Công cụ"');
  }
  await toolsButton.click();

  console.log('Selecting "Tạo video bằng Veo"...');
  await delay(500);
  
  // Find and click the "Tạo video bằng Veo" option
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
    throw new Error('Không tìm thấy tùy chọn "Tạo video bằng Veo"');
  }
  await veoOption.click();
  await page.waitForSelector('[role="textbox"], textarea, input[type="text"]', { timeout: 60000 });
}

async function submitPrompt(page, prompt) {
  console.log('Submitting prompt...');
  
  // Wait for prompt input and take screenshot
  await delay(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step1-veo-ready.png') });
  
  const inputHandle = await page.waitForSelector('[role="textbox"], textarea, input[type="text"]', {
    visible: true,
    timeout: 60000,
  });
  
  // Clear and type prompt
  await inputHandle.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await delay(500);
  await inputHandle.type(prompt, { delay: 80 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step2-prompt-typed.png') });

  // Press Enter to submit
  console.log('Pressing Enter to submit prompt...');
  await page.keyboard.press('Enter');
  await delay(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step3-prompt-submitted.png') });
  console.log('Prompt submitted, waiting for result...');
}

async function waitForVideoAndDownload(page) {
  console.log('Waiting for Veo 3.1 generation to finish...');
  console.log('This may take 2-5 minutes. Checking status every 10 seconds...');
  
  let attempts = 0;
  const maxAttempts = 60; // 10 minutes total
  
  while (attempts < maxAttempts) {
    attempts++;
    await delay(10000); // Wait 10 seconds between checks
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `step4-waiting-${attempts}.png`) });
    console.log(`Check ${attempts}/${maxAttempts} - Looking for video...`);
    
    // Check if video exists
    const video = await page.$('video');
    if (video) {
      console.log('Video found!');
      await delay(3000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step5-video-ready.png') });
      break;
    }
    
    // Check for error messages
    const errorTexts = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .map(el => el.textContent)
        .filter(text => text && (text.includes('error') || text.includes('failed') || text.includes('lỗi')))
        .slice(0, 3);
    });
    
    if (errorTexts.length > 0) {
      console.log('Possible error detected:', errorTexts);
    }
  }
  
  if (attempts >= maxAttempts) {
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step-timeout.png') });
    throw new Error('Timeout: Video did not appear after 10 minutes');
  }

  // Find download button by scanning all buttons and links
  console.log('Looking for download button...');
  await delay(2000);
  
  // Try different selectors for the download button
  let downloadButton = await page.$('button[aria-label*="Tải video xuống"]');
  
  if (!downloadButton) {
    downloadButton = await page.$('button.download-button');
  }
  
  if (!downloadButton) {
    // Fallback: scan all buttons
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
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step6-no-download-button.png') });
    console.log('Download button not found. Keeping browser open for manual download...');
    console.log('Press Ctrl+C when done.');
    await delay(300000); // Wait 5 minutes for manual action
    return DOWNLOAD_ROOT;
  }

  console.log('Downloading video...');
  await downloadButton.click();
  await delay(5000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step7-download-clicked.png') });
  
  console.log(`Video download initiated. Check ${DOWNLOAD_ROOT} folder.`);
  console.log('Keeping browser open for 30 seconds to complete download...');
  await delay(30000);
  
  return DOWNLOAD_ROOT;
}

async function main() {
  await ensureDownloadDir();

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: false,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await setDownloadBehavior(page);

  try {
    await login(page);
    await openGemini(page);
    await acceptChromiumPrompt(page);
    await selectVeoTool(page);
    await submitPrompt(page, PROMPT);
    const downloadedPath = await waitForVideoAndDownload(page);

    console.log(`Workflow completed. File should be in: ${downloadedPath}`);
  } catch (err) {
    console.error('Error during automation:', err);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') }).catch(() => {});
    console.log('\nKeeping browser open for 60 seconds for debugging...');
    await delay(60000);
    throw err;
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});