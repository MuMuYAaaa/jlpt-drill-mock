import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from './browser.mjs';
import { StudyEngine } from '../lib/engine.mjs';
import { createApp } from '../server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
const engine = new StudyEngine({ bankPath: path.join(root, 'data/bank.json') });
const { server } = createApp({ root, port: 47329, engine });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(47329, '127.0.0.1', resolve); });
const base = 'http://127.0.0.1:47329', errors = [], checks = [];
const paperId = 'jlpt:N2:2026-07';
const correctTypes = new Set([101, 106, 201, 301, 304, 401, 404]);
function answerSection(s, questions) {
  for (const q of questions) engine.answer(s.id, { questionId: q.id,
    optionId: correctTypes.has(q.type) ? q.answer : q.options.find(o => o.id !== q.answer).id });
}
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });
  page.on('pageerror', e => errors.push(e.message));
  const practice = engine.createSession({ mode: 'practice', level: 'N2', paperId, count: 'all', order: 'sequential' });
  answerSection(practice, engine.findSession(practice.id).questions);
  await page.goto(`${base}/#session/${practice.id}`);
  await page.locator('[data-action="finish"]').click();
  await page.locator('[data-action="submit-finish"]').click();
  await page.locator('[data-total-score]').waitFor();
  async function assertScores() {
    assert.match(await page.locator('[data-total-score]').innerText(), /69\.1\s*\/ 180 分/);
    assert.equal(await page.locator('[data-score-section]').count(), 3);
    for (const [part, value, accuracy] of [['language', '28.9', '43.1%'], ['reading', '16.0', '35.0%'], ['listening', '24.2', '53.3%']]) {
      const card = page.locator(`[data-score-section="${part}"]`);
      assert.match(await card.locator('[data-section-score]').innerText(), new RegExp(value.replace('.', '\\.')));
      assert.ok((await card.locator('[data-section-accuracy]').innerText()).includes(accuracy));
    }
  }
  await assertScores();
  await page.screenshot({ path: path.join(root, 'evidence/pc-result-scores.png') });
  checks.push('真实 N2 101 题练习由界面提交后：28.9 + 16.0 + 24.2 = 69.1 / 180，三项正确率独立显示');

  const eventsBefore = structuredClone(engine.state.events);
  delete engine.findSession(practice.id).result.scoring;
  await page.reload(); await page.locator('[data-total-score]').waitFor(); await assertScores();
  assert.deepEqual(engine.state.events, eventsBefore);
  checks.push('旧版练习记录刷新后自动补算，学习事件和原记录不变');
  await page.locator('[data-action="result-filter"][data-kind="wrong"]').click();
  await assertScores();
  assert.equal(await page.locator('.result-review').count(), 56);
  checks.push('筛选错题时总分和三个部分统计不随筛选改变');
  await page.locator('[data-action="result-filter"][data-kind="all"]').click();
  await page.locator('#theme-button').click();
  await assertScores();
  await page.screenshot({ path: path.join(root, 'evidence/pc-result-scores-dark.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.result-score-grid').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(root, 'evidence/pc-result-scores-narrow.png') });
  checks.push('粉紫深色模式和窄屏卡片无横向溢出');
  await page.setViewportSize({ width: 1440, height: 1250 });
  await page.locator('#theme-button').click();

  const exam = engine.createSession({ mode: 'exam', level: 'N2', paperId });
  let s = engine.findSession(exam.id);
  answerSection(s, s.questions.filter(q => q.type < 400));
  engine.nextSection(s.id); engine.startListening(s.id);
  answerSection(s, s.questions.filter(q => q.type >= 400));
  await page.goto(`${base}/#session/${exam.id}`);
  await page.locator('#exam-focus-resume').click();
  await page.waitForFunction(() => !!document.fullscreenElement && !examFocus.locked);
  await page.locator('#exam-focus-bar [data-action="focus-finish"]').click();
  await page.locator('[data-action="submit-finish"]').click();
  await page.locator('[data-total-score]').waitFor(); await assertScores();
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.ok((await page.locator('#main h1').innerText()).includes('考试已完成'));
  assert.equal(await page.locator('.sidebar').isVisible(), true);
  await page.screenshot({ path: path.join(root, 'evidence/pc-exam-result-scores.png') });
  checks.push('真实模考经全屏交卷后退出考场，显示同一套加权分数和正确率');

  const one = engine.createSession({ mode: 'practice', level: 'N2', type: 101, count: 1 });
  const q = engine.findSession(one.id).questions[0];
  engine.answer(one.id, { questionId: q.id, optionId: q.answer }); engine.finish(one.id);
  await page.goto(`${base}/#result/${one.id}`); await page.locator('[data-total-score]').waitFor();
  assert.match(await page.locator('[data-total-score]').innerText(), /60\.0\s*\/ 60 分/);
  assert.match(await page.locator('[data-score-section="reading"]').innerText(), /未涉及/);
  assert.match(await page.locator('[data-score-section="listening"]').innerText(), /未涉及/);
  checks.push('单项练习仅按 60 分汇总，未涉及的两项显示空值和说明');

  const n3 = engine.createSession({ mode: 'practice', level: 'N3', questionIds: [101, 303, 406].map(type => engine.bank.questions.find(q => q.level === 'N3' && q.type === type).id), count: 'all' });
  for (const q of engine.findSession(n3.id).questions) engine.answer(n3.id, { questionId: q.id, optionId: q.answer });
  engine.finish(n3.id);
  await page.goto(`${base}/#result/${n3.id}`); await page.locator('[data-total-score]').waitFor();
  assert.match(await page.locator('[data-total-score]').innerText(), /180\.0\s*\/ 180 分/);
  checks.push('N3 长篇阅读和发话表达按相同规则计分，三项全对为 180 分');
  assert.deepEqual(errors, []);
  const report = { ok: true, at: new Date().toISOString(), checks, pageErrors: errors, isolatedInMemoryState: true };
  fs.writeFileSync(path.join(root, 'evidence/scoring-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
