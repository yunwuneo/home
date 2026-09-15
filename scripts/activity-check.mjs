import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initialState, publicState, startActivity } from '../server/simulation.mjs';

// Browser-only fixtures exercise every pose without changing the user's save.
const url = process.env.ECHO_VISUAL_URL || 'http://127.0.0.1:5173';
const output = resolve('artifacts/activities');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [],
  results = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (e) => errors.push(e.message));
let fixture;
await page.route('**/api/state', (route) => route.fulfill({ json: fixture }));

function makeFixture(kind, fraction, together = true, speed = 1) {
  const state = initialState();
  startActivity(state, kind, together);
  state.speed = speed;
  state.activity.stage = 'doing';
  state.activity.progress = 7 + (state.activity.duration - 7) * fraction;
  return publicState(state, false);
}
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
    `${name}: scene renders with sufficient visible content`,
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    `${name}: no overflow`,
  );
  await page.screenshot({ path: join(output, `${name}.png`) });
  results.push({ name, colors: colors.size, subjectFraction: fraction });
  return buffer;
}
try {
  const kinds = process.argv.slice(2);
  for (const kind of kinds.length
    ? kinds
    : ['cook', 'eat', 'tea', 'water', 'read', 'wash', 'tv', 'rest']) {
    fixture = makeFixture(kind, 0.2);
    await page.goto(url);
    await page.locator('.world-name.echo').waitFor();
    await page.waitForTimeout(2200);
    const before = await capture(`${kind}-early-desktop`);
    await page.waitForTimeout(800);
    assert.ok(!before.equals(await page.locator('canvas').screenshot()), `${kind}: animates`);
    fixture = makeFixture(kind, 0.65);
    await page.waitForTimeout(1500);
    await capture(`${kind}-middle-desktop`);
    fixture = makeFixture(kind, 0.92);
    await page.waitForTimeout(1400);
    await capture(`${kind}-late-desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await capture(`${kind}-mobile`);
    await page.setViewportSize({ width: 1440, height: 960 });
    console.log(`Verified ${kind}`);
  }
  fixture = makeFixture('cook', 0.6, false);
  await page.goto(url);
  await page.locator('.world-name.echo').waitFor();
  await page.waitForTimeout(2000);
  assert.match(await page.locator('.world-name.player').textContent(), /在家/);
  await capture('cook-solo');
  fixture.speed = 0;
  await page.waitForTimeout(2500);
  const paused = await page.locator('canvas').screenshot();
  await page.waitForTimeout(1200);
  assert.ok(
    paused.equals(await page.locator('canvas').screenshot()),
    'pause freezes characters and particles',
  );
  fixture.activity = null;
  await page.waitForTimeout(1500);
  assert.match(await page.locator('.world-name.player').textContent(), /在家/);
  await capture('cancelled');
  const beforeZoom = await page.locator('canvas').screenshot();
  await page.getByRole('button', { name: '放大视角', exact: true }).click();
  await page.waitForTimeout(400);
  assert.ok(
    !beforeZoom.equals(await page.locator('canvas').screenshot()),
    'camera zoom remains interactive',
  );
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  await capture('landscape');
  assert.deepEqual(errors, []);
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify(
      {
        results,
        errors,
        checks: [
          kinds.length ? kinds.join(', ') : 'eight activities',
          'three stages',
          'motion',
          'solo',
          'pause',
          'cancellation',
          'camera zoom',
          'desktop and mobile canvas pixels',
        ],
      },
      null,
      2,
    ),
  );
  console.log(`Verified ${results.length} activity screenshots; no browser errors.`);
} finally {
  await browser.close();
}
