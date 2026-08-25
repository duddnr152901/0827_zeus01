const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const target = path.resolve(process.argv[2]).split(path.sep).join('/');
  const fileUrl = 'file:///' + target;
  const outDir = path.dirname(process.argv[3]);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    var c = document.getElementById('kvEmbers');
    if (!c) return { found: false };
    var ctx = c.getContext('2d');
    var data = ctx.getImageData(0, 0, c.width, c.height).data;
    var nonTransparent = 0;
    for (var i = 3; i < data.length; i += 4 * 50) { if (data[i] > 5) nonTransparent++; }
    return {
      found: true,
      hasParticleSystem: typeof window.ParticleSystem !== 'undefined',
      width: c.width,
      height: c.height,
      nonTransparentSamples: nonTransparent
    };
  });

  await page.screenshot({ path: path.join(outDir, 'embers.png') });
  console.log(JSON.stringify({ info, errors }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
