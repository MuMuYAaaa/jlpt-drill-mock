/** A listening timeline follows the paper's audio plan, independently of question navigation. */
export function validateAudioPlan(plan) {
  if (!plan || typeof plan !== 'object' || plan.version !== 1 || plan.completionPolicy !== 'audio_end' || !Array.isArray(plan.items) || !plan.items.length || plan.items.length > 1000) throw new Error('听力播放计划格式无效');
  let total = 0;
  const items = plan.items.map(item => {
    if (!item || typeof item.audioId !== 'string' || !item.audioId || item.audioId.length > 600 || typeof item.src !== 'string' || !item.src.startsWith('/media/') || item.src.includes('..') || item.src.includes('\\') || !Array.isArray(item.questionIds) || !item.questionIds.length || !item.questionIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 600) || !Number.isInteger(item.durationMs) || item.durationMs <= 0 || item.durationMs > 86400000 || !Number.isInteger(item.gapAfterMs) || item.gapAfterMs < 0 || item.gapAfterMs > 3600000) throw new Error('听力音轨或间隔无效');
    total += item.durationMs + item.gapAfterMs;
    return { audioId: item.audioId, src: item.src, questionIds: [...new Set(item.questionIds)], durationMs: item.durationMs, gapAfterMs: item.gapAfterMs };
  });
  if (!Number.isInteger(plan.totalDurationMs) || plan.totalDurationMs !== total || total > 86400000) throw new Error('听力总时长与播放计划不符');
  return { version: 1, completionPolicy: 'audio_end', items, totalDurationMs: total };
}

/** Half-open audio/gap intervals avoid replaying a shared track at their boundaries. */
export function listeningPosition(plan, elapsedMs) {
  const elapsed = Math.max(0, Math.min(plan.totalDurationMs, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  let start = 0;
  for (let i = 0; i < plan.items.length; i++) {
    const item = plan.items[i], audioEnd = start + item.durationMs, gapEnd = audioEnd + item.gapAfterMs;
    if (elapsed < audioEnd) return { elapsedMs: elapsed, totalDurationMs: plan.totalDurationMs, itemIndex: i, phase: 'audio', audio: item.src, questionIds: [...item.questionIds], itemOffsetMs: elapsed - start, gapRemainingMs: 0 };
    if (elapsed < gapEnd) return { elapsedMs: elapsed, totalDurationMs: plan.totalDurationMs, itemIndex: i, phase: 'gap', audio: item.src, questionIds: [...item.questionIds], itemOffsetMs: item.durationMs, gapRemainingMs: gapEnd - elapsed };
    start = gapEnd;
  }
  return { elapsedMs: elapsed, totalDurationMs: plan.totalDurationMs, itemIndex: plan.items.length, phase: 'complete', audio: null, questionIds: [], itemOffsetMs: 0, gapRemainingMs: 0 };
}
