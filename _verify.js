const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const fileUrl = 'file://' + path.resolve('index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const stormDiv = document.getElementById('kvStorm');
    const cv = stormDiv && stormDiv.querySelector('canvas');
    const r = stormDiv.getBoundingClientRect();
    const cs = getComputedStyle(stormDiv);
    return {
      hasCanvas: !!cv,
      canvasSize: cv ? [cv.width, cv.height] : null,
      rect: { w: r.width, h: r.height, top: r.top, left: r.left },
      position: cs.position, zIndex: cs.zIndex
    };
  });
  console.log('info', JSON.stringify(info));

  const outDir = 'C:/Users/richelle/AppData/Local/Temp/claude/z--DesignWorks------2026--------0827----/ca7b8507-e07f-4069-99c2-5e4239cf468b/scratchpad';
  // take two shots 400ms apart to diff for motion (rain/lightning)
  await page.screenshot({ path: `${outDir}/verify1.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/verify2.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

  console.log('errors:', errs.join(' | ') || '(none)');
  await browser.close();
})();
