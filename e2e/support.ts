import { test as base, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PNG } from 'pngjs';

/**
 * Every test fails if the page raises a console error, a page error or a failed request, or if anything leaves the origin: the
 * concept must make no network call but its own (no CDN, no telemetry). The problems are attached to the report.
 */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page, baseURL }, use, testInfo) => {
      const problems: string[] = [];
      const origin = new URL(baseURL!).origin;
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
      page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
      page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
      page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) problems.push(`external request: ${r.url()}`); });
      await use(problems);
      if (problems.length > 0) await testInfo.attach('browser-problems', { body: problems.join('\n'), contentType: 'text/plain' });
      expect(problems, 'no console errors, page errors, failed requests or external requests').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const hasWebGL2 = (page: Page) =>
  page.evaluate(() => {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
  });

/** Skips a WebGL test with an explicit reason, or fails it when WebGL2 is required (CI): never silently passes. */
export async function requireWebGL2(page: Page, t: { skip: (cond: boolean, reason: string) => void }) {
  const ok = await hasWebGL2(page);
  if (process.env.E2E_REQUIRE_WEBGL === '1') expect(ok, 'WebGL2 must initialise in this environment (E2E_REQUIRE_WEBGL=1)').toBe(true);
  t.skip(!ok, 'WebGL2 could not initialise here: the WebGL path was NOT tested in this run');
}

export async function goEvolve(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Evolve', exact: true }).click();
  await expect(page.getByTestId('lineage-explorer')).toBeVisible();
}

export const viewport = (page: Page) => page.getByRole('application', { name: /Lineage graph viewport/ });
export const backend = (page: Page) => page.getByLabel('Renderer backend');
export async function useBackend(page: Page, id: 'svg-dom' | 'webgl2-instanced') {
  await backend(page).selectOption(id);
  await expect(backend(page)).toHaveValue(id);
}

/** Centre of a locator's box, in page coordinates. */
export async function centre(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('element has no box');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** The SVG backend's camera: the content group's transform, parsed. */
export async function svgCamera(page: Page) {
  const t = await page.locator('[role="application"] svg > g').first().getAttribute('transform');
  const m = /translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/.exec(t ?? '');
  if (!m) throw new Error(`no camera transform: ${t}`);
  return { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]) };
}

/**
 * What the WebGL canvas actually shows, read from a COMPOSITED screenshot of the element. (Reading the drawing buffer after the
 * frame was presented returns zeros without preserveDrawingBuffer; that says nothing about whether anything was drawn.)
 */
export async function canvasPixels(page: Page, crop?: { x0: number; x1: number; y0: number; y1: number }) {
  const full = PNG.sync.read(await page.locator('[role="application"] canvas').screenshot());
  // Optionally look only at a fraction of the canvas (the graph), so the floating toolbar and key cannot pollute a comparison.
  const cx0 = Math.floor((crop?.x0 ?? 0) * full.width), cx1 = Math.floor((crop?.x1 ?? 1) * full.width);
  const cy0 = Math.floor((crop?.y0 ?? 0) * full.height), cy1 = Math.floor((crop?.y1 ?? 1) * full.height);
  const width = cx1 - cx0, height = cy1 - cy0;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const si = ((cy0 + y) * full.width + (cx0 + x)) * 4; const di = (y * width + x) * 4; data[di] = full.data[si]; data[di + 1] = full.data[si + 1]; data[di + 2] = full.data[si + 2]; data[di + 3] = full.data[si + 3]; }
  // Background = the most common colour; "ink" = pixels that differ from it noticeably.
  const counts = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) { const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const bg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const [br, bgG, bb] = [(bg >> 16) & 255, (bg >> 8) & 255, bg & 255];
  let ink = 0;
  let energy = 0;
  const palette = new Set<number>();
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bb);
    if (d > 30) { ink++; energy += d; palette.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)); }
  }
  return { width, height, ink, inkShare: ink / (width * height), energy, colours: palette.size };
}

/** The part of the canvas that holds the graph and nothing else (no toolbar, key or selection card) when nothing is selected. */
export const GRAPH_CROP = { x0: 0.24, x1: 0.75, y0: 0.14, y1: 1 };
