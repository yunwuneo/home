import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { OrthographicCamera, Vector3 } from 'three';
import { initialState, publicState, startActivity, travel } from '../server/simulation.mjs';
import { PLACES } from '../shared/places.mjs';
import { ACTIVITIES } from '../shared/world.mjs';

const url = process.env.ECHO_VISUAL_URL || 'http://127.0.0.1:5173';
const output = resolve('artifacts/city');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
const errors = [],
  results = [];
page.on('pageerror', (e) => errors.push(e.message));
const fixture = initialState();
let rejectTravel = false;
fixture.speed = 0;
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() === 'POST') {
    const body = route.request().postDataJSON();
    if (path === '/api/travel') {
      if (rejectTravel)
        return route.fulfill({ status: 503, json: { error: '出行暂时不可用，请稍后重试。' } });
      travel(fixture, body.location);
    } else if (path === '/api/activity') {
      startActivity(fixture, body.kind);
      fixture.activity.stage = 'doing';
      fixture.activity.progress = 12;
      fixture.speed = 1;
    } else if (path === '/api/activity/cancel') fixture.activity = null;
    else if (path === '/api/control') fixture.speed = body.speed;
    else if (path === '/api/move') fixture.playerPosition = body.position;
    else throw new Error(`Unexpected mutation ${path}`);
  }
  await route.fulfill({ json: publicState(fixture, false) });
});
async function capture(name) {
  const buffer = await page.locator('canvas').screenshot();
  const png = PNG.sync.read(buffer),
    colors = new Set();
  let subject = 0;
  for (let i = 0; i < png.data.length; i += 16) {
    const [r, g, b] = png.data.subarray(i, i + 3);
    colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
    if (Math.abs(r - png.data[0]) + Math.abs(g - png.data[1]) + Math.abs(b - png.data[2]) > 45)
      subject++;
  }
  const fraction = subject / ((png.width * png.height) / 4);
  assert.ok(
    colors.size > 35 && fraction > 0.07,
    `${name}: visible scene (${colors.size}, ${fraction})`,
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    `${name}: no overflow`,
  );
  await page.screenshot({ path: join(output, `${name}.png`) });
  results.push({ name, colors: colors.size, fraction });
  return buffer;
}
async function openMap() {
  await page.getByRole('button', { name: '生活地图', exact: true }).click();
  await page.getByRole('dialog').waitFor();
}
try {
  await page.goto(url);
  await page.locator('.world-name.echo').waitFor();
  await page.waitForTimeout(2200);
  await capture('home-overview');
  const bounds = await page.locator('canvas').boundingBox();
  const cam = new OrthographicCamera(
    -bounds.width / 2,
    bounds.width / 2,
    bounds.height / 2,
    -bounds.height / 2,
    0.1,
    150,
  );
  cam.position.set(12, 13, 16);
  cam.lookAt(0, 0, 0);
  cam.zoom = Math.min(bounds.width / 18.8, bounds.height / 13.4);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const table = new Vector3(-3.2, 0.83, -0.7).project(cam);
  await page.mouse.click(
    bounds.x + ((table.x + 1) * bounds.width) / 2,
    bounds.y + ((1 - table.y) * bounds.height) / 2,
  );
  await page.locator('.world[data-focus="eat"]').waitFor();
  await page.waitForTimeout(1600);
  await capture('dining-close-desktop');
  assert.equal(fixture.activity, null, 'furniture focus does not start an activity');
  await page.getByRole('button', { name: '返回全景', exact: true }).click();
  await page.waitForTimeout(1300);
  await openMap();
  await page.screenshot({ path: join(output, 'map-desktop.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  for (const id of process.argv.includes('--quick')
    ? ['cinema', 'market', 'home']
    : ['market', 'cinema', 'office', 'cafe', 'park', 'home']) {
    await openMap();
    await page.getByRole('button', { name: PLACES[id].name, exact: true }).click();
    await page.getByRole('button', { name: '一起出发', exact: true }).click();
    await page.locator('.journey-overlay').waitFor();
    await page.locator(`.world[data-location="${id}"]`).waitFor();
    await page.locator('.journey-overlay').waitFor({ state: 'detached' });
    await page.waitForTimeout(1600);
    await capture(`${id}-overview-desktop`);
    if (id !== 'home') {
      const kind = PLACES[id].activities[0];
      await page.getByRole('button', { name: ACTIVITIES[kind].label, exact: true }).click();
      await page.waitForTimeout(1800);
      // Reload at the authoritative activity positions to inspect the seated/working pose.
      await page.reload();
      await page.locator('.world-name.echo').waitFor();
      await page.getByRole('button', { name: '近景镜头', exact: true }).click();
      await page.waitForTimeout(1800);
      const before = await capture(`${id}-close-desktop`);
      await page.locator('.close-activity').waitFor();
      assert.equal(
        await page.locator('.furniture-popover').count(),
        0,
        'active close view has no disabled invitation overlay',
      );
      await page.waitForTimeout(650);
      assert.ok(
        !before.equals(await page.locator('canvas').screenshot()),
        `${id}: animation moves`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1500);
    await capture(`${id}-mobile`);
    await openMap();
    await page.screenshot({ path: join(output, `map-${id}-mobile.png`) });
    await page.getByRole('button', { name: '关闭地图', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.waitForTimeout(1200);
    console.log(`Verified ${id}`);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1500);
  await capture('home-landscape');
  await openMap();
  await page.screenshot({ path: join(output, 'map-landscape.png') });
  await page.getByRole('button', { name: PLACES.park.name, exact: true }).click();
  await page.getByRole('button', { name: '一起出发', exact: true }).click();
  await page.locator('.journey-overlay').waitFor({ state: 'detached' });
  await page.waitForTimeout(1300);
  await capture('park-landscape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '近景镜头', exact: true }).click();
  await page.waitForTimeout(400);
  await capture('park-reduced-motion');
  rejectTravel = true;
  await openMap();
  await page.getByRole('button', { name: PLACES.office.name, exact: true }).click();
  await page.getByRole('button', { name: '一起出发', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '出行暂时不可用' }).waitFor();
  await page.locator('.journey-overlay').waitFor({ state: 'detached' });
  assert.equal(
    await page.locator('.world').getAttribute('data-location'),
    'park',
    'failed travel keeps current location',
  );
  assert.deepEqual(errors, []);
  writeFileSync(join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ ok: true, results, errors }, null, 2));
} finally {
  await browser.close();
}
