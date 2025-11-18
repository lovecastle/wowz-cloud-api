const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const axios = require('axios');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',  // ← dùng đường dẫn trên Linux
        // userDataDir: 'C:\\Users\\ROG\\AppData\\Local\\Google\\Chrome\\User Data',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    page.on('console', (msg) => {
        console.log(msg.text());
    });

    await page.goto('https://ideogram.cryptovn.news/', {
        waitUntil: 'networkidle2'
    });

    const content = await page.evaluate(() => document.querySelector("pre")?.innerText);
    const tokenData = JSON.parse(content);
    const access_token = tokenData.access_token;
    const uploadPage = await browser.newPage();
    await uploadPage.goto('https://ideogram.ai/t/explore', { waitUntil: 'networkidle2' });

    async function getImageFromUrl(url) {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary').toString('base64');
    }

    const imageUrl = 'https://iili.io/3qV7Jr7.md.jpg'; 
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

        const data = await res.json();
        return data;
    }, access_token, base64Image);

    if (uploadResponse.success) {
        const sleep = (milliseconds) => {
            return new Promise(resolve => setTimeout(resolve, milliseconds));
        };

        await sleep(1500);  


        const submitResponse = await uploadPage.evaluate(async (access_token, uploadId) => {
            const response = await fetch('https://ideogram.ai/api/e/submit', {
                method: 'POST',
                headers: {
                    'accept': '*/*',
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    event_key: 'UPLOAD_REMIX_CLICK',
                    metadata: JSON.stringify({
                        path: '/t/explore',
                        triggeredUtcTime: Date.now(),
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
                        isMobileLayout: false,
                        userHandle: 'wowztools',
                        userId: 'MstsNwxQQPOMctpkgjL_zA',
                        isGuest: false,
                        sessionId: 'b48a8cf4-e173-4f95-b8c5-845a24ec6957_1744476580197',
                        location: 'Asia/Saigon',
                        generationInProgress: false,
                        uploadId: uploadId 
                    })
                })
            });

            const data = await response.json();
            return data;
        }, access_token, uploadResponse.id); 
        const describeResponse = await uploadPage.evaluate(async (access_token, uploadId) => {
            const res = await fetch('https://ideogram.ai/api/describe', {
                method: 'POST',
                headers: {
                    'accept': '*/*',
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                    'origin': 'https://ideogram.ai',
                    'referer': 'https://ideogram.ai/t/explore',
                    'user-agent': navigator.userAgent,
                    'x-ideo-org': 'PSuF5OwWQBWN76d-iNlvSw',
                    'x-request-id': crypto.randomUUID(),
                },
                body: JSON.stringify({
                    image_id: uploadId,
                    captioner_model_version: 'V_3_0'
                }),
            });

            const data = await res.json();
            return data;
        }, access_token, uploadResponse.id);
        const updateSettingsResponse = await uploadPage.evaluate(async (access_token) => {
            const res = await fetch('https://ideogram.ai/api/users/settings', {
                method: 'PATCH',
                headers: {
                    'accept': '*/*',
                    'content-type': 'application/json',
                    'authorization': `Bearer ${access_token}`,
                    'origin': 'https://ideogram.ai',
                    'referer': 'https://ideogram.ai/t/explore',
                    'user-agent': navigator.userAgent,
                    'x-ideo-org': 'PSuF5OwWQBWN76d-iNlvSw',
                    'x-request-id': crypto.randomUUID(),
                },
                body: JSON.stringify({
                    default_to_private_generation_if_available: true,
                    default_model_version: "V_3_0",
                    default_aspect_ratio: "1:1",
                    default_autoprompt_option: "ON",
                    default_resolution: {
                        width: 1024,
                        height: 1024,
                        aspectRatio: "1:1"
                    },
                    default_sampling_speed: -2,
                    default_generation_preview_expanded: true,
                    default_expected_number_of_final_responses: 4
                }),
            });

            const data = await res.json();
            return data;
        }, access_token);
        const generateVariationResponse = await uploadPage.evaluate(async (access_token, imageId, promptText) => {
            const res = await fetch('https://ideogram.ai/api/images/sample', {
                method: 'POST',
                headers: {
                    'accept': '*/*',
                    'authorization': `Bearer ${access_token}`,
                    'content-type': 'application/json',
                    'origin': 'https://ideogram.ai',
                    'referer': `https://ideogram.ai/i/${imageId}`,
                    'user-agent': navigator.userAgent,
                    'x-ideo-org': 'PSuF5OwWQBWN76d-iNlvSw',
                    'x-request-id': crypto.randomUUID(),
                },
                body: JSON.stringify({
                    prompt: promptText,
                    user_id: 'MstsNwxQQPOMctpkgjL_zA',
                    private: true,
                    model_version: 'V_3_0',
                    use_autoprompt_option: 'ON',
                    sampling_speed: -2,
                    parent: {
                        image_id: imageId,
                        weight: 70,
                        type: 'VARIATION'
                    },
                    style_reference_parents: [],
                    style_expert: 'AUTO',
                    resolution: {
                        width: 1024,
                        height: 1024
                    },
                    use_random_style_codes: false,
                    num_images: 4
                })
            });

            const data = await res.json();
            return data;
        }, access_token, uploadResponse.id, describeResponse.data?.[0]?.caption);


        console.log('🔐 Access token:', access_token.slice(0, 10) + '...' + access_token.slice(-10));

        console.log(`📤 Uploaded: id=${uploadResponse.id}`);

        console.log('🧠 Caption:', describeResponse.data?.[0]?.caption || 'Không có mô tả');

        console.log('⚙️ Updated settings:', updateSettingsResponse);
        
        console.log('🧬 Generated variation:', generateVariationResponse);

        console.log('🎯 All steps completed!');
    } else {
        console.log('❌ Upload không thành công!');
    }

    await browser.close();
})();
