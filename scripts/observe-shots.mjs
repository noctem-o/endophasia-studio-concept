// Screenshot harness for the Observe handoff: drives the BUILT app into each presentation state at desktop and narrow widths.
//
//   npm run build            (the harness serves dist/, never the dev server)
//   node scripts/observe-shots.mjs
//
// Screenshots land in docs/screenshots/observe-handoff/ as:
//   {desktop|narrow}-01-observe-brief.png    populated session brief (inspector shows the session, nothing selected)
//   {desktop|narrow}-02-observe-event.png    an event selected; the evidence inspector is open and asserted visible
//   {desktop|narrow}-03-observe-degraded.png session run-8d41aa (scenario D) with the "source degraded" callout visible
//
// Browser resolution: E2E_CHROMIUM_PATH (same variable the Playwright config honours), else Playwright's own browser, else a
// system Chromium found on the PATH-standard locations. Nothing is downloaded at run time.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}docs/screenshots/observe-handoff/`;
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}/`;
mkdirSync(OUT, { recursive: true });

// ── browser resolution ────────────────────────────────────────────────────────
function resolveChromium() {
  if (process.env.E2E_CHROMIUM_PATH) {
    if (!existsSync(process.env.E2E_CHROMIUM_PATH)) throw new Error(`E2E_CHROMIUM_PATH is set but does not exist: ${process.env.E2E_CHROMIUM_PATH}`);
    return { executablePath: process.env.E2E_CHROMIUM_PATH, source: 'E2E_CHROMIUM_PATH' };
  }
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return { executablePath: undefined, source: `playwright bundle (${p})` };
  } catch { /* no bundle registered */ }
  const candidates = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/snap/bin/chromium'];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(
      'No Chromium found. Install one of: `npx playwright install chromium` (offline machines: see E2E_CHROMIUM_PATH in playwright.config.ts), or a system chromium.',
    );
  }
  return { executablePath: found, source: `system (${found})` };
}

// ── preview server with real HTTP readiness (never parsed stdout) ─────────────
async function startServer() {
  const bin = `${ROOT}node_modules/.bin/vite`;
  if (!existsSync(bin)) throw new Error('node_modules/.bin/vite missing — run `npm install` and `npm run build` first.');
  const server = spawn(bin, ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  const deadline = Date.now() + 30_000;
  const errors = [];
  server.stderr.on('data', (d) => errors.push(String(d)));
  server.on('exit', (code) => { if (code !== null && code !== 0) errors.push(`vite preview exited with code ${code}`); });
  while (Date.now() < deadline) {
    if (errors.length > 0) { server.kill(); throw new Error(`preview server failed to start:\n${errors.join('\n')}`); }
    try {
      const res = await fetch(BASE);
      if (res.ok) return server;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  server.kill();
  throw new Error(`preview server did not answer HTTP within 30s at ${BASE}`);
}

// Deterministic frames: no CSS transitions/animations, and the app's own reduced-motion paths honoured.
const FREEZE_ANIMATIONS = `*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }`;

async function newPage(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

function fail(step, detail) {
  throw new Error(`screenshot harness could not reach a required state — ${step}: ${detail}`);
}

async function withViewport(browser, width, height, tag) {
  const { ctx, page } = await newPage(browser, width, height);
  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: FREEZE_ANIMATIONS });

    // The app is really rendered when the session switcher is there.
    const switcher = page.getByRole('button', { name: /^Recorded session: / });
    await switcher.waitFor({ state: 'visible', timeout: 15_000 });
    await settle(page);

    // ── 01: populated observation, session brief in the inspector ──────────
    await page.screenshot({ path: `${OUT}${tag}-01-observe-brief.png` });
    console.log('captured', `${tag}-01-observe-brief`);

    // ── 02: select an event and assert the evidence inspector opened ───────
    const row = page.locator('tr[data-seq]').first();
    if ((await row.count()) === 0) fail('event selection', 'no rows with tr[data-seq] rendered — the event table did not mount');
    await row.click();
    const inspector = page.locator('aside[aria-label="Event inspector"]');
    // The inspector shows the event (an "Event" eyebrow with a position counter), not the session brief.
    await inspector.getByText(/^Event$/).waitFor({ state: 'visible', timeout: 5_000 });
    if ((await inspector.locator('h2').count()) === 0) fail('evidence inspector', 'inspector opened without an event title');
    await settle(page);
    await page.screenshot({ path: `${OUT}${tag}-02-observe-event.png` });
    console.log('captured', `${tag}-02-observe-event`);

    // Close the selection: below the lg breakpoint the inspector is a MODAL drawer that would block the session switcher.
    await page.keyboard.press('Escape');
    await page.locator('[data-modal-backdrop]').waitFor({ state: 'detached', timeout: 5_000 });

    // ── 03: degraded-source session (run-8d41aa, scenario D) ───────────────
    const DEGRADED = 'run-8d41aa';
    await switcher.click();
    const option = page.locator('[role="option"]', { hasText: DEGRADED }).first();
    if ((await option.count()) === 0) {
      fail('session switch', `option "${DEGRADED}" not found in the session switcher — the degraded fixture is missing`);
    }
    await option.click();
    // The degraded-source callout lives in the session brief, which the inspector only shows from the lg breakpoint up (below it
    // the brief is never rendered — the inspector is a modal over an event). Assert it where it can actually appear.
    if (width >= 1024) {
      const callout = page.getByText('source degraded — Usage ledger', { exact: false });
      await callout.waitFor({ state: 'visible', timeout: 5_000 });
    }
    // Guard against a silent fallback (both widths): the switcher must now name the degraded session.
    const current = await switcher.getAttribute('aria-label');
    if (!current?.includes(DEGRADED)) fail('session switch', `switcher still on "${current}" after selecting ${DEGRADED}`);
    await settle(page);
    await page.screenshot({ path: `${OUT}${tag}-03-observe-degraded.png` });
    console.log('captured', `${tag}-03-observe-degraded`);
  } finally {
    await ctx.close();
  }
}

let server;
let browser;
try {
  server = await startServer();
  const { executablePath, source } = resolveChromium();
  console.log(`browser: ${source}`);
  browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  await withViewport(browser, 1440, 900, 'desktop');
  await withViewport(browser, 420, 800, 'narrow');
  console.log('done:', OUT);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill();
}
