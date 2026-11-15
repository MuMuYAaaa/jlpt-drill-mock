import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceScore, middleReadingContexts } from '../lib/scoring.mjs';
import { StudyEngine } from '../lib/engine.mjs';

const makeQuestions = (groups, level = 'N2') => groups.flatMap(([type, count, correct, answered = count]) =>
  Array.from({ length: count }, (_, index) => ({ id: `${type}-${index}`, type, level, answer: 'a', paperId: 'p', order: index, groupId: `material-${Math.floor(index / 3)}`,
    chosen: index < answered ? index < correct ? 'a' : 'b' : undefined })));
const score = (questions, level = 'N2') => {
  const contexts = middleReadingContexts(questions);
  return referenceScore(questions.map(q => ({ ...q, scoringContext: contexts.get(q.id) })),
    Object.fromEntries(questions.filter(q => q.chosen !== undefined).map(q => [q.id, q.chosen])), level);
};

test('按截图的逐题分值计算三个部分，用实际题量作为分母', () => {
  const groups = [
    [101, 5, 5], [102, 5, 0], [103, 5, 5], [104, 7, 0], [105, 5, 0], [106, 5, 5],
    [201, 12, 0], [202, 5, 0], [203, 5, 0],
    [301, 5, 5], [302, 9, 0], [304, 2, 2], [305, 3, 0], [306, 2, 0],
    [401, 5, 5], [402, 6, 0], [403, 5, 0], [404, 12, 12], [405, 4, 0]
  ];
  const r = score(makeQuestions(groups));
  assert.deepEqual(r.sections.map(s => [s.earned, s.possible, s.score]), [[20, 59, 20.3], [16, 57, 16.8], [22, 56, 23.6]]);
  assert.deepEqual(r.sections.map(s => s.accuracy), [27.8, 33.3, 53.1]);
  assert.equal(r.score, 60.7); assert.equal(r.maxScore, 180); assert.equal(r.partial, false);
});

test('所有等级全对为180分，未答和答错均为0分，N4/N5沿用N3', () => {
  const groups = [[101, 2, 2], [301, 2, 2], [401, 2, 2]];
  for (const level of ['N1', 'N2', 'N3', 'N4', 'N5']) {
    const qs = makeQuestions(groups, level);
    assert.equal(score(qs, level).score, 180);
    assert.deepEqual(score(qs, level).sections.map(s => s.possible), ['N1','N2'].includes(level) ? [2, 4, 4] : [2, 6, 4]);
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

test('N1和N3逐题权重与新截图的三项合计一致，N4/N5逐项使用N3', () => {
  const groups = {
    N1: [[101,6],[104,7],[105,6],[106,6],[201,10],[202,5],[203,5],[301,4],[302,9],[303,4],[304,2],[305,4],[306,2],[401,6],[402,7],[403,6],[404,13],[405,4]],
    N3: [[101,8],[102,6],[104,11],[105,5],[106,5],[201,13],[202,5],[203,5],[301,4],[302,6],[303,4],[306,2],[401,6],[402,6],[403,3],[406,4],[404,9]]
  };
  for (const level of ['N1','N3','N4','N5']) {
    const r = score(makeQuestions(groups[level === 'N1' ? 'N1' : 'N3'].map(([type,n]) => [type,n,n]), level), level);
    assert.equal(r.score, 180);
    assert.deepEqual(r.sections.map(s => s.possible), level === 'N1' ? [56,58,56] : [58,60,56]);
    assert.equal(r.ruleLevel, level === 'N1' ? 'N1' : 'N3');
  }
  for (const [level, type, weight] of [['N1',203,2],['N2',203,1],['N1',402,1],['N2',402,2],['N3',106,1],['N3',303,4],['N4',406,2],['N5',404,2]]) {
    const r = score(makeQuestions([[type,1,1]], level), level);
    assert.equal(r.sections.find(s => s.total).earned, weight);
  }
});

test('N2中篇按原材料位置赋分，抽单题、随机顺序、跨卷、导入和备份都不重排分值', () => {
  const b = bank();
  b.questions = ['a0','a1','a2','b0','b1'].map((id,i) => ({ ...b.questions[0], id, type:302, order:i, number:String(i+1), groupId:id[0] }));
  const engine = new StudyEngine({ bank:b });
  assert.deepEqual([...engine.middleReadingContexts.values()].map(c => c.weight), [2,2,3,2,3]);
  for (const [id,weight] of [['a0',2],['a1',2],['a2',3],['b0',2],['b1',3]]) {
    const s = engine.createSession({ mode:'practice', level:'N2', questionIds:[id], count:1 });
    engine.answer(s.id, { questionId:id, optionId:'a' });
    assert.equal(engine.finish(s.id).scoring.sections[1].possible, weight);
  }
  const s = engine.createSession({ mode:'practice', level:'N2', questionIds:['a0','a2'], count:'all' });
  engine.answer(s.id, { questionId:'a0', optionId:'a' });
  engine.answer(s.id, { questionId:'a2', optionId:'b' });
  assert.equal(engine.finish(s.id).scoring.score, 24);
  const backup = engine.exportState();
  const restored = new StudyEngine({ bank:b }); restored.restore(backup);
  assert.equal(restored.getSession(s.id).result.scoring.score, 24);
  for (const q of restored.findSession(s.id).questions) delete q.scoringContext;
  assert.equal(restored.getSession(s.id).result.scoring.score, 24);
  const updated = structuredClone(b);
  updated.questions.push({ ...b.questions[2], id:'a3', order:10, number:'11' });
  engine.importBank(updated);
  assert.equal(engine.getSession(s.id).result.scoring.score, 24);
  // The same group label in a different paper must not change the last question.
  const other = b.questions.map(q => ({ ...q, id:'other-'+q.id, paperId:'other' }));
  assert.equal(middleReadingContexts([...b.questions,...other]).get('a2').weight, 3);
});

test('N2旧模考从自身完整题目恢复中篇分值，缺少材料位置信息时不猜测', () => {
  const b = bank(); b.questions = ['first','last'].map((id,i) => ({ ...b.questions[0], id, type:302, order:i, groupId:'article' }));
  const engine = new StudyEngine({ bank:b });
  const s = engine.createSession({ mode:'exam', level:'N2', paperId:'p' });
  engine.answer(s.id, { questionId:'first', optionId:'a' }); engine.finish(s.id);
  for (const q of engine.findSession(s.id).questions) delete q.scoringContext;
  const restored = new StudyEngine(); restored.restore(engine.exportState());
  assert.equal(restored.getSession(s.id).result.scoring.score, 24);
  const unknown = referenceScore([{ id:'isolated', level:'N2', type:302, answer:'a' }], { isolated:'a' }, 'N2');
  assert.equal(unknown.sections[1].accuracy, 100); assert.equal(unknown.score, null);
});

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
