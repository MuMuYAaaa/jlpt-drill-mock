import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { StudyEngine } from '../lib/engine.mjs';
import { createApp } from '../server.mjs';

const fixture = () => ({
  papers: [{ id: 'paper-1', title: 'N2 测试卷', level: 'N2', durationSeconds: 180, sections: [{ id: 'vocab', title: '语言知识', durationSeconds: 120 }, { id: 'listen', title: '听力', durationSeconds: 60 }] }],
  questions: [
    { id: 'q1', paperId: 'paper-1', level: 'N2', sectionId: 'vocab', sectionTitle: '语言知识', number: '1', order: 1, type: 101, typeTitle: '汉字读法', stem: '日本', stemDocument: { type: 'document', blocks: [{ text: '日本', underline: true }] }, options: [{ id: '1', text: 'にほん' }, { id: '2', text: 'ちゅうごく' }], answer: '1', explanation: '日本的读音为にほん。' },
    { id: 'q2', paperId: 'paper-1', level: 'N2', sectionId: 'vocab', sectionTitle: '语言知识', number: '2', order: 2, type: 201, typeTitle: '语法形式', stem: '雨が降った。', options: [{ id: '1', text: 'a' }, { id: '2', text: 'b' }], answer: '2', explanation: '测试解析二' },
    { id: 'q3', paperId: 'paper-1', level: 'N2', sectionId: 'listen', sectionTitle: '听力', number: '3', order: 3, type: 401, typeTitle: '课题理解', stem: '听力题', options: [{ id: '1', text: 'a' }, { id: '2', text: 'b' }], answer: '1', explanation: '测试解析三', audio: '/media/audio-test' }
  ]
});

test('专项练习即时反馈，错误进入错题本，重复提交不重复计数，正确复习后移出错题本', () => {
  let now = 1000000;
  const e = new StudyEngine({ bank: fixture(), now: () => now });
  const s = e.createSession({ mode: 'practice', level: 'N2', type: 101, count: 20, order: 'sequential' });
  assert.equal(s.questions.length, 1); assert.ok(s.questions[0].stemDocument);
  now += 3000;
  const wrong = e.answer(s.id, { questionId: 'q1', optionId: '2' });
  assert.deepEqual(wrong, { correct: false, answer: '1', explanation: '日本的读音为にほん。' });
  e.answer(s.id, { questionId: 'q1', optionId: '2' });
  assert.equal(e.catalog().stats.answered, 1);
  assert.equal(e.review('wrong').items[0].wrongCount, 1);
  assert.deepEqual(e.getSession(s.id).feedback.q1, wrong);
  assert.throws(() => e.answer(s.id, { questionId: 'q1', optionId: '1' }), /已作答/);
  const redo = e.createSession({ mode: 'wrong', level: 'N2', count: 10 });
  e.answer(redo.id, { questionId: 'q1', optionId: '1' });
  assert.equal(e.review('wrong').items.length, 0);
  assert.equal(e.catalog().stats.accuracy, 50);
});

test('全部题量应用等级、题型、错题与收藏过滤；自定义题量必须为有效整数', () => {
  const bank=fixture();bank.questions.push({...bank.questions[0],id:'q4',order:4});
  bank.papers.push({id:'paper-n3',title:'N3 测试卷',level:'N3'});
  bank.questions.push({...bank.questions[0],id:'q5',paperId:'paper-n3',level:'N3',sectionId:'other'});
  const e=new StudyEngine({bank});
  const type=e.createSession({mode:'practice',level:'N2',type:101,count:'all',order:'sequential'});
  assert.deepEqual(type.questions.map(q=>q.id),['q1','q4']);
  assert.equal(e.createSession({mode:'practice',level:'N2',count:'all'}).questions.length,4);
  assert.equal(e.createSession({mode:'practice',level:'N2',count:2}).questions.length,2);
  e.answer(type.id,{questionId:'q4',optionId:'2'});
  assert.deepEqual(e.createSession({mode:'wrong',level:'N2',count:'all'}).questions.map(q=>q.id),['q4']);
  e.favorite('q1');e.favorite('q3');e.favorite('q5');
  assert.deepEqual(e.createSession({mode:'favorites',level:'N2',count:'all',order:'sequential'}).questions.map(q=>q.id),['q1','q3']);
  for(const count of [0,-1,1.5,'invalid'])assert.throws(()=>e.createSession({mode:'practice',level:'N2',count}),/题数应/);
});

test('模考按科目计时、隐藏答案、限制跨科修改，交卷仅统计一次并区分漏答', () => {
  let now = 1000000;
  const e = new StudyEngine({ bank: fixture(), now: () => now });
  const s = e.createSession({ mode: 'exam', level: 'N2', paperId: 'paper-1' });
  assert.equal(s.activeSectionIndex, 0); assert.equal(s.deadline, now + 120000);
  assert.ok(s.questions.every(q => !Object.hasOwn(q, 'answer') && !Object.hasOwn(q, 'explanation')));
  assert.deepEqual(s.feedback, {});
  assert.throws(() => e.answer(s.id, { questionId: 'q3', optionId: '1' }), /当前科目/);
  assert.deepEqual(e.answer(s.id, { questionId: 'q1', optionId: '1' }), { saved: true });
  assert.throws(() => e.answer(s.id, { questionId: 'q2', optionId: '9' }), /不属于/);
  assert.equal(e.catalog().stats.answered, 0);
  now += 30000;
  const next = e.nextSection(s.id);
  assert.equal(next.activeSectionIndex, 1); assert.equal(next.deadline, now + 60000);
  assert.throws(() => e.answer(s.id, { questionId: 'q1', optionId: '2' }), /当前科目/);
  e.answer(s.id, { questionId: 'q3', optionId: '2' });
  now += 10000;
  const result = e.finish(s.id);
  assert.equal(result.correct, 1); assert.equal(result.wrong, 1); assert.equal(result.unanswered, 1);
  assert.equal(result.accuracy, 33); assert.equal(result.elapsedSeconds, 40);
  assert.equal(result.sections[0].correct, 1);
  assert.equal(result.questions[0].answer, '1'); assert.equal(result.questions[0].chosen, '1');
  assert.deepEqual(e.finish(s.id), result); assert.equal(e.catalog().stats.answered, 2);
  assert.equal(e.review('wrong').items.length, 1);
});

test('考试跨越多个计时终点后恢复，不会因关闭页面而获得额外时间', () => {
  let now = 1000000;
  const e = new StudyEngine({ bank: fixture(), now: () => now });
  const s = e.createSession({ mode: 'exam', level: 'N2', paperId: 'paper-1' });
  now += 125000;
  const next = e.getSession(s.id);
  assert.equal(next.status, 'active'); assert.equal(next.activeSectionIndex, 1); assert.equal(next.deadline, 1180000);
  assert.throws(() => e.answer(s.id, { questionId: 'q1', optionId: '1' }), /当前科目/);
  now += 60000;
  const end = e.getSession(s.id);
  assert.equal(end.status, 'finished'); assert.equal(end.result.unanswered, 3); assert.equal(end.result.elapsedSeconds, 180);
  assert.throws(() => e.answer(s.id, { questionId: 'q3', optionId: '1' }), /已结束/);
});

test('本机持久化与备份保留断点、标记、收藏及考试剩余时间', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jlpt-engine-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const statePath = path.join(dir, 'progress.json');
  let now = 1000000;
  const first = new StudyEngine({ bank: fixture(), statePath, now: () => now });
  const practice = first.createSession({ mode: 'practice', level: 'N2', count: 3, order: 'sequential' });
  first.favorite('q1'); first.answer(practice.id, { questionId: 'q1', optionId: '1' });
  first.checkpoint(practice.id, { currentIndex: 1, flags: ['q2'] });
  const exam = first.createSession({ mode: 'exam', level: 'N2', paperId: 'paper-1' });
  now += 10000;
  const restarted = new StudyEngine({ bank: fixture(), statePath, now: () => now });
  const resumed = restarted.getSession(practice.id);
  assert.equal(resumed.currentIndex, 1); assert.deepEqual(resumed.flags, ['q2']); assert.equal(resumed.questions[0].favorite, true);
  assert.equal(resumed.feedback.q1.correct, true);
  assert.equal(restarted.getSession(exam.id).deadline, 1120000);
  const restored = new StudyEngine({ bank: fixture(), now: () => now }); restored.restore(restarted.exportState());
  assert.equal(restored.getSession(practice.id).answers.q1, '1'); assert.equal(restored.catalog().stats.favorites, 1);
  assert.throws(() => restored.restore({ version: 1 }), /备份格式/);
});

test('题库导入先完成验证，失败不会污染题库；旧练习使用创建时快照', () => {
  const e = new StudyEngine({ bank: fixture() });
  const s = e.createSession({ mode: 'practice', level: 'N2', type: 101 });
  const changed = fixture(); changed.questions[0].answer = '2'; changed.questions[0].stem = '修改后的题干';
  e.importBank(changed);
  assert.equal(e.getSession(s.id).questions[0].stem, '日本');
  assert.equal(e.answer(s.id, { questionId: 'q1', optionId: '1' }).correct, true);
  const invalid = fixture(); invalid.questions[0].answer = '9';
  assert.throws(() => e.importBank(invalid), /答案不属于/);
  assert.equal(e.questions.get('q1').stem, '修改后的题干');
  const reserved = fixture(); reserved.questions[0].id = '__proto__';
  assert.throws(() => e.importBank(reserved), /有效的 id/);
});

test('HTTP仅本机同源访问，不提供题库原文件，支持静态音频Range', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jlpt-http-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'public')); fs.mkdirSync(path.join(dir, 'media')); fs.mkdirSync(path.join(dir, 'data'));
  fs.writeFileSync(path.join(dir, 'public', 'index.html'), '<h1>JLPT</h1>');
  fs.writeFileSync(path.join(dir, 'media', 'sample.mp3'), '0123456789');
  fs.writeFileSync(path.join(dir, 'data', 'bank.json'), JSON.stringify(fixture()));
  fs.writeFileSync(path.join(dir, 'data', 'media-index.json'), JSON.stringify({ 'blocked-audio': { url: 'http://127.0.0.1/private', mime: 'audio/mpeg' } }));
  const { server } = createApp({ root: dir, engine: new StudyEngine({ bank: fixture() }) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/api/catalog', { headers: { Origin: 'https://example.com' } })).status, 403);
  assert.equal((await fetch(base + '/data/bank.json')).status, 404);
  assert.equal((await fetch(base + '/evidence/local_keys.json')).status, 404);
  assert.equal((await fetch(base + '/media/blocked-audio')).status, 400);
  const media = await fetch(base + '/media/sample.mp3', { headers: { Range: 'bytes=2-5' } });
  assert.equal(media.status, 206); assert.equal(media.headers.get('content-range'), 'bytes 2-5/10'); assert.equal(await media.text(), '2345');
  assert.equal((await fetch(base + '/media/sample.mp3', { headers: { Range: 'bytes=50-' } })).status, 416);
  const session = await fetch(base + '/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'exam', level: 'N2', paperId: 'paper-1' }) });
  assert.equal(session.status, 201);
  const created = await session.json(); assert.equal(created.questions[0].answer, undefined);
  const invalid = await fetch(base + '/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'bad json' });
  assert.equal(invalid.status, 400);
});
