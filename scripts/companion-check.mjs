import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createApplication } from '../server/app.mjs';

const directory = mkdtempSync(join(tmpdir(), 'echo-companion-browser-'));
const runtime = createApplication(directory);
runtime.store.state.speed = 0;
runtime.app.use(express.static(resolve('dist')));
const server = runtime.app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const output = resolve('artifacts/companion');
mkdirSync(output, { recursive: true });
const errors = [],
  screenshots = [];
let browser;
async function snap(page, name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    `${name}: document fits`,
  );
  const overflow = await page
    .locator('.page-overlay')
    .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  assert.equal(overflow, false, `${name}: panel fits`);
  screenshots.push(name);
}
async function state() {
  return (await fetch(base + '/api/state')).json();
}
async function waitRevision(page, revision) {
  await page.waitForFunction(
    async (r) => (await (await fetch('/api/state')).json()).game.revision > r,
    revision,
  );
}
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator('canvas').waitFor();
  await page
    .getByRole('textbox', { name: '和 Echo 说点什么', exact: true })
    .fill('我的生日是9月16日。我喜欢抹茶。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.locator('.message.assistant').filter({ hasText: '记下了' }).waitFor();
  await page.getByRole('button', { name: '回忆手记', exact: true }).click();
  await page.getByLabel('搜索记忆').fill('生日');
  const memoryEntry = page.locator('.memory-entry').filter({ hasText: '9月16日' });
  await memoryEntry.getByRole('button', { name: /^置顶记忆/ }).click();
  await memoryEntry.getByRole('button', { name: /^取消置顶/ }).waitFor();
  await memoryEntry.getByRole('button', { name: /^编辑记忆/ }).click();
  await page.getByLabel('想让 Echo 记住的事').fill('我的生日是9月17日');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await page.locator('.memory-entry').filter({ hasText: '9月17日' }).waitFor();
  await snap(page, 'desktop-memory');
  await page.getByRole('button', { name: '记一件事', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('周末的约定');
  await page.getByLabel('分类', { exact: true }).selectOption('promise');
  await page.getByLabel('想让 Echo 记住的事').fill('我们周末去公园');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await page.locator('.memory-editor').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '一起玩', exact: true }).first().click();
  await page.getByRole('button', { name: '要一个拥抱', exact: true }).click();
  await page.locator('.companion-choices').getByRole('button', { name: '只是想抱抱你' }).click();
  await page.locator('.companion-response').filter({ hasText: '好心情' }).waitFor();
  await snap(page, 'desktop-together');
  await page.getByRole('button', { name: '认真下', exact: true }).click();
  await page.getByRole('button', { name: '邀请 Echo 开始', exact: false }).click();
  await page.getByRole('group', { name: '国际象棋棋盘' }).waitFor();
  await page.getByRole('button', { name: 'e2 白兵', exact: true }).click();
  await page.getByRole('button', { name: 'e4 空位 可落子', exact: true }).click();
  await waitRevision(page, 0);
  assert.equal((await state()).game.moves.length, 2);
  await snap(page, 'desktop-chess');
  await page.reload();
  await page.getByRole('button', { name: '一起玩', exact: true }).first().click();
  await page.getByRole('group', { name: '国际象棋棋盘' }).waitFor();
  assert.equal(await page.locator('.chess-moves > div').count(), 1);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 780 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await snap(page, `chess-${viewport.width}`);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('button', { name: '结束这一局', exact: true }).click();
  await page.getByRole('button', { name: '认输结束', exact: true }).click();
  await page.getByRole('button', { name: '游戏桌', exact: true }).click();
  await page.getByRole('button', { name: /心动翻牌.*等待我们的第一局/ }).click();
  await page.getByRole('button', { name: '邀请 Echo 开始', exact: false }).click();
  await page.getByRole('group', { name: '翻牌桌' }).waitFor();
  await page.getByRole('button', { name: '第 1 张牌 未翻开', exact: true }).click();
  await waitRevision(page, 0);
  await page.getByRole('button', { name: '第 2 张牌 未翻开', exact: true }).click();
  await waitRevision(page, 1);
  await snap(page, 'desktop-pairs');
  await page.setViewportSize({ width: 390, height: 844 });
  await snap(page, 'mobile-pairs');
  // Continue a complete legal match through UI controls; hidden state is never used to choose cards.
  let steps = 0;
  while ((await state()).game.status === 'playing' && steps++ < 160) {
    const g = (await state()).game;
    if (g.revealed.length === 2)
      await page
        .getByRole('button', {
          name: g.turn === 'echo' ? '看看 Echo 的选择' : '继续翻牌',
          exact: true,
        })
        .click();
    else {
      const available = g.cards.flatMap((value, i) => (value === null ? [i] : []));
      await page
        .getByRole('button', { name: `第 ${available[0] + 1} 张牌 未翻开`, exact: true })
        .click();
    }
    await waitRevision(page, g.revision);
  }
  assert.equal((await state()).game.status, 'finished');
  await page.getByRole('button', { name: '游戏桌', exact: true }).click();
  await page.getByRole('button', { name: /两人的调饮台.*等待我们的第一局/ }).click();
  await page.getByRole('button', { name: '邀请 Echo 开始', exact: false }).click();
  await page.locator('.drink-order').waitFor();
  await snap(page, 'mobile-drinks');
  await page.setViewportSize({ width: 1440, height: 960 });
  for (let round = 0; round < 3; round++) {
    const g = (await state()).game,
      wish = g.order.wish;
    await page
      .getByRole('button', {
        name: wish.includes('抹茶') ? '抹茶' : wish.includes('茉莉') ? '茉莉' : '红茶',
        exact: true,
      })
      .click();
    const levels = {
      甜度: wish.includes('不加糖') ? 0 : wish.includes('微甜') ? 25 : 50,
      冰量: wish.includes('不加冰')
        ? 0
        : wish.includes('少冰')
          ? 25
          : wish.includes('满冰')
            ? 100
            : 75,
      茶香: wish.includes('浓一点') ? 75 : wish.includes('清淡') ? 25 : 50,
    };
    for (const [name, value] of Object.entries(levels)) {
      const slider = page.getByRole('slider', { name, exact: true });
      await slider.focus();
      await slider.press('Home');
      for (let i = 0; i < value / 25; i++) await slider.press('ArrowRight');
    }
    await page.getByRole('button', { name: '请 Echo 尝一口', exact: true }).click();
    await waitRevision(page, g.revision);
    assert.equal((await state()).game.feedback.score, 100);
    if (round === 0) await snap(page, 'desktop-drinks');
    await page
      .getByRole('button', { name: round === 2 ? '收下今日特调' : '下一杯', exact: true })
      .click();
    await waitRevision(page, g.revision + 1);
  }
  assert.equal((await state()).game.status, 'finished');
  await snap(page, 'desktop-result');
  await page.getByRole('button', { name: '返回小家', exact: true }).click();
  await page
    .getByRole('textbox', { name: '和 Echo 说点什么', exact: true })
    .fill('还记得刚才一起调饮吗？');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page
    .locator('.message.assistant')
    .filter({ hasText: '我记得。' })
    .filter({ hasText: '100 分' })
    .waitFor();
  await page.getByRole('button', { name: '搜索聊天记录', exact: true }).click();
  await page.getByLabel('搜索聊天内容').fill('调饮');
  assert.ok((await page.locator('.message').count()) > 0);
  await page.getByRole('button', { name: '搜索聊天记录', exact: true }).click();
  const last = page.locator('.message.assistant').last();
  await last.getByTitle('引用回复').click();
  await page.getByRole('textbox', { name: '和 Echo 说点什么', exact: true }).fill('下次换你来。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.locator('.quoted-message').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '和 Echo 聊聊', exact: true }).click();
  await page.screenshot({ path: join(output, 'mobile-chat.png') });
  await page.getByRole('button', { name: '回忆手记', exact: true }).click();
  await snap(page, 'mobile-memory');
  assert.deepEqual(errors, []);
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify({ ok: true, screenshots, errors, pairSteps: steps }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, screenshots, errors, pairSteps: steps }));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  runtime.close();
  rmSync(directory, { recursive: true, force: true });
}
