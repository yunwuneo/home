import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.ECHO_TEST_URL || 'http://127.0.0.1:5187';
mkdirSync('artifacts/chat/web', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = async (name) =>
  page.screenshot({ path: `artifacts/chat/web/${name}.png`, fullPage: true });
try {
  await page.request.post(base + '/api/control', { data: { speed: 0 } });
  await page.goto(base);
  await page.getByRole('button', { name: '聊天设置', exact: true }).waitFor();
  page.once('dialog', (d) => d.accept('Web 验收话题'));
  await page.getByRole('button', { name: '＋ 话题', exact: true }).click();
  await page
    .getByRole('combobox', { name: '话题', exact: true })
    .getByRole('option', { name: 'Web 验收话题' })
    .last()
    .waitFor({ state: 'attached' });
  await page
    .getByRole('textbox', { name: '和 Echo 说点什么', exact: true })
    .fill('请根据你记得的事情，告诉我每周六下午通常去哪里读书？');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.message.assistant')].some((e) =>
        e.textContent.includes('河畔书屋'),
      ),
    null,
    { timeout: 180000 },
  );
  await shot('01-real-chat-recall');
  const memory = page.locator('.message.assistant details').filter({ hasText: '使用了' }).last();
  await memory.locator('summary').click();
  await shot('02-memory-provenance');
  await page.getByRole('button', { name: '聊天设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '聊天设置' });
  await dialog.getByRole('button', { name: '模型', exact: true }).click();
  await shot('03-model-management');
  await dialog.getByRole('button', { name: '记忆', exact: true }).click();
  await dialog.getByPlaceholder('我平时喜欢喝什么？').fill('周六去哪里读书');
  await dialog.getByRole('button', { name: '检索记忆', exact: true }).click();
  await dialog.getByText('vector+keyword', { exact: false }).first().waitFor({ timeout: 90000 });
  await shot('04-vector-search');
  for (const [tab, name] of [
    ['指令', '05-instructions'],
    ['MCP', '06-mcp'],
    ['话题', '07-topic-model'],
    ['语音', '08-voice'],
  ]) {
    await dialog.getByRole('button', { name: tab, exact: true }).click();
    await shot(name);
  }
  await dialog.getByRole('button', { name: '关闭聊天设置' }).click();
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([
      'tests/fixtures/reading.pdf',
      'tests/fixtures/reading.docx',
      'artifacts/chat/red-card.png',
    ]);
  await page
    .getByText('附件已上传，发送消息后 Echo 就能查看。', { exact: true })
    .waitFor({ timeout: 30000 });
  await shot('09-uploaded-attachments');
  await page
    .getByRole('textbox', { name: '和 Echo 说点什么', exact: true })
    .fill('请读取两个文件，告诉我 PDF 和 DOCX 中各自的编号，再说图片主要是什么颜色。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.message.assistant')].some(
        (e) =>
          e.textContent.includes('4832') &&
          e.textContent.includes('2816') &&
          e.textContent.includes('红'),
      ),
    null,
    { timeout: 180000 },
  );
  await shot('10-real-files-and-image');
  const saved = await (await page.request.get(base + '/api/state')).json();
  assert(saved.messages.some((m) => m.content.includes('2816') && m.role === 'assistant'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', { name: '和 Echo 聊聊', exact: false })
    .count()
    .then(async (count) => {
      if (count) await page.getByRole('button', { name: '和 Echo 聊聊', exact: false }).click();
      else if (await page.locator('.mobile-chat-toggle').count())
        await page.locator('.mobile-chat-toggle').click();
    });
  await shot('11-mobile-chat');
  await page.getByRole('button', { name: '聊天设置', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '记忆', exact: true }).click();
  await shot('12-mobile-memory-settings');
  assert.deepEqual(errors, []);
  writeFileSync(
    'artifacts/chat/web/results.json',
    JSON.stringify(
      {
        ok: true,
        pageErrors: errors,
        tests: [
          'topic',
          'real chat recall',
          'provenance',
          'model management',
          'vector search',
          'instructions',
          'MCP settings',
          'topic model',
          'voice configuration',
          'PDF DOCX image upload and real comprehension',
          'mobile layout',
        ],
      },
      null,
      2,
    ),
  );
  console.log('Web real-service acceptance passed; 12 screenshots');
} finally {
  await browser.close();
}
