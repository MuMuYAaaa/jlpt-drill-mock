// Practice reference weights transcribed from the user's N1/N2/N3 images.
// N4/N5 use the N3 scheme at the user's explicit request.
const RULES = {
  N1: {
    weights: {101:1,104:1,105:1,106:2,201:1,202:1,203:2,301:2,302:2,303:3,304:2,305:3,306:2,401:2,402:1,403:2,404:1,405:3},
    descriptions: ['用法、文章语法每题 2 分，其余每题 1 分。', '短篇、中篇、综合理解、信息检索每题 2 分；长篇、论点理解每题 3 分。', '课题理解、概要理解每题 2 分；要点理解、即时应答每题 1 分；综合理解每题 3 分。']
  },
  N2: {
    weights: {101:1,102:1,103:1,104:1,105:1,106:2,201:1,202:1,203:1,301:2,304:3,305:4,306:4,401:2,402:2,403:2,404:1,405:3},
    descriptions: ['用法每题 2 分，其余每题 1 分。', '短篇每题 2 分；中篇按原材料分组，末题 3 分，其余 2 分；综合理解每题 3 分；论点理解、信息检索每题 4 分。', '课题理解、要点理解、概要理解每题 2 分；即时应答每题 1 分；综合理解每题 3 分。']
  },
  N3: {
    weights: {101:1,102:1,104:1,105:1,106:1,201:1,202:1,203:1,301:3,302:4,303:4,306:4,401:2,402:2,403:2,404:2,406:2},
    descriptions: ['文字词汇、语法全部每题 1 分。', '短篇每题 3 分；中篇、长篇、信息检索每题 4 分。', '所有听力题型每题 2 分。']
  }
};
const PARTS = [
  { id: 'language', title: '文字词汇（含语法）', min: 100, max: 300 },
  { id: 'reading', title: '阅读', min: 300, max: 400 },
  { id: 'listening', title: '听力', min: 400, max: 500 }
];
const round = value => Math.round((value + Number.EPSILON) * 10) / 10;

function materialKey(q) {
  const material = q.groupId || q.passage || (q.passageDocument && JSON.stringify(q.passageDocument));
  return material ? JSON.stringify([q.paperId, q.sectionId, material]) : null;
}

// Build from complete original papers BEFORE selecting or shuffling practice.
// A one-question practice must retain the question's original group position.
export function middleReadingContexts(questions) {
  const groups = new Map(), contexts = new Map();
  for (const q of questions) {
    if (q.level !== 'N2' || Number(q.type) !== 302) continue;
    const key = materialKey(q);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  for (const [material, list] of groups) {
    list.sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || String(a.number).localeCompare(String(b.number), 'en', { numeric: true }) || a.id.localeCompare(b.id));
    list.forEach((q, index) => contexts.set(q.id, { version: 2, material, position: index + 1, size: list.length, weight: index === list.length - 1 ? 3 : 2 }));
  }
  return contexts;
}

export function sameScoringMaterial(saved, current) {
  return !!current && Number(saved.type) === Number(current.type) && materialKey(saved) !== null && materialKey(saved) === materialKey(current)
    && saved.order === current.order && saved.number === current.number;
}

function weightFor(q, ruleLevel) {
  if (ruleLevel === 'N2' && Number(q.type) === 302) {
    const c = q.scoringContext;
    return c?.version === 2 && Number.isInteger(c.position) && Number.isInteger(c.size) && c.position >= 1 && c.position <= c.size
      ? c.position === c.size ? 3 : 2 : undefined;
  }
  return RULES[ruleLevel]?.weights[Number(q.type)];
}

export function referenceScore(questions, answers, level) {
  const ruleLevel = ['N4', 'N5'].includes(level) ? 'N3' : level;
  const sections = PARTS.map(({ id, title, min, max }) => {
    const selected = questions.filter(q => Number(q.type) >= min && Number(q.type) < max);
    const correct = selected.filter(q => answers[q.id] === q.answer).length;
    const unanswered = selected.filter(q => !Object.hasOwn(answers, q.id)).length;
    let earned = 0, possible = 0, unsupported = 0;
    for (const q of selected) {
      const weight = weightFor(q, ruleLevel);
      if (weight === undefined) { unsupported++; continue; }
      possible += weight;
      if (answers[q.id] === q.answer) earned += weight;
    }
    const available = selected.length > 0 && unsupported === 0;
    return { id, title, total: selected.length, correct, unanswered,
      accuracy: selected.length ? round(correct / selected.length * 100) : null,
      earned, possible, unsupported, score: available ? round(earned / possible * 60) : null,
      maxScore: 60 };
  });
  const unclassified = questions.filter(q => !PARTS.some(p => Number(q.type) >= p.min && Number(q.type) < p.max)).length;
  const involved = sections.filter(s => s.total > 0);
  const available = unclassified === 0 && involved.length > 0 && involved.every(s => s.score !== null);
  return { version: 2, method: 'level-reference', level, ruleLevel,
    rules: PARTS.map((part, i) => ({ title: part.title, description: RULES[ruleLevel]?.descriptions[i] || '暂无计分规则。' })),
    score: available ? round(involved.reduce((sum, s) => sum + s.score, 0)) : null,
    maxScore: involved.length * 60, fullMaxScore: 180,
    partial: involved.length < 3, unclassified, sections };
}
