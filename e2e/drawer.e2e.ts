import type { Page } from '@playwright/test';
import { test, expect } from './support';

// Real-browser keyboard verification of the inspector drawer: a MODAL below 1024px, a plain column above.
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'dpr1', 'keyboard behaviour does not depend on DPR');
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/');
});

const focusInside = (page: Page, name: string) =>
  page.evaluate((n) => { const d = document.querySelector(`[role="dialog"][aria-label="${n}"]`); return !!d && d.contains(document.activeElement); }, name);

test('opens as a named modal dialog with focus inside, traps Tab in both directions, and makes the page inert', async ({ page }) => {
  await page.locator('tr[data-seq="4"]').focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Event inspector' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toBeFocused();

  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); expect(await focusInside(page, 'Event inspector'), `Tab #${i + 1} left the dialog`).toBe(true); }
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Shift+Tab'); expect(await focusInside(page, 'Event inspector'), `Shift+Tab #${i + 1} left the dialog`).toBe(true); }

  const inert = await page.evaluate(() => ['header', 'footer', 'a[href="#workspace"]'].map((s) => document.querySelector(s)?.closest('[inert]') !== null));
  expect(inert).toEqual([true, true, true]);
  // The page behind cannot take focus, even by script.
  await page.locator('header button').first().focus();
  expect(await focusInside(page, 'Event inspector')).toBe(true);
});

test('the page shortcuts stand down while it is open; Escape closes it, returns focus to the row, and they work again', async ({ page }) => {
  const row = page.locator('tr[data-seq="4"]');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Event inspector' })).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Observe', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
  await page.keyboard.press('j');
  await expect(page.locator('tr[data-seq="4"]')).toHaveAttribute('aria-selected', 'true'); // j did not step

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Event inspector' })).toBeHidden();
  await expect(row).toBeFocused();
  expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('its own close control and the backdrop both close it and return focus', async ({ page }) => {
  const row = page.locator('tr[data-seq="6"]');
  await row.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Close Event inspector' }).click();
  await expect(page.getByRole('dialog', { name: 'Event inspector' })).toBeHidden();
  await expect(row).toBeFocused();

  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Event inspector' })).toBeVisible();
  await page.mouse.click(30, 400); // the backdrop, to the left of the drawer
  await expect(page.getByRole('dialog', { name: 'Event inspector' })).toBeHidden();
});

test('focus stays in the dialog when the record changes under it (Next event replaces the content)', async ({ page }) => {
  await page.locator('tr[data-seq="4"]').focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Event inspector' });
  await dialog.getByRole('button', { name: /Next event/ }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('seq 5')).toBeVisible();
  expect(await focusInside(page, 'Event inspector')).toBe(true);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
});

test('widening the window ends the modal and leaves focus alone; narrowing again restores it', async ({ page }) => {
  await page.locator('tr[data-seq="4"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Event inspector' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Event inspector' })).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
  await page.keyboard.press('2'); // shortcuts are live again at desktop width
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('1');
  await page.locator('tr[data-seq="4"]').click();
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(page.getByRole('dialog', { name: 'Event inspector' })).toBeVisible();
  expect(await focusInside(page, 'Event inspector')).toBe(true);
});

test('Compare, Capabilities and Evolve inspectors are named modal dialogs and return focus to what opened them', async ({ page }) => {
  // Compare: a link
  await page.keyboard.press('2');
  const cell = page.getByLabel(/Events of trajectory A/).getByRole('button').nth(4);
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Link inspector' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cell).toBeFocused();
  // Capabilities: a row
  await page.getByRole('button', { name: 'Capabilities', exact: true }).click();
  const capRow = page.locator('table[role="grid"] tbody tr').nth(2);
  await capRow.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Capability inspector' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(capRow).toBeFocused();
  // Evolve: the Experiments details button
  await page.getByRole('button', { name: 'Evolve', exact: true }).click();
  await page.getByRole('tab', { name: /Experiments/ }).click();
  const details = page.getByRole('button', { name: /design & trial details/ });
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Trial inspector' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(details).toBeFocused();
});

test('at desktop width the inspector is a plain region: no dialog, no trap, nothing inert', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('tr[data-seq="4"]').click();
  await expect(page.getByRole('complementary', { name: 'Event inspector' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

test('narrow Evolve: every record in a section stays reachable (the list does not disappear below md)', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.getByRole('button', { name: 'Evolve', exact: true }).click();
  for (const tab of ['Experiments', 'Candidates', 'Checkpoints']) {
    await page.getByRole('tab', { name: new RegExp(tab) }).click();
    const items = page.locator('li button[aria-current]').first().locator('xpath=ancestor::ul[1]').locator('li button');
    const n = await items.count();
    expect(n, `${tab}: more than one record to choose from`).toBeGreaterThan(1);
    await expect(items.last()).toBeVisible();
    await items.last().click();
    await expect(items.last()).toHaveAttribute('aria-current', 'true');
    await expect(items.first()).not.toHaveAttribute('aria-current', 'true');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
