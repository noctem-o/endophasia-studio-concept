import { test, expect } from './support';

const VIEWPORTS = [
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
  { name: 'small laptop', width: 1024, height: 768 },
];

for (const vp of VIEWPORTS) {
  test(`renders every workspace without horizontal overflow at ${vp.width}x${vp.height} (${vp.name})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'dpr1', 'the viewport matrix runs once, at DPR 1');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);

    // Observe
    await expect(page.getByRole('region', { name: 'Trajectory overview' })).toBeVisible();
    await expect(page.locator('tr[data-seq]')).toHaveCount(13);
    expect(await noOverflow()).toBe(true);
    // Compare
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(page.getByLabel(/Events of trajectory A/)).toBeVisible();
    await expect(page.getByLabel(/Events of trajectory A/).getByRole('button')).toHaveCount(13);
    expect(await noOverflow()).toBe(true);
    // Capabilities
    await page.getByRole('button', { name: 'Capabilities', exact: true }).click();
    await expect(page.getByRole('grid', { name: /Capabilities: declared against observed/ })).toBeVisible();
    expect(await page.locator('table[role="grid"] tbody tr').count()).toBeGreaterThanOrEqual(10);
    expect(await noOverflow()).toBe(true);
    // Evolve, every section
    await page.getByRole('button', { name: 'Evolve', exact: true }).click();
    await expect(page.getByTestId('lineage-explorer')).toBeVisible();
    for (const tab of ['Experiments', 'Candidates', 'Checkpoints', 'Lineage']) {
      await page.getByRole('tab', { name: new RegExp(tab) }).click();
      await expect(page.getByRole('tab', { name: new RegExp(tab) })).toHaveAttribute('aria-selected', 'true');
      expect(await noOverflow(), `${tab} overflows horizontally`).toBe(true);
    }
  });
}

test('the synthetic-data marker is on screen in every workspace', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Observe', 'Compare', 'Capabilities', 'Evolve']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByText('SYNTHETIC DATA', { exact: true })).toBeVisible();
  }
  await expect(page.getByText('SYNTHETIC PROGRAMME', { exact: true })).toBeVisible();
});

test('workspace keys work, and are ignored while typing', async ({ page }) => {
  await page.goto('/');
  const pressed = (name: string) => expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('3'); await pressed('Capabilities');
  await page.keyboard.press('1'); await pressed('Observe');
  await page.getByLabel('Search events').focus();
  await page.keyboard.type('2');
  await pressed('Observe');
  await expect(page.getByLabel('Search events')).toHaveValue('2');
});

test('a keyboard-focused table row shows a visible focus ring, and the focused row is the selected one', async ({ page }) => {
  await page.goto('/');
  await page.locator('tr[data-seq="3"]').click();
  await page.keyboard.press('ArrowDown');
  const row = page.locator('tr[data-seq="4"]');
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  const outline = await row.evaluate((e) => { const c = getComputedStyle(e); return { style: c.outlineStyle, width: parseFloat(c.outlineWidth), fv: e.matches(':focus-visible') }; });
  expect(outline).toEqual({ style: 'solid', width: 2, fv: true });
});

test('j and k step through the events being shown, never a hidden one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Tool/ }).click();
  await expect(page.locator('tr[data-seq]')).toHaveCount(4);
  await page.keyboard.press('j');
  await expect(page.locator('tr[data-seq="5"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('j'); await page.keyboard.press('j');
  await expect(page.locator('tr[data-seq="8"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('tr[data-seq="7"]')).toHaveCount(0);
});

test('the shortcut sheet opens with ? and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('?');
  const dlg = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('the trajectory overview: events recorded at the same instant each select their own marker (time axis)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Recorded session/ }).click();
  await page.getByRole('option', { name: /run-8d41aa/ }).click();
  await page.getByRole('radio', { name: 'time' }).or(page.getByRole('button', { name: 'time', exact: true })).first().click();
  const overview = page.getByRole('region', { name: 'Trajectory overview' });
  // seq 10 (model) and 11 (lifecycle) share one recorded offset, hence one x; they sit in different lanes.
  for (const seq of [10, 11]) {
    const box = await overview.locator(`g[data-seq="${seq}"]`).boundingBox();
    expect(box, `marker for seq ${seq}`).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page.locator(`tr[data-seq="${seq}"]`)).toHaveAttribute('aria-selected', 'true');
  }
});
