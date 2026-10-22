// Screenshot harness for the Observe handoff: drives the built app into each presentation state at desktop and narrow widths.
// Run: node scripts/observe-shots.mjs  (expects `npm run build` first; screenshots land in docs/screenshots/observe-handoff/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../docs/screenshots/observe-handoff/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server timeout')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes('4173')) { clearTimeout(t); resolve(); } });
  server.stderr.on('data', (d) => process.stderr.write(d));
});

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function shot(page, name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
  console.log('captured', name);
}

async function withViewport(width, height, tag) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

  // Populated observation: default landing (session brief inspector).
  await shot(page, `${tag}-01-observe-brief`);

  // Select an event with withheld evidence: scenario C/D/F carry NA items and degraded sources.
  const table = page.locator('tr[data-seq]');
  if (await table.count() > 0) {
    await table.first().click();
    await page.waitForTimeout(200);
    await shot(page, `${tag}-02-observe-event`);
    await page.keyboard.press('Escape');
  }

  // Degraded source in the session brief: pick the session whose sources are degraded/unopenable.
  await page.getByRole('button', { name: /^run-/ }).first().click();
  await page.waitForTimeout(200);
  const option = page.locator('[role="option"]', { hasText: /degraded|truncated|incomplete/i }).first();
  if (await option.count() > 0) {
    await option.click();
    await page.waitForTimeout(400);
    await shot(page, `${tag}-03-observe-degraded`);
  }
  await page.keyboard.press('Escape');

  await ctx.close();
}

await withViewport(1440, 900, 'desktop');
await withViewport(420, 800, 'narrow');

await browser.close();
server.kill();
process.exit(0);
