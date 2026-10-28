import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const SHOTS = 'docs/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/${query}`);
  return errors;
}
async function ready(page: Page) {
  await expect(page.locator('.viewer[data-ready="true"]')).toBeVisible({ timeout: 90_000 });
  await settle(page);
}
/** Waits until the canvas has rendered two more frames (software WebGL can be slow to compile shaders). */
async function settle(page: Page, ms = 1000) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(ms);
}
const detailTitle = (page: Page) => page.locator('#detail-title');
const listButton = (page: Page, name: string | RegExp) => page.locator('.struct-list button', { hasText: name });
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const mode = (page: Page, name: string) => page.locator('nav[aria-label="Mode"] button', { hasText: new RegExp(`^${name}$`) }).click();
const cameraButton = (page: Page, name: string) => page.locator('[aria-label="Camera views"] button', { hasText: new RegExp(`^${name}$`) });

test('loads the eye without console errors and with a clean main screen @smoke', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Human Eye', level: 1 })).toBeVisible();
  await expect(page.locator('aside.right')).toHaveCount(0);
  await expect(radio(page, 'Real')).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: `${SHOTS}/01-initial.png` });
  expect(errors).toEqual([]);
});

test('clicking the model selects the structure under the pointer', async ({ page }) => {
  await open(page);
  await ready(page);
  await cameraButton(page, 'Front').click();
  await settle(page, 1200);
  const box = (await page.locator('.viewer canvas').boundingBox())!;
  // The free area between the panels: its centre is the eye.
  await page.mouse.click(box.x + 318 + (box.width - 318) / 2, box.y + 70 + (box.height - 150) / 2);
  await expect(detailTitle(page)).toHaveText(/./);
  await expect(page.locator('aside.right')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-selected.png` });
});

test('search finds structures by name and synonym', async ({ page }) => {
  await open(page);
  await ready(page);
  const search = page.getByLabel('Search structures');
  await search.fill('blind spot');
  await search.press('Enter');
  await expect(detailTitle(page)).toHaveText('Optic disc');
  await search.fill('CN IV');
  await expect(page.locator('.search-results')).toContainText('Trochlear nerve');
  await search.fill('zzzz');
  await expect(page.getByText('No structure matches')).toBeVisible();
  await search.press('Escape');
  await expect(page.locator('fieldset.layers')).toBeVisible();
});

test('a group lists its parts and a part links back to its group', async ({ page }) => {
  await open(page);
  await ready(page);
  await listButton(page, /^Extraocular muscles$/).click();
  await expect(detailTitle(page)).toHaveText('Extraocular muscles');
  await expect(page.locator('aside.right')).toContainText('6 parts');
  await page.locator('aside.right .chips button', { hasText: 'Lateral rectus' }).click();
  await expect(detailTitle(page)).toHaveText('Lateral rectus');
  await page.locator('aside.right .chip-row button', { hasText: 'Extraocular muscles' }).click();
  await expect(detailTitle(page)).toHaveText('Extraocular muscles');
});

test('colour by layer paints each layer', async ({ page }) => {
  await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const real = await canvas.screenshot();
  await radio(page, 'Layers').click();
  await settle(page);
  expect(Buffer.compare(real, await canvas.screenshot())).not.toBe(0);
  await page.screenshot({ path: `${SHOTS}/03-colour-layers.png` });
});

test('layers hide and show structures; the bony orbit can be shown', async ({ page }) => {
  await open(page);
  await ready(page);
  await expect(listButton(page, /^Frontal bone/).locator('.tag')).toHaveText('hidden');
  await page.getByLabel('Bony orbit').check();
  await expect(listButton(page, /^Frontal bone/).locator('.tag')).toHaveCount(0);
  await page.getByLabel('Eye muscles').uncheck();
  await expect(listButton(page, /^Lateral rectus/).locator('.tag')).toHaveText('hidden');
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/04-orbit.png` });
});

test('isolate, zoom and reset', async ({ page }) => {
  await open(page);
  await ready(page);
  await listButton(page, /^Lens$/).click();
  await page.getByLabel('Isolate').check();
  await expect(listButton(page, /^Sclera/).locator('.tag')).toHaveText('hidden');
  await page.getByRole('button', { name: 'Zoom to' }).click();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/05-isolated-lens.png` });
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(detailTitle(page)).toHaveCount(0);
  await expect(listButton(page, /^Sclera/).locator('.tag')).toHaveCount(0);
});

test('camera presets switch views', async ({ page }) => {
  await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const first = await canvas.screenshot();
  await cameraButton(page, 'Top').click();
  await settle(page, 1200);
  expect(Buffer.compare(first, await canvas.screenshot())).not.toBe(0);
});

test('labels mode shows non-overlapping labels', async ({ page }) => {
  await open(page);
  await ready(page);
  await page.getByLabel('Labels').check();
  await settle(page, 1500);
  const shown = page.locator('.scene-label[data-state="shown"]');
  expect(await shown.count()).toBeGreaterThanOrEqual(3);
  const boxes = await shown.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i]!, boxes[j]!];
    expect(!(a[2]! <= b[0]! || b[2]! <= a[0]! || a[3]! <= b[1]! || b[3]! <= a[1]!), `labels ${i} and ${j} overlap`).toBe(false);
  }
  await page.screenshot({ path: `${SHOTS}/06-labels.png` });
});

test('the cut opens the eye, faces the camera to it, and can be flipped and turned off', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const whole = await canvas.screenshot();
  await radio(page, 'Side').click();
  await expect(cameraButton(page, 'Inner side')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.slice-hint')).toHaveText('Showing the outer (temple-side) half');
  await settle(page, 2500);
  expect(Buffer.compare(whole, await canvas.screenshot())).not.toBe(0);
  await page.screenshot({ path: `${SHOTS}/07-cut-sagittal.png` });
  await radio(page, 'Front').click();
  await page.getByRole('button', { name: 'Flip' }).click();
  await expect(cameraButton(page, 'Back')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.slice-hint')).toHaveText('Showing the front half');
  await radio(page, 'Off').click();
  await expect(page.getByLabel('Cut position')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Vision: focusing near, short sight and glasses, and the pupil', async ({ page }) => {
  test.slow();
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Vision');
  const panel = page.locator('.vision-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-focused]')).toHaveAttribute('data-focused', 'true');
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/08-vision-far.png` });
  await radio(page, '25 cm').click();
  await expect(panel).toContainText('4.0 D of 12.5 D');
  await radio(page, 'Short sight').click();
  await radio(page, 'Far away').click();
  await expect(panel.locator('[data-focused]')).toHaveAttribute('data-focused', 'false');
  await expect(panel.locator('[data-focused]')).toContainText('in front of the retina');
  await page.getByLabel(/^Glasses/).check();
  await expect(panel.locator('[data-focused]')).toHaveAttribute('data-focused', 'true');
  await settle(page, 2000);
  await page.screenshot({ path: `${SHOTS}/09-vision-myopia-glasses.png` });
  const before = Number(await panel.locator('[data-pupil]').getAttribute('data-pupil'));
  await page.getByLabel('Light level').fill('4.5');
  await expect.poll(async () => Number(await panel.locator('[data-pupil]').getAttribute('data-pupil'))).toBeLessThan(before - 0.5);
  expect(errors).toEqual([]);
});

test('Movement: the diagnostic gazes use the right muscles', async ({ page }) => {
  await open(page);
  await ready(page);
  await mode(page, 'Movement');
  await page.getByRole('button', { name: 'Down and left', exact: true }).click();
  await expect(page.locator('[data-main]')).toHaveAttribute('data-main', 'superior-oblique');
  await page.getByRole('button', { name: 'Right', exact: true }).click();
  await expect(page.locator('[data-main]')).toHaveAttribute('data-main', 'lateral-rectus');
  await settle(page, 2000);
  await page.screenshot({ path: `${SHOTS}/10-movement.png` });
});

test('Retina: the fundus view, layers, densities and the blind-spot test', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Retina');
  const panel = page.locator('.retina-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.density-chart')).toBeVisible();
  await expect(panel.locator('.blind-spot')).toBeVisible();
  await expect(panel).toContainText('199,000');
  await settle(page, 2500);
  await page.screenshot({ path: `${SHOTS}/11-fundus.png` });
  expect(errors).toEqual([]);
});

test('Pathway: damage at the chiasm gives bitemporal hemianopia; the reflex route shows', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Pathway');
  const panel = page.locator('.pathway-panel');
  await radio(page, 'Optic chiasm (middle)').click();
  await expect(panel.locator('[data-lesion]')).toContainText('bitemporal hemianopia');
  await expect(panel.locator('.field-diagram')).toHaveAttribute('data-fields', JSON.stringify({ leftEye: [false, true], rightEye: [true, false] }));
  await radio(page, 'Right optic tract').click();
  await expect(panel.locator('[data-lesion]')).toContainText('left homonymous hemianopia');
  await page.getByLabel('Show the pupil reflex route').check();
  await expect(panel).toContainText('Pretectal area');
  await settle(page, 2000);
  await page.screenshot({ path: `${SHOTS}/12-pathway.png` });
  expect(errors).toEqual([]);
});

test('Tears: the route from the gland to the nose', async ({ page }) => {
  await open(page);
  await ready(page);
  await mode(page, 'Tears');
  const panel = page.locator('.tears-panel');
  await expect(panel).toContainText('Nasolacrimal duct');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/13-tears.png` });
});

test('guided tour navigates forward, back, and finishes', async ({ page }) => {
  test.slow();
  await open(page);
  await ready(page);
  await mode(page, 'Guided tour');
  await expect(page.getByText(/step 1 of 12/)).toBeVisible();
  await expect(page.locator('#tour-title')).toHaveText('The eye in its orbit');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.locator('#tour-title')).toHaveText('Focusing near');
  await settle(page, 2500);
  await page.screenshot({ path: `${SHOTS}/14-tour-near.png` });
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText(/step 4 of 12/)).toBeVisible();
  await page.locator('.tour-index button').last().click();
  await expect(page.getByText(/step 12 of 12/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('button', { name: 'Anatomy' })).toHaveAttribute('aria-pressed', 'true');
});

test('phone layout: structures open from the dock and details follow a pick @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await ready(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('aside.left')).toBeHidden();
  await page.getByRole('button', { name: 'Structures' }).click();
  await listButton(page, /^Lens$/).click();
  await expect(page.locator('aside.left')).toBeHidden();
  await expect(detailTitle(page)).toHaveText('Lens');
  await page.screenshot({ path: `${SHOTS}/15-phone.png` });
});

test('the About sheet holds the HuBMAP and BodyParts3D credits', async ({ page }) => {
  await open(page);
  await ready(page);
  await page.getByRole('button', { name: /About this lab/ }).click();
  const dialog = page.getByRole('dialog', { name: 'About this lab' });
  await expect(dialog).toContainText('HuBMAP');
  await expect(dialog).toContainText('BodyParts3D');
  await expect(dialog).toContainText('Le Grand');
  await expect(dialog).toContainText('CC Attribution 4.0');
  await page.screenshot({ path: `${SHOTS}/16-about.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('without WebGL the learning content still works @smoke', async ({ page }) => {
  await open(page, '?nowebgl');
  await expect(page.getByRole('heading', { name: '3D view unavailable' })).toBeVisible();
  await listButton(page, /^Lens$/).click();
  await expect(detailTitle(page)).toHaveText('Lens');
});

test('a missing model shows an error with a working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/models/eye.glb', (route) => (fail ? route.fulfill({ status: 404, body: 'not found' }) : route.continue()));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('The 3D model could not be loaded');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await ready(page);
});

test('reduced motion: the pathway and tears views work without errors', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  const errors = await open(page);
  await ready(page);
  await mode(page, 'Pathway');
  await settle(page, 800);
  await mode(page, 'Tears');
  await settle(page, 800);
  expect(errors).toEqual([]);
  await context.close();
});
