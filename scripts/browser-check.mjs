import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { OrthographicCamera, Vector3 } from 'three';
import { lanAddresses } from '../server/network.mjs';

const data = mkdtempSync(join(tmpdir(), 'echo-browser-test-'));
const output = resolve('artifacts');
mkdirSync(output, { recursive: true });
const port = Number(process.env.ECHO_TEST_PORT || 5197),
  url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/index.mjs', '--production'], {
  cwd: process.cwd(),
  env: { ...process.env, HOST: '0.0.0.0', PORT: String(port), ECHO_DATA_DIR: data },
  stdio: 'pipe',
  windowsHide: true,
});
let browser;
const errors = [],
  results = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(path, body) {
  const res = await fetch(url + '/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.ok(res.ok, `${path} returned ${res.status}`);
  return res.json();
}
function pixels(buffer) {
  const png = PNG.sync.read(buffer);
  let changed = 0;
  const colors = new Set();
  const baseline = [png.data[0], png.data[1], png.data[2]];
  for (let i = 0; i < png.data.length; i += 16) {
    const r = png.data[i],
      g = png.data[i + 1],
      b = png.data[i + 2];
    if (Math.abs(r - baseline[0]) + Math.abs(g - baseline[1]) + Math.abs(b - baseline[2]) > 45)
      changed++;
    colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
  }
  return {
    distinctColors: colors.size,
    subjectPixels: changed,
    fraction: changed / ((png.width * png.height) / 4),
  };
}
async function screenshot(page, name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
  const canvas = page.locator('canvas');
  const buffer = await canvas.screenshot();
  const stats = pixels(buffer);
  assert.ok(stats.distinctColors > 35, `${name}: scene has colors`);
  assert.ok(stats.fraction > 0.07, `${name}: scene is nonblank and occupies viewport`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  assert.equal(overflow, false, `${name}: no page overflow`);
  results.push({ name, ...stats });
  return buffer;
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url + '/api/state')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await wait(250);
  }
  assert.ok(ready, 'test server starts');
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await post('/control', { speed: 0 });
  await page.goto(url);
  await page.locator('canvas').waitFor();
  await page.getByRole('heading', { name: '一起生活的第 1 天' }).waitFor();
  await wait(3000);
  const before = await screenshot(page, 'desktop-home');
  await page.getByRole('button', { name: '放大视角', exact: true }).click();
  await wait(400);
  const zoomed = await page.locator('canvas').screenshot();
  assert.ok(!zoomed.equals(before), 'zoom changes the rendered scene');
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  const bounds = await page.locator('canvas').boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.78, bounds.y + bounds.height * 0.52, {
    steps: 12,
  });
  await page.mouse.up();
  await wait(300);
  assert.ok(
    !(await page.locator('canvas').screenshot()).equals(before),
    'orbit changes the rendered scene',
  );
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  const camera = new OrthographicCamera(
    -bounds.width / 2,
    bounds.width / 2,
    bounds.height / 2,
    -bounds.height / 2,
    0.1,
    150,
  );
  camera.position.set(12, 13, 16);
  camera.lookAt(0, 0, 0);
  camera.zoom = Math.min(bounds.width / 18.8, bounds.height / 13.4);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  async function clickWorld(x, y, z) {
    const point = new Vector3(x, y, z).project(camera);
    await page.mouse.click(
      bounds.x + ((point.x + 1) * bounds.width) / 2,
      bounds.y + ((1 - point.y) * bounds.height) / 2,
    );
  }
  await page.waitForFunction(
    () => document.querySelector('canvas')?.dataset.cameraMoving === 'false',
  );
  await clickWorld(1.35, 0.07, 2.5);
  await wait(500);
  const moved = await (await fetch(url + '/api/state')).json();
  assert.ok(
    Math.abs(moved.playerPosition[0] - 1.35) < 0.1,
    `floor click moves the player: ${JSON.stringify(moved.playerPosition)}`,
  );
  await clickWorld(-1.52, 1.45, -3.04);
  await page.getByRole('button', { name: '邀请 Echo', exact: true }).waitFor();
  await page.getByRole('button', { name: '关闭活动', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('Echo 对你的称呼').fill('小林');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await page.getByText('已保存。', { exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'desktop-settings.png') });
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
  await page.getByRole('textbox', { name: '和 Echo 说点什么', exact: true }).fill('我喜欢抹茶。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page
    .getByText('原来你喜欢抹茶，记住啦。以后在家里，也想多准备一些你喜欢的东西。', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: '回忆手记', exact: true }).click();
  await page.getByRole('heading', { name: '关于你的小事' }).waitFor();
  await page.screenshot({ path: join(output, 'desktop-journal.png') });
  await page.getByRole('button', { name: '返回小家', exact: true }).click();
  await page.getByRole('button', { name: '做饭', exact: true }).click();
  await page.getByText('我来洗菜，你来掌勺，好不好？今天想试试玉子烧。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '切换时间速度', exact: true }).click();
  await wait(1400);
  const moving = await page.locator('canvas').screenshot();
  await wait(1500);
  assert.ok(
    !(await page.locator('canvas').screenshot()).equals(moving),
    'characters animate while activity advances',
  );
  await page
    .getByText('做好啦！闻起来不错吧？趁热一起吃。', { exact: true })
    .waitFor({ timeout: 20000 });
  await post('/control', { speed: 0 });
  const saved = await (await fetch(url + '/api/state')).json();
  assert.ok(saved.meals >= 2);
  assert.ok(saved.memories.some((m) => m.title === '一起做饭'));
  await page.reload();
  await page.locator('canvas').waitFor();
  await wait(1800);
  assert.ok((await (await fetch(url + '/api/state')).json()).preferences.includes('喜欢抹茶'));
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await wait(1000);
    await screenshot(page, `home-${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(500);
  await page.getByRole('button', { name: '和 Echo 聊聊', exact: true }).click();
  await page
    .getByRole('textbox', { name: '和 Echo 说点什么', exact: true })
    .fill('还记得我喜欢什么吗？');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page
    .getByText('当然记得，你喜欢抹茶。和你有关的小事，我有认真听。', { exact: true })
    .waitFor();
  await page.screenshot({ path: join(output, 'mobile-chat.png') });
  await page.getByRole('button', { name: '返回小家', exact: true }).click();
  const lanAddress = lanAddresses().find((address) => address.startsWith('192.168.'));
  if (lanAddress) {
    const remoteUrl = `http://${lanAddress}:${port}`;
    assert.equal(
      (await fetch(remoteUrl + '/api/state')).status,
      401,
      'unpaired LAN state requests are denied',
    );
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '生成配对码', exact: true }).click();
    const pairing = await page.locator('.pairing-code output').textContent();
    const remote = await browser.newPage({ viewport: { width: 390, height: 844 } });
    remote.on('pageerror', (error) => errors.push(error.message));
    await remote.goto(remoteUrl);
    await remote.getByRole('heading', { name: '配对这台设备', exact: true }).waitFor();
    await remote.screenshot({ path: join(output, 'lan-pairing.png') });
    await remote.getByLabel('配对码', { exact: true }).fill(pairing);
    await remote.getByRole('button', { name: '进入小家', exact: true }).click();
    await remote.locator('canvas').waitFor();
    assert.equal(
      (await remote.request.get(remoteUrl + '/api/state')).status(),
      200,
      'paired device can access the world',
    );
    // Exercise the real LAN backend: visual fixtures cannot detect a stale server.
    await remote.getByRole('button', { name: '生活地图', exact: true }).click();
    await remote.getByRole('button', { name: '青禾超市', exact: true }).click();
    const travelResponse = remote.waitForResponse(
      (response) =>
        response.url() === remoteUrl + '/api/travel' && response.request().method() === 'POST',
    );
    await remote.getByRole('button', { name: '一起出发', exact: true }).click();
    assert.equal(
      (await travelResponse).status(),
      200,
      'paired phone can travel through the real API',
    );
    await remote.locator('.world[data-location="market"]').waitFor();
    await remote.locator('.journey-overlay').waitFor({ state: 'detached' });
    await remote.reload();
    await remote.locator('.world[data-location="market"]').waitFor();
    assert.equal(
      (await (await remote.request.get(remoteUrl + '/api/state')).json()).location,
      'market',
    );
    await remote.screenshot({ path: join(output, 'lan-market.png') });
    await remote.getByRole('button', { name: '设置', exact: true }).click();
    await remote.getByRole('button', { name: '断开此设备', exact: true }).click();
    await remote.getByRole('heading', { name: '配对这台设备', exact: true }).waitFor();
    assert.equal(
      (await remote.request.get(remoteUrl + '/api/state')).status(),
      401,
      'device logout revokes access',
    );
    await remote.close();
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  writeFileSync(
    join(output, 'browser-results.json'),
    JSON.stringify(
      {
        results,
        errors,
        checks: [
          'canvas content',
          'zoom',
          'orbit',
          'floor movement',
          'furniture selection',
          'character motion',
          'settings',
          'local chat',
          'preference recall',
          'activity completion',
          'persistent reload',
          'portrait',
          'landscape',
          'wide desktop',
          ...(lanAddress
            ? ['LAN pairing', 'LAN map travel', 'LAN location reload', 'LAN logout']
            : []),
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ ok: true, results, errors }, null, 2));
} finally {
  await browser?.close();
  server.kill();
  await new Promise((r) => {
    if (server.exitCode !== null) r();
    else server.once('exit', r);
  });
  rmSync(data, { recursive: true, force: true });
}
