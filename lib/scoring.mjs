// Reference weights transcribed from the N2 worksheet supplied by the user.
// All levels use this scheme as requested. Additional types default to 3 points
// for long reading and 1 for utterance expression, shown in the result legend.
// Denominators use the actual questions, not the worksheet's example counts.
const WEIGHTS = new Map([
  [101, 1], [102, 1], [103, 1], [104, 1], [105, 1], [106, 2],
  [201, 1], [202, 1], [203, 1],
  [301, 2], [302, 3], [303, 3], [304, 3], [305, 4], [306, 4],
  [401, 2], [402, 2], [403, 2], [404, 1], [405, 3], [406, 1]
]);
const PARTS = [
  { id: 'language', title: '文字词汇（含语法）', min: 100, max: 300 },
  { id: 'reading', title: '阅读', min: 300, max: 400 },
  { id: 'listening', title: '听力', min: 400, max: 500 }
];
const round = value => Math.round((value + Number.EPSILON) * 10) / 10;

export function referenceScore(questions, answers, level) {
  const sections = PARTS.map(({ id, title, min, max }) => {
    const selected = questions.filter(q => Number(q.type) >= min && Number(q.type) < max);
    const correct = selected.filter(q => answers[q.id] === q.answer).length;
    const unanswered = selected.filter(q => !Object.hasOwn(answers, q.id)).length;
    let earned = 0, possible = 0, unsupported = 0;
    for (const q of selected) {
      const weight = WEIGHTS.get(Number(q.type));
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
  return { version: 1, method: 'n2-worksheet', level,
    score: available ? round(involved.reduce((sum, s) => sum + s.score, 0)) : null,
    maxScore: involved.length * 60, fullMaxScore: 180,
    partial: involved.length < 3, unclassified, sections };
}
