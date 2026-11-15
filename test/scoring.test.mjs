import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceScore } from '../lib/scoring.mjs';
import { StudyEngine } from '../lib/engine.mjs';

const makeQuestions = (groups, level = 'N2') => groups.flatMap(([type, count, correct, answered = count]) =>
  Array.from({ length: count }, (_, index) => ({ id: `${type}-${index}`, type, level, answer: 'a',
    chosen: index < answered ? index < correct ? 'a' : 'b' : undefined })));
const score = (questions, level = 'N2') => referenceScore(questions,
  Object.fromEntries(questions.filter(q => q.chosen !== undefined).map(q => [q.id, q.chosen])), level);

test('按截图的逐题分值计算三个部分，用实际题量作为分母', () => {
  const groups = [
    [101, 5, 5], [102, 5, 0], [103, 3, 3], [104, 7, 0], [105, 5, 0], [106, 5, 5],
    [201, 12, 0], [202, 5, 0], [203, 4, 0],
    [301, 5, 5], [302, 8, 0], [304, 2, 2], [305, 3, 0], [306, 3, 0],
    [401, 5, 5], [402, 6, 0], [403, 5, 0], [404, 11, 11], [405, 3, 0]
  ];
  const r = score(makeQuestions(groups));
  assert.deepEqual(r.sections.map(s => [s.earned, s.possible, s.score]), [[18, 56, 19.3], [16, 64, 15], [21, 52, 24.2]]);
  assert.deepEqual(r.sections.map(s => s.accuracy), [25.5, 33.3, 53.3]);
  assert.equal(r.score, 58.5); assert.equal(r.maxScore, 180); assert.equal(r.partial, false);
});

test('所有等级沿用相同权重，全对为180分，未答和答错均为0分', () => {
  const groups = [[106, 2, 2], [303, 2, 2], [406, 2, 2]];
  for (const level of ['N1', 'N2', 'N3', 'N4', 'N5']) {
    const qs = makeQuestions(groups, level);
    assert.equal(score(qs, level).score, 180);
    assert.deepEqual(score(qs, level).sections.map(s => s.possible), [4, 6, 2]);
    const zero = score(qs.map((q, i) => ({ ...q, chosen: i % 2 ? undefined : 'b' })), level);
    assert.equal(zero.score, 0); assert.equal(zero.maxScore, 180);
    assert.deepEqual(zero.sections.map(s => s.unanswered), [1, 1, 1]);
  }
});

test('专项题按所练范围计分，未涉及部分无分数或正确率；不同权重不当作等权正确率', () => {
  const r = score(makeQuestions([[401, 1, 1], [404, 1, 0, 0]]));
  assert.equal(r.score, 40); assert.equal(r.maxScore, 60); assert.equal(r.partial, true);
  assert.deepEqual(r.sections.slice(0, 2).map(s => [s.score, s.accuracy]), [[null, null], [null, null]]);
  assert.equal(r.sections[2].accuracy, 50); assert.equal(r.sections[2].unanswered, 1);
});

test('题数改变、跨卷混合练习与题目顺序均不改变计算原则', () => {
  const qs = makeQuestions([[106, 3, 1], [101, 1, 1], [306, 2, 1], [405, 1, 0]]);
  const r = score(qs);
  assert.equal(r.sections[0].score, 25.7); assert.equal(r.sections[0].possible, 7);
  assert.equal(r.sections[1].score, 30); assert.equal(r.score, 55.7);
  assert.deepEqual(score([...qs].reverse()), r);
});

test('未知题型保持正确率统计但不编造参考分或总分', () => {
  const r = score(makeQuestions([[299, 1, 1], [301, 1, 1], [501, 1, 1]]));
  assert.equal(r.sections[0].accuracy, 100); assert.equal(r.sections[0].score, null);
  assert.equal(r.sections[1].score, 60); assert.equal(r.unclassified, 1); assert.equal(r.score, null);
});

const bank = () => ({ papers: [{ id: 'p', level: 'N2', title: '计分测试', durationSeconds: 60 }],
  questions: [106, 301, 404].map((type, i) => ({ id: `q${i}`, paperId: 'p', level: 'N2', type,
    stem: '测试', options: [{ id: 'a', text: '正确' }, { id: 'b', text: '错误' }], answer: 'a' })) });

test('旧练习和模考记录、恢复备份及超时自动交卷均返回新计分，重算不增加学习事件', () => {
  for (const mode of ['practice', 'exam']) {
    let now = 100000;
    const engine = new StudyEngine({ bank: bank(), now: () => now });
    const s = engine.createSession({ mode, level: 'N2', paperId: 'p', count: 'all' });
    engine.answer(s.id, { questionId: 'q0', optionId: 'a' });
    engine.answer(s.id, { questionId: 'q1', optionId: 'b' });
    if (mode === 'exam') now += 61000;
    const result = mode === 'exam' ? engine.getSession(s.id).result : engine.finish(s.id);
    assert.equal(result.scoring.score, 60); assert.equal(result.scoring.maxScore, 180);
    assert.equal(result.scoring.sections[2].unanswered, 1);
    const events = structuredClone(engine.state.events);
    delete engine.findSession(s.id).result.scoring;
    const saved = engine.exportState();
    const restored = new StudyEngine({ bank: bank() }); restored.restore(saved);
    assert.deepEqual(restored.getSession(s.id).result.scoring, result.scoring);
    assert.deepEqual(restored.finish(s.id).scoring, result.scoring);
    assert.deepEqual(restored.state.events, events);
    assert.equal(engine.findSession(s.id).result.scoring, undefined);
    assert.deepEqual(engine.getSession(s.id).result.scoring, result.scoring);
    assert.deepEqual(engine.state.events, events);
  }
});
