import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const SHOTS = '/tmp/cc-agent/72233920/pw-shots';
mkdirSync(SHOTS, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: '/tmp/cc-agent/72233920/project', stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server timeout')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes('4173')) { clearTimeout(t); resolve(); } });
  server.stderr.on('data', (d) => process.stderr.write(d));
});

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];

async function withPage(dpr, name) {
  const ctx = await browser.newContext({ deviceScaleFactor: dpr, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Evolve' }).click();
  await page.waitForSelector('[data-testid="lineage-explorer"]', { timeout: 10000 });
  await page.waitForTimeout(500);

  const backend = await page.evaluate(() => {
    const sel = document.querySelector('select[aria-label="Renderer backend"]');
    return sel ? sel.value : 'none';
  });
  results.push(`${name} default backend: ${backend}`);

  await page.selectOption('select[aria-label="Renderer backend"]', 'webgl2-instanced');
  await page.waitForTimeout(700);

  const webglState = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="lineage-explorer"] canvas');
    if (!canvas) return { canvas: false };
    const gl = canvas.getContext('webgl2');
    if (!gl) return { canvas: true, gl: false };
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return {
      bufferW: canvas.width, bufferH: canvas.height,
      cssW: canvas.clientWidth, cssH: canvas.clientHeight,
      lost: gl.isContextLost(),
      centerPixel: [...px],
      nonEmpty: !(px[0] === 0 && px[1] === 0 && px[2] === 0 && px[3] === 0),
    };
  });
  results.push(`${name} webgl: ${JSON.stringify(webglState)}`);

  await page.screenshot({ path: `${SHOTS}/${name}-webgl.png` });

  // Scene switching under WebGL
  const stressVal = await page.evaluate(() => {
    const sel = document.querySelector('select[aria-label="Scene"]');
    const opt = [...sel.options].find((o) => o.textContent.includes('100 nodes'));
    return opt ? opt.value : null;
  });
  if (stressVal) {
    await page.selectOption('select[aria-label="Scene"]', stressVal);
    await page.waitForTimeout(700);
  }
  const afterSwitch = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="lineage-explorer"] canvas');
    const gl = canvas?.getContext('webgl2');
    if (!canvas || !gl) return { canvas: false };
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { lost: gl.isContextLost(), centerPixel: [...px] };
  });
  results.push(`${name} after scene switch: ${JSON.stringify(afterSwitch)}`);
  await page.screenshot({ path: `${SHOTS}/${name}-scene100.png` });

  const lineageVal = await page.evaluate(() => {
    const sel = document.querySelector('select[aria-label="Scene"]');
    const opt = [...sel.options].find((o) => !o.textContent.includes('nodes'));
    return opt ? opt.value : null;
  });
  if (lineageVal) { await page.selectOption('select[aria-label="Scene"]', lineageVal); await page.waitForTimeout(500); }

  await page.selectOption('select[aria-label="Renderer backend"]', 'svg-dom');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${name}-svg.png` });
  results.push(`${name} errors: ${errors.length ? errors.join(' | ').slice(0, 300) : 'none'}`);
  await ctx.close();
}

await withPage(1, 'dpr1');
await withPage(2, 'dpr2');

console.log(results.join('\n'));
await browser.close();
server.kill();
process.exit(0);
