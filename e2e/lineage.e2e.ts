import type { Page } from '@playwright/test';
import { test, expect, goEvolve, useBackend, viewport, centre, svgCamera, canvasPixels, requireWebGL2, GRAPH_CROP } from './support';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Evolve record inspector' });
const status = (page: Page) => page.locator('footer');
const nodeGroups = (page: Page) => page.locator('[role="application"] svg [data-node-id]');
const edgePaths = (page: Page) => page.locator('[role="application"] svg path[marker-end]');
const dimmedGroups = (page: Page) => page.locator('[role="application"] svg [data-node-id][opacity="0.25"]');
const openKey = async (page: Page) => { const k = page.getByRole('button', { name: 'Key', exact: true }); if ((await k.getAttribute('aria-expanded')) !== 'true') await k.click(); };

// ── The SVG backend: this suite must pass whether or not WebGL2 exists ─────────────────────────────────────────────────────────
test.describe('SVG backend (independent of WebGL2)', () => {
  test.beforeEach(async ({ page }) => { await goEvolve(page); await useBackend(page, 'svg-dom'); });

  test('attaches an <svg> to the viewport and draws one group per node and one path per edge, all inside it', async ({ page }) => {
    await expect(nodeGroups(page)).toHaveCount(13);
    await expect(edgePaths(page)).toHaveCount(9);
    const host = await viewport(page).boundingBox();
    const svg = await page.locator('[role="application"] > svg').boundingBox();
    expect(svg!.width).toBeGreaterThan(300);
    expect(Math.abs(svg!.width - host!.width)).toBeLessThan(2);
    for (const g of await nodeGroups(page).all()) {
      const b = (await g.boundingBox())!;
      expect(b.width).toBeGreaterThan(100);
      expect(b.x).toBeGreaterThanOrEqual(host!.x - 1);
      expect(b.x + b.width).toBeLessThanOrEqual(host!.x + host!.width + 1);
      expect(b.y).toBeGreaterThanOrEqual(host!.y - 1);
      expect(b.y + b.height).toBeLessThanOrEqual(host!.y + host!.height + 1);
    }
  });

  test('hit-testing agrees with what is drawn: clicking the centre of each node selects exactly that node', async ({ page }) => {
    const ids = await nodeGroups(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-node-id')!));
    expect(ids).toHaveLength(13);
    for (const id of ids) {
      const p = await centre(page.locator(`[role="application"] svg [data-node-id="${id}"]`));
      await page.mouse.click(p.x, p.y);
      await expect(status(page), id).toContainText(`lineage · ${id}`);
      await expect(inspector(page).getByText(id, { exact: true }).first()).toBeVisible();
    }
  });

  test('a click on empty canvas clears the selection', async ({ page }) => {
    const g = page.locator('[role="application"] svg [data-node-id]').first();
    const p = await centre(g);
    await page.mouse.click(p.x, p.y);
    await expect(status(page)).toContainText('lineage · ');
    const host = (await viewport(page).boundingBox())!;
    await page.mouse.click(host.x + host.width * 0.12, host.y + host.height * 0.5);
    await expect(status(page)).toContainText('nothing selected');
  });

  test('pan, zoom and fit act on the camera; a drag that ends over a node does not select it', async ({ page }) => {
    const initial = await svgCamera(page);
    const host = (await viewport(page).boundingBox())!;
    const sx = host.x + host.width * 0.12, sy = host.y + host.height * 0.5;
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 60, sy + 40, { steps: 5 }); await page.mouse.up();
    const panned = await svgCamera(page);
    expect(panned.x - initial.x).toBeCloseTo(60, 0);
    expect(panned.y - initial.y).toBeCloseTo(40, 0);
    expect(panned.scale).toBeCloseTo(initial.scale, 5);
    // A drag that STARTS on empty canvas and ENDS over a node is a pan, not a selection.
    const n = await centre(nodeGroups(page).nth(3));
    await page.mouse.move(sx, sy + 120); await page.mouse.down(); await page.mouse.move(n.x, n.y, { steps: 6 }); await page.mouse.up();
    await expect(status(page)).toContainText('nothing selected');
    // Wheel zoom about the cursor.
    const before = await svgCamera(page);
    await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
    await page.mouse.wheel(0, -400);
    await expect.poll(async () => (await svgCamera(page)).scale).toBeGreaterThan(before.scale);
    // Fit restores a view that contains the whole scene.
    await page.getByRole('button', { name: 'fit' }).click();
    const fitted = await svgCamera(page);
    expect(fitted.scale).toBeCloseTo(initial.scale, 3);
    expect(fitted.x).toBeCloseTo(initial.x, 0);
    expect(fitted.y).toBeCloseTo(initial.y, 0);
  });

  test('keyboard: arrows move the selection, f focuses its lineage, Escape unwinds focus then selection', async ({ page }) => {
    await viewport(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(status(page)).toContainText('lineage · ');
    const first = await status(page).innerText();
    await page.keyboard.press('ArrowDown');
    expect(await status(page).innerText()).not.toEqual(first);
    await page.keyboard.press('f');
    await expect.poll(() => dimmedGroups(page).count()).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(dimmedGroups(page)).toHaveCount(0);
    await expect(status(page)).toContainText('lineage · ');
    await page.keyboard.press('Escape');
    await expect(status(page)).toContainText('nothing selected');
  });

  test('the text filter dims everything except the matches and their direct neighbours (exactly), and clears when emptied', async ({ page }) => {
    // "replay" matches exec-replay1 only; its one neighbour is the baseline exec-a. 13 nodes - 2 = 11 dimmed, none removed.
    await page.getByLabel('Filter nodes').fill('replay');
    await expect(dimmedGroups(page)).toHaveCount(11);
    await expect(nodeGroups(page)).toHaveCount(13);
    const kept = await page.locator('[role="application"] svg [data-node-id]:not([opacity="0.25"])').evaluateAll((els) => els.map((e) => e.getAttribute('data-node-id')).sort());
    expect(kept).toEqual(['exec-a', 'exec-replay1']);
    await expect(page.getByText(/2\/13 nodes/)).toBeVisible();
    await page.getByLabel('Filter nodes').fill('');
    await expect(dimmedGroups(page)).toHaveCount(0);
  });

  test('hiding a relation removes exactly its edges; showing it restores them; the nodes are untouched', async ({ page }) => {
    await openKey(page);
    await page.getByRole('button', { name: /^replay of/ }).click();
    await expect(edgePaths(page)).toHaveCount(8);
    await expect(nodeGroups(page)).toHaveCount(13);
    await page.getByRole('button', { name: /^replay of/ }).click();
    await expect(edgePaths(page)).toHaveCount(9);
  });

  test('switching to a stress scene and back redraws, labels the fixture synthetic, and survives', async ({ page }) => {
    const scene = page.getByLabel('Scene', { exact: true });
    const stress = await scene.locator('option', { hasText: '100 nodes' }).getAttribute('value');
    await scene.selectOption(stress!);
    await expect(nodeGroups(page)).toHaveCount(100);
    await expect(page.getByText(/SYNTHETIC FIXTURE · 100 NODES/)).toBeVisible();
    await expect(page.getByText(/100\/100 nodes/)).toBeVisible();
    const recorded = await scene.locator('option', { hasText: 'recorded lineage' }).getAttribute('value');
    await scene.selectOption(recorded!);
    await expect(nodeGroups(page)).toHaveCount(13);
    await expect(page.getByText(/SYNTHETIC FIXTURE/)).toBeHidden();
  });

  test('selecting a node shows its record beside the graph without replacing the graph', async ({ page }) => {
    const p = await centre(page.locator('[role="application"] svg [data-node-id="exec-a"]'));
    await page.mouse.click(p.x, p.y);
    await expect(inspector(page).getByRole('heading', { name: 'Baseline reference — proration fix' })).toBeVisible();
    await expect(page.getByTestId('lineage-explorer')).toBeVisible();
    await expect(nodeGroups(page)).toHaveCount(13);
  });
});

test.describe('SVG backend: state across scene switches, and what selection does not erase', () => {
  test.beforeEach(async ({ page }) => { await goEvolve(page); await useBackend(page, 'svg-dom'); });

  test('a scene switch does not leave the old scene\'s selection or focus behind', async ({ page }) => {
    const p = await centre(page.locator('[role="application"] svg [data-node-id="exec-a"]'));
    await page.mouse.click(p.x, p.y);
    await expect(status(page)).toContainText('lineage · exec-a');
    await viewport(page).focus();
    await page.keyboard.press('f');
    await expect.poll(() => dimmedGroups(page).count()).toBeGreaterThan(0);
    const scene = page.getByLabel('Scene', { exact: true });
    const stress = await scene.locator('option', { hasText: '100 nodes' }).getAttribute('value');
    await scene.selectOption(stress!);
    await expect(nodeGroups(page)).toHaveCount(100);
    await expect(status(page)).toContainText('nothing selected');
    await expect(inspector(page).getByText('exec-a', { exact: true })).toHaveCount(0);
    await expect(dimmedGroups(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'focus lineage' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a selected simulated projection stays hollow and dashed; a selected trial does not', async ({ page }) => {
    const sim = page.locator('[role="application"] svg [data-node-id="exec-sim1"]');
    let p = await centre(sim);
    await page.mouse.click(p.x, p.y);
    await expect(status(page)).toContainText('lineage · exec-sim1');
    const bg = sim.locator('rect').first();
    await expect(bg).toHaveAttribute('stroke-dasharray', /\d/);
    expect(Number(await bg.getAttribute('fill-opacity'))).toBeLessThan(0.2);
    const trial = page.locator('[role="application"] svg [data-node-id="exec-r1"]');
    p = await centre(trial);
    await page.mouse.click(p.x, p.y);
    const tbg = trial.locator('rect').first();
    expect(await tbg.getAttribute('stroke-dasharray')).toBeNull();
    expect(Number(await tbg.getAttribute('fill-opacity'))).toBe(1);
  });
});

// ── The WebGL2 path: tested only where WebGL2 really initialises, and says so when it cannot ──────────────────────────────────────
test.describe('WebGL2 backend (software-rendered here: correctness, never hardware performance)', () => {
  test.beforeEach(async ({ page }, info) => {
    await goEvolve(page);
    await requireWebGL2(page, test);
    const renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2')!; const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'renderer not disclosed'; });
    info.annotations.push({ type: 'webgl2 renderer', description: renderer });
    console.log(`[${info.project.name}] WebGL2 renderer: ${renderer}`);
  });

  test('is the default backend, owns a canvas sized to the viewport at this DPR, and holds a live context', async ({ page }, info) => {
    await expect(page.getByLabel('Renderer backend')).toHaveValue('webgl2-instanced');
    const canvas = page.locator('[role="application"] canvas');
    await expect(canvas).toHaveCount(1);
    const dims = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, dpr: window.devicePixelRatio, lost: (c.getContext('webgl2') as WebGL2RenderingContext).isContextLost() }));
    expect(dims.dpr).toBe(info.project.name === 'dpr2' ? 2 : 1);
    expect(Math.abs(dims.w - dims.cw * dims.dpr)).toBeLessThanOrEqual(2);
    expect(Math.abs(dims.h - dims.ch * dims.dpr)).toBeLessThanOrEqual(2);
    expect(dims.lost).toBe(false);
  });

  test('actually draws the graph: a composited screenshot of the canvas carries a plausible amount of distinct ink', async ({ page }) => {
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).inkShare, { timeout: 15_000 }).toBeGreaterThan(0.02);
    const px = await canvasPixels(page, GRAPH_CROP);
    expect(px.inkShare).toBeLessThan(0.7); // not a flood fill
    expect(px.colours).toBeGreaterThanOrEqual(8);
  });

  test('the DOM text cards sit on the nodes: clicking each card selects exactly that node (hit-testing agrees with the drawing)', async ({ page }) => {
    const cards = page.locator('[data-overlay-node]');
    await expect(cards).toHaveCount(13);
    const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-overlay-node')!));
    for (const id of ids) {
      const p = await centre(page.locator(`[data-overlay-node="${id}"]`));
      await page.mouse.click(p.x, p.y);
      await expect(status(page), id).toContainText(`lineage · ${id}`);
    }
  });

  test('the filter changes the picture, and clearing it restores exactly the same picture', async ({ page }) => {
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).inkShare).toBeGreaterThan(0.02);
    const before = await canvasPixels(page, GRAPH_CROP);
    await page.getByLabel('Filter nodes').fill('replay');
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).energy).toBeLessThan(before.energy);
    await page.getByLabel('Filter nodes').fill('');
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).energy).toBe(before.energy);
  });

  test('hiding a relation changes the picture (its edges are gone) and showing it restores it', async ({ page }) => {
    await openKey(page);
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).inkShare).toBeGreaterThan(0.02);
    const before = await canvasPixels(page, GRAPH_CROP);
    await page.getByRole('button', { name: /^forked from/ }).click();
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).energy).toBeLessThan(before.energy);
    await page.getByRole('button', { name: /^forked from/ }).click();
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).energy).toBe(before.energy);
  });

  test('resizing the window resizes the drawing buffer with it', async ({ page }) => {
    const size = () => page.locator('[role="application"] canvas').evaluate((c: HTMLCanvasElement) => ({ w: c.width, cw: c.clientWidth, dpr: window.devicePixelRatio }));
    const a = await size();
    await page.setViewportSize({ width: 1180, height: 800 });
    await expect.poll(async () => (await size()).cw).toBeLessThan(a.cw);
    const b = await size();
    expect(Math.abs(b.w - b.cw * b.dpr)).toBeLessThanOrEqual(2);
  });

  test('recovers from a lost WebGL context: the graph is redrawn after the context is restored', async ({ page }) => {
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).inkShare).toBeGreaterThan(0.02);
    const ok = await page.locator('[role="application"] canvas').evaluate(async (c: HTMLCanvasElement) => {
      const gl = c.getContext('webgl2') as WebGL2RenderingContext;
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return 'no WEBGL_lose_context extension';
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 200));
      if (!gl.isContextLost()) return 'context was not lost';
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 400));
      return gl.isContextLost() ? 'context was not restored' : 'ok';
    });
    expect(ok).toBe('ok');
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).inkShare, { timeout: 15_000 }).toBeGreaterThan(0.02);
  });

  test('switching renderer keeps the selection and the camera: the same node is in the same place in both backends', async ({ page }) => {
    // Select a node and zoom, in WebGL.
    const card = page.locator('[data-overlay-node="exec-r1"]');
    let p = await centre(card);
    await page.mouse.click(p.x, p.y);
    await expect(status(page)).toContainText('lineage · exec-r1');
    const host = (await viewport(page).boundingBox())!;
    await page.mouse.move(host.x + host.width * 0.4, host.y + host.height * 0.5);
    await page.mouse.wheel(0, -250);
    await expect.poll(async () => { const b = await card.boundingBox(); return b ? b.width : 0; }).toBeGreaterThan(200);
    await page.waitForTimeout(250);
    const inWebgl = await centre(card);

    await useBackend(page, 'svg-dom');
    await expect(nodeGroups(page)).toHaveCount(13);
    await expect(status(page)).toContainText('lineage · exec-r1'); // the selection survived the swap
    const inSvg = await centre(page.locator('[role="application"] svg [data-node-id="exec-r1"]'));
    expect(Math.abs(inSvg.x - inWebgl.x)).toBeLessThan(3);
    expect(Math.abs(inSvg.y - inWebgl.y)).toBeLessThan(3);

    await useBackend(page, 'webgl2-instanced');
    await expect(status(page)).toContainText('lineage · exec-r1');
    await expect(page.locator('[data-overlay-node="exec-r1"]')).toBeVisible();
    p = await centre(page.locator('[data-overlay-node="exec-r1"]'));
    expect(Math.abs(p.x - inWebgl.x)).toBeLessThan(3);
    expect(Math.abs(p.y - inWebgl.y)).toBeLessThan(3);
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).inkShare).toBeGreaterThan(0.01);
  });

  test('a stress scene renders in WebGL, is labelled synthetic, and the recorded scene returns identical', async ({ page }) => {
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).inkShare).toBeGreaterThan(0.02);
    const before = await canvasPixels(page, GRAPH_CROP);
    const scene = page.getByLabel('Scene', { exact: true });
    const stress = await scene.locator('option', { hasText: '1000 nodes' }).getAttribute('value');
    await scene.selectOption(stress!);
    await expect(page.getByText(/SYNTHETIC FIXTURE · 1000 NODES/)).toBeVisible();
    await expect(page.getByText(/1000\/1000 nodes/)).toBeVisible();
    await expect.poll(async () => (await canvasPixels(page)).inkShare).toBeGreaterThan(0.005);
    const recorded = await scene.locator('option', { hasText: 'recorded lineage' }).getAttribute('value');
    await scene.selectOption(recorded!);
    await expect.poll(async () => (await canvasPixels(page, GRAPH_CROP)).energy).toBe(before.energy);
  });

  test('under the filter every text card stays, dimmed, exactly as the SVG backend dims its nodes', async ({ page }) => {
    await page.getByLabel('Filter nodes').fill('replay');
    await expect.poll(async () => page.locator('[data-overlay-node]').evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === '0.15').length)).toBe(11);
    await expect(page.locator('[data-overlay-node]')).toHaveCount(13);
    const full = await page.locator('[data-overlay-node]').evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === '1').map((e) => e.getAttribute('data-overlay-node')).sort());
    expect(full).toEqual(['exec-a', 'exec-replay1']);
  });

  test('measured figures do not survive a switch of backend, and each block names the backend that produced it', async ({ page }) => {
    test.setTimeout(120_000);
    await page.getByRole('button', { name: 'diagnostics' }).click();
    await page.getByRole('button', { name: /run measurement pass/ }).click();
    const panel = page.getByRole('complementary', { name: 'Rendering diagnostics' });
    await expect(panel.getByText(/webgl2-instanced/).first()).toBeVisible({ timeout: 90_000 });
    await expect(panel.getByText(/scene build \(corpus → scene\):/)).toBeVisible();
    await expect(panel.getByText(/scene generation \(synthetic fixture\):/).first()).toBeVisible();
    await useBackend(page, 'svg-dom');
    await expect(panel.getByText(/No measurements recorded yet/)).toBeVisible();
    await expect(panel.getByText(/webgl2-instanced \(/)).toHaveCount(0);
  });
});
