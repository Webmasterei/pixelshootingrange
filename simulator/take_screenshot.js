import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    await page.goto('http://localhost:8080');
    await page.waitForTimeout(2000);
    
    await page.mouse.move(960, 540);
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: '../screenshot.png', fullPage: false });
    
    await browser.close();
    console.log('Screenshot saved to ../screenshot.png');
})();
