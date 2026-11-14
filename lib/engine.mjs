import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, randomInt } from 'node:crypto';
import { validateAudioPlan, listeningPosition } from './exam-timeline.mjs';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5'];
const MODES = ['practice', 'exam', 'wrong', 'favorites'];
const copy = value => structuredClone(value);
const requireValue = (condition, message, status = 400) => { if (!condition) throw new AppError(message, status); };
const text = value => typeof value === 'string' && value.length > 0 && value.length < 1000000;
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 600 && !['__proto__', 'constructor', 'prototype'].includes(value);
const blankState = () => ({ version: 1, sessions: {}, favorites: {}, wrong: {}, events: [] });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const percentage = (correct, total) => total ? Math.round(correct / total * 100) : 0;

export function atomicWrite(file, value) {
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(value), 'utf8'); fs.renameSync(tmp, file); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}

function validateQuestion(q, paperIds) {
  requireValue(object(q) && validId(q.id), '题目必须有有效的 id');
  requireValue(validId(q.paperId) && (!paperIds || paperIds.has(q.paperId)), `题目 ${q.id} 的试卷不存在`);
  requireValue(LEVELS.includes(q.level), `题目 ${q.id} 的等级无效`);
  requireValue(Number.isInteger(Number(q.type)) && Number(q.type) > 0, `题目 ${q.id} 的题型无效`);
  requireValue(typeof q.stem === 'string' && q.stem.length < 1000000, `题目 ${q.id} 的题干无效`);
  requireValue(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 8, `题目 ${q.id} 的选项数量无效`);
  const ids = new Set();
  for (const option of q.options) {
    requireValue(object(option) && validId(option.id) && typeof option.text === 'string' && option.text.length < 1000000, `题目 ${q.id} 的选项无效`);
    requireValue(!ids.has(option.id), `题目 ${q.id} 有重复选项`); ids.add(option.id);
  }
  requireValue(ids.has(q.answer), `题目 ${q.id} 的答案不属于选项`);
  requireValue(q.explanation === undefined || typeof q.explanation === 'string', `题目 ${q.id} 的解析无效`);
  if (q.images) requireValue(Array.isArray(q.images) && q.images.every(safeMedia), `题目 ${q.id} 的图片路径无效`);
  if (q.audio) requireValue(safeMedia(q.audio), `题目 ${q.id} 的音频路径无效`);
}

function safeMedia(value) {
  return typeof value === 'string' && value.length < 4000 && (value.startsWith('/media/') || /^https:\/\//.test(value));
}

export function validateBank(input) {
  requireValue(object(input) && Array.isArray(input.papers) && Array.isArray(input.questions), '题库格式应包含 papers 和 questions 数组');
  requireValue(input.papers.length <= 20000 && input.questions.length <= 300000, '题库超过允许大小');
  const papers = [], questions = [], paperIds = new Set(), qIds = new Set();
  for (const p of input.papers) {
    requireValue(object(p) && validId(p.id) && LEVELS.includes(p.level) && text(p.title), '试卷 id、名称或等级无效');
    requireValue(!paperIds.has(p.id), `试卷 id 重复：${p.id}`); paperIds.add(p.id);
    requireValue(p.durationSeconds === undefined || (Number.isFinite(p.durationSeconds) && p.durationSeconds > 0 && p.durationSeconds <= 86400), `试卷 ${p.id} 的时长无效`);
    requireValue(p.sections === undefined || (Array.isArray(p.sections) && p.sections.length <= 30), `试卷 ${p.id} 的科目无效`);
    const sectionIds = new Set();
    for (const section of p.sections || []) {
      requireValue(object(section) && validId(section.id) && text(section.title) && Number.isFinite(section.durationSeconds) && section.durationSeconds > 0 && section.durationSeconds <= 86400, `试卷 ${p.id} 的科目时长或名称无效`);
      requireValue(!sectionIds.has(section.id), `试卷 ${p.id} 的科目重复`); sectionIds.add(section.id);
      if (section.audioPlan !== undefined) {
        try { validateAudioPlan(section.audioPlan); } catch (e) { throw new AppError(`试卷 ${p.id}：${e.message}`); }
        requireValue(section.restBeforeSeconds === undefined || (Number.isInteger(section.restBeforeSeconds) && section.restBeforeSeconds >= 0 && section.restBeforeSeconds <= 3600), `试卷 ${p.id} 的休息时长无效`);
      }
    }
    papers.push(copy(p));
  }
  for (const q of input.questions) {
    if (q?.disabled === true || q?.available === false || q?.enabled === false) continue;
    validateQuestion(q, paperIds);
    requireValue(!qIds.has(q.id), `题目 id 重复：${q.id}`); qIds.add(q.id);
    const p = papers.find(p => p.id === q.paperId);
    requireValue(p.level === q.level, `题目 ${q.id} 的等级与试卷不符`);
    if (p.sections?.length) requireValue(p.sections.some(s => s.id === q.sectionId), `题目 ${q.id} 的科目不存在`);
    questions.push({ ...copy(q), type: Number(q.type), explanation: q.explanation || '', order: Number(q.order) || 0 });
  }
  const questionMap = new Map(questions.map(q => [q.id, q]));
  for (const paper of papers) for (const section of paper.sections || []) if (section.audioPlan) {
    section.audioPlan = validateAudioPlan(section.audioPlan);
    const covered = new Set();
    for (const item of section.audioPlan.items) for (const id of item.questionIds) {
      requireValue(questionMap.get(id)?.paperId === paper.id && questionMap.get(id)?.sectionId === section.id, `试卷 ${paper.id} 的听力计划引用了无效题目`);
      requireValue(!covered.has(id), `试卷 ${paper.id} 的听力计划重复引用题目`); covered.add(id);
    }
    requireValue(questions.filter(q => q.paperId === paper.id && q.sectionId === section.id).every(q => covered.has(q.id)), `试卷 ${paper.id} 的听力计划遗漏题目`);
  }
  return { papers, questions, ...(input.meta ? { meta: copy(input.meta) } : {}) };
}

function shuffled(list) {
  const output = [...list];
  for (let i = output.length - 1; i > 0; i--) { const j = randomInt(i + 1); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}

function category(type) {
  const n = Number(type);
  return n < 200 ? '文字词汇' : n < 300 ? '语法' : n < 400 ? '阅读' : '听力';
}

function localDay(timestamp) {
  return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10);
}

export class StudyEngine {
  constructor({ bankPath, statePath, bank, now = () => Date.now() } = {}) {
    this.bankPath = bankPath; this.statePath = statePath; this.now = now;
    const rawBank = bank || (bankPath && fs.existsSync(bankPath) ? JSON.parse(fs.readFileSync(bankPath, 'utf8')) : { papers: [], questions: [] });
    this.setBank(validateBank(rawBank));
    this.state = statePath && fs.existsSync(statePath) ? this.validateState(JSON.parse(fs.readFileSync(statePath, 'utf8'))) : blankState();
  }

  setBank(bank) {
    this.bank = bank;
    this.questions = new Map(bank.questions.map(q => [q.id, q]));
    this.papers = new Map(bank.papers.map(p => [p.id, p]));
    this.byPaper = new Map();
    for (const q of bank.questions) {
      if (!this.byPaper.has(q.paperId)) this.byPaper.set(q.paperId, []);
      this.byPaper.get(q.paperId).push(q);
    }
    for (const list of this.byPaper.values()) list.sort((a, b) => a.order - b.order || String(a.number).localeCompare(String(b.number), 'en', { numeric: true }));
  }

  persist() { atomicWrite(this.statePath, this.state); }

  validateState(input) {
    requireValue(object(input) && input.version === 1 && object(input.sessions) && object(input.favorites) && object(input.wrong) && Array.isArray(input.events), '学习备份格式不正确');
    requireValue(Object.keys(input.sessions).length <= 10000 && input.events.length <= 2000000, '学习备份过大');
    for (const [id, s] of Object.entries(input.sessions)) {
      requireValue(validId(id) && object(s) && s.id === id && MODES.includes(s.mode) && LEVELS.includes(s.level) && ['active', 'finished'].includes(s.status), '学习记录无效');
      requireValue(Array.isArray(s.questions) && s.questions.length > 0 && s.questions.length <= 30000 && object(s.answers) && object(s.feedback) && Array.isArray(s.flags) && Array.isArray(s.sections), '学习记录题目无效');
      requireValue(Number.isFinite(s.createdAt) && Number.isFinite(s.updatedAt) && Number.isInteger(s.currentIndex) && s.currentIndex >= 0 && s.currentIndex < s.questions.length, '学习记录时间或进度无效');
      const ids = new Set();
      for (const q of s.questions) { validateQuestion(q); requireValue(!ids.has(q.id), '学习记录题目重复'); ids.add(q.id); }
      for (const [qid, choice] of Object.entries(s.answers)) requireValue(s.questions.some(q => q.id === qid && q.options.some(o => o.id === choice)), '学习记录选项无效');
      requireValue(s.flags.every(qid => ids.has(qid)), '学习记录标记无效');
      requireValue(Number.isFinite(s.lastAnsweredAt), '学习记录作答时间无效');
      for (const [qid, feedback] of Object.entries(s.feedback)) {
        const q = s.questions.find(q => q.id === qid);
        requireValue(q && own(s.answers, qid) && object(feedback) && feedback.answer === q.answer && feedback.correct === (s.answers[qid] === q.answer) && typeof feedback.explanation === 'string', '学习记录答题反馈无效');
      }
      if (s.status === 'finished') {
        requireValue(object(s.result) && Number.isFinite(s.finishedAt) && s.result.total === s.questions.length && ['correct', 'wrong', 'unanswered'].every(key => Number.isInteger(s.result[key]) && s.result[key] >= 0) && s.result.correct + s.result.wrong + s.result.unanswered === s.result.total && Array.isArray(s.result.questions) && s.result.questions.length === s.questions.length && Array.isArray(s.result.sections), '学习记录成绩无效');
      }
      if (s.mode === 'exam') {
        requireValue(s.sections.length > 0 && Number.isInteger(s.activeSectionIndex) && s.activeSectionIndex >= 0 && s.activeSectionIndex < s.sections.length && Number.isFinite(s.sectionDeadline), '考试计时备份无效');
        for (const section of s.sections) {
          requireValue(validId(section.id) && Number.isFinite(section.durationSeconds) && section.durationSeconds > 0, '考试科目备份无效');
          if (section.audioPlan) { try { validateAudioPlan(section.audioPlan); } catch { throw new AppError('考试听力计划备份无效'); } }
        }
        requireValue(s.phase === undefined || ['break', 'section'].includes(s.phase), '考试阶段备份无效');
        if (s.phase === 'break') requireValue(Number.isFinite(s.breakDeadline) && !!s.sections[s.activeSectionIndex].audioPlan, '考试休息计时备份无效');
        if (s.listeningPausedAt !== undefined) {
          const section = s.sections[s.activeSectionIndex];
          requireValue(s.status === 'active' && s.phase !== 'break' && !!section.audioPlan && Number.isFinite(section.startedAt) && Number.isFinite(s.listeningPausedAt) && s.listeningPausedAt >= section.startedAt && s.listeningPausedAt < s.sectionDeadline, '考试听力暂停备份无效');
        }
        if (s.focusPausedAt !== undefined) requireValue(s.status === 'active' && Number.isFinite(s.focusPausedAt) && s.focusPausedAt >= s.createdAt && ['fullscreen','hidden','blur','navigation','refresh'].includes(s.focusPauseReason), '考试全屏暂停记录无效');
      }
    }
    for (const [qid, entry] of Object.entries(input.wrong)) requireValue(validId(qid) && object(entry) && Number.isInteger(entry.wrongCount) && entry.wrongCount > 0 && Number.isFinite(entry.lastWrongAt), '错题记录无效');
    for (const [qid, timestamp] of Object.entries(input.favorites)) requireValue(validId(qid) && Number.isFinite(timestamp), '收藏记录无效');
    for (const e of input.events) requireValue(object(e) && validId(e.questionId) && validId(e.sessionId) && LEVELS.includes(e.level) && typeof e.correct === 'boolean' && Number.isFinite(e.time) && Number.isFinite(e.durationSeconds) && e.durationSeconds >= 0, '答题记录无效');
    return copy(input);
  }

  paperView(paper) {
    const qs = this.byPaper.get(paper.id) || [];
    return { ...copy(paper), questionCount: qs.length, durationSeconds: paper.durationSeconds || (paper.sections || []).reduce((sum, section) => sum + section.durationSeconds, 0) || 3600,
      sections: (paper.sections || []).map(section => ({ ...copy(section), questionCount: qs.filter(q => q.sectionId === section.id).length })) };
  }

  catalog(level = 'N2') {
    requireValue(LEVELS.includes(level), '等级无效');
    for (const s of Object.values(this.state.sessions)) this.syncTime(s);
    const qs = this.bank.questions.filter(q => q.level === level), types = new Map();
    for (const q of qs) {
      if (!types.has(q.type)) types.set(q.type, { id: q.type, title: q.typeTitle || `题型 ${q.type}`, count: 0, category: category(q.type) });
      types.get(q.type).count++;
    }
    const events = this.state.events.filter(e => e.level === level), correct = events.filter(e => e.correct).length;
    return {
      levels: LEVELS, papers: this.bank.papers.filter(p => p.level === level).map(p => this.paperView(p)).filter(p => p.questionCount > 0),
      types: [...types.values()].sort((a, b) => a.id - b.id),
      stats: { answered: events.length, correct, accuracy: percentage(correct, events.length),
        wrong: Object.entries(this.state.wrong).filter(([id, w]) => !w.resolved && this.questions.get(id)?.level === level).length,
        favorites: Object.keys(this.state.favorites).filter(id => this.questions.get(id)?.level === level).length,
        studySeconds: Math.round(events.reduce((sum, e) => sum + e.durationSeconds, 0)),
        todayAnswered: events.filter(e => localDay(e.time) === localDay(this.now())).length,
        totalQuestions: qs.length },
      active: Object.values(this.state.sessions).filter(s => s.level === level && s.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt).map(s => this.summary(s)),
      ...(this.bank.meta ? { meta: copy(this.bank.meta) } : {})
    };
  }

  summary(s) {
    const now = s.finishedAt || this.now();
    return { id: s.id, title: s.title, mode: s.mode, level: s.level, status: s.status, answered: Object.keys(s.answers).length, total: s.questions.length, createdAt: s.createdAt, updatedAt: s.updatedAt,
      elapsedSeconds: Math.max(0, Math.floor((now - s.createdAt) / 1000)), ...(s.result ? { accuracy: s.result.accuracy, correct: s.result.correct, wrong: s.result.wrong, unanswered: s.result.unanswered } : {}) };
  }

  createSession(input) {
    requireValue(object(input) && MODES.includes(input.mode), '练习模式无效');
    const { mode, level = 'N2', paperId } = input;
    requireValue(LEVELS.includes(level), '等级无效');
    let qs = this.bank.questions.filter(q => q.level === level);
    const paper = paperId ? this.papers.get(paperId) : null;
    if (paperId) requireValue(paper && paper.level === level, '试卷不存在', 404);
    if (paperId) qs = qs.filter(q => q.paperId === paperId);
    if (input.questionIds !== undefined && mode !== 'exam') {
      requireValue(Array.isArray(input.questionIds) && input.questionIds.length > 0 && input.questionIds.length <= 5000 && input.questionIds.every(id => validId(id) && this.questions.has(id)), '指定的题目不存在');
      const selected = new Set(input.questionIds); qs = qs.filter(q => selected.has(q.id));
    }
    if (input.type && input.type !== 'all') qs = qs.filter(q => q.type === Number(input.type));
    if (mode === 'wrong') qs = qs.filter(q => this.state.wrong[q.id] && !this.state.wrong[q.id].resolved);
    if (mode === 'favorites') qs = qs.filter(q => own(this.state.favorites, q.id));
    if (mode === 'exam') {
      requireValue(paper, '请选择模考试卷');
      requireValue(paper.mockEnabled !== false, '此试卷尚未具备完整模考条件');
      qs = [...(this.byPaper.get(paper.id) || [])];
    } else {
      const all = input.count === 'all';
      const count = all ? qs.length : input.count === undefined ? 20 : Number(input.count);
      requireValue(all || (Number.isInteger(count) && count > 0 && count <= 5000), '题数应为 1 至 5000，或选择全部');
      requireValue(!input.order || ['random', 'sequential'].includes(input.order), '出题顺序无效');
      qs = input.order === 'sequential' ? [...qs].sort((a, b) => a.paperId.localeCompare(b.paperId) || a.order - b.order) : shuffled(qs);
      if (!all) qs = qs.slice(0, count);
    }
    requireValue(qs.length > 0, '当前条件下没有可练习的题目', 400);
    const now = this.now(), id = randomUUID();
    const title = mode === 'exam' ? paper.title : `${level} ${mode === 'wrong' ? '错题复习' : mode === 'favorites' ? '收藏练习' : input.type && input.type !== 'all' ? (qs[0].typeTitle || '专项练习') : '综合练习'}`;
    const s = { id, mode, level, title, status: 'active', questions: copy(qs), answers: {}, feedback: {}, flags: [], currentIndex: 0, createdAt: now, updatedAt: now, lastAnsweredAt: now, sections: [], phase: 'section' };
    if (mode === 'exam') {
      s.sections = (paper.sections?.length ? paper.sections : [{ id: 'all', title: '全部科目', durationSeconds: paper.durationSeconds || 3600 }]).filter(sec => !paper.sections?.length || qs.some(q => q.sectionId === sec.id)).map(sec => ({ id: sec.id, title: sec.title, durationSeconds: sec.durationSeconds, questionCount: qs.filter(q => !paper.sections?.length || q.sectionId === sec.id).length, status: 'pending', ...(sec.audioPlan ? { audioPlan: copy(sec.audioPlan), restBeforeSeconds: sec.restBeforeSeconds || 0 } : {}) }));
      if (!paper.sections?.length) s.questions.forEach(q => { q.sectionId = 'all'; q.sectionTitle = '全部科目'; });
      requireValue(s.sections.length > 0, '试卷没有可用科目');
      this.beginSection(s, 0, now);
    }
    this.state.sessions[id] = s; this.persist();
    return this.sessionView(s);
  }

  findSession(id) { requireValue(own(this.state.sessions, id), '练习记录不存在', 404); return this.state.sessions[id]; }

  safeQuestion(q) {
    const out = {};
    for (const key of ['id', 'paperId', 'paperTitle', 'level', 'number', 'order', 'type', 'typeTitle', 'sectionId', 'sectionTitle', 'stem', 'passage', 'options', 'images', 'audio', 'groupId', 'mediaMissing', 'instruction', 'ruby', 'audioStart', 'audioEnd', 'stemDocument', 'passageDocument', 'translation']) if (q[key] !== undefined) out[key] = copy(q[key]);
    const sourceWarning = q.sourceWarning || this.questions.get(q.id)?.sourceWarning;
    if (sourceWarning) out.sourceWarning = sourceWarning;
    out.favorite = own(this.state.favorites, q.id); return out;
  }

  sessionView(s) {
    const out = { ...this.summary(s), questions: s.questions.map(q => this.safeQuestion(q)), answers: copy(s.answers), feedback: s.mode === 'exam' ? {} : copy(s.feedback), flags: [...s.flags], currentIndex: s.currentIndex, sections: copy(s.sections), phase: s.phase || 'section', serverNow: this.now() };
    if (s.mode === 'exam') {
      Object.assign(out, { activeSectionIndex: s.activeSectionIndex, sectionDeadline: s.sectionDeadline, deadline: s.sectionDeadline, listening: null });
      out.focus = { paused: Number.isFinite(s.focusPausedAt), pausedAt: s.focusPausedAt ?? null, reason: s.focusPauseReason ?? null, interruptions: s.focusInterruptions || 0, remainingMs: Math.max(0, s.sectionDeadline - (s.listeningPausedAt ?? s.focusPausedAt ?? this.now())) };
      if (s.phase === 'break') out.breakDeadline = s.breakDeadline;
      const section = s.sections[s.activeSectionIndex];
      if (section.audioPlan && Number.isFinite(section.startedAt) && s.phase !== 'break') out.listening = { startedAt: section.startedAt, ...listeningPosition(section.audioPlan, (s.listeningPausedAt ?? s.finishedAt ?? this.now()) - section.startedAt), paused: Number.isFinite(s.listeningPausedAt), pausedAt: s.listeningPausedAt ?? null };
    }
    if (s.status === 'finished') out.result = copy(s.result);
    return out;
  }

  getSession(id) { const s = this.findSession(id); this.syncTime(s); return this.sessionView(s); }

  syncTime(s) {
    if (s.mode !== 'exam' || s.status !== 'active' || Number.isFinite(s.listeningPausedAt) || Number.isFinite(s.focusPausedAt)) return;
    let changed = false;
    while (s.status === 'active' && this.now() >= s.sectionDeadline) {
      if (s.phase === 'break') this.startSectionListening(s, s.breakDeadline);
      else this.advanceSection(s, s.sectionDeadline);
      changed = true;
    }
    if (changed) this.persist();
  }

  beginSection(s, index, at) {
    delete s.listeningPausedAt;
    s.activeSectionIndex = index;
    const section = s.sections[index]; section.status = 'active';
    s.currentIndex = Math.max(0, s.questions.findIndex(q => q.sectionId === section.id)); s.updatedAt = at;
    if (section.audioPlan && section.restBeforeSeconds > 0) {
      s.phase = 'break'; section.restStartedAt = at; delete section.startedAt;
      s.breakDeadline = at + section.restBeforeSeconds * 1000; s.sectionDeadline = s.breakDeadline;
    } else if (section.audioPlan) this.startSectionListening(s, at);
    else {
      s.phase = 'section'; delete s.breakDeadline; section.startedAt = at;
      s.sectionDeadline = at + section.durationSeconds * 1000;
    }
  }

  startSectionListening(s, at) {
    const section = s.sections[s.activeSectionIndex];
    section.startedAt = at; s.phase = 'section'; delete s.breakDeadline; delete s.listeningPausedAt;
    s.sectionDeadline = at + section.audioPlan.totalDurationMs; s.updatedAt = at;
  }

  startListening(id) {
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.mode === 'exam', '当前没有正在进行的考试');
    if (s.status === 'finished') return this.sessionView(s);
    requireValue(!Number.isFinite(s.focusPausedAt), '请先恢复全屏考试', 409);
    requireValue(!!s.sections[s.activeSectionIndex].audioPlan, '当前科目没有连续听力播放计划', 409);
    if (s.phase === 'break') { this.startSectionListening(s, this.now()); this.persist(); }
    return this.sessionView(s);
  }

  pauseListening(id) {
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.mode === 'exam', '当前没有正在进行的考试', 409);
    if (s.status === 'finished') return this.sessionView(s);
    const section = s.sections[s.activeSectionIndex];
    requireValue(!!section.audioPlan && s.phase !== 'break' && Number.isFinite(section.startedAt), '当前没有正在播放的模考听力', 409);
    if (!Number.isFinite(s.listeningPausedAt)) { s.listeningPausedAt = this.now(); s.updatedAt = s.listeningPausedAt; this.persist(); }
    return this.sessionView(s);
  }

  shiftPausedListening(s, at) {
    if (!Number.isFinite(s.listeningPausedAt)) return false;
    const pausedMs = Math.max(0, at - s.listeningPausedAt);
    s.sections[s.activeSectionIndex].startedAt += pausedMs;
    s.sectionDeadline += pausedMs;
    s.lastAnsweredAt = at;
    delete s.listeningPausedAt;
    return true;
  }

  resumeListening(id) {
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.mode === 'exam', '当前没有正在进行的考试', 409);
    if (s.status === 'finished') return this.sessionView(s);
    requireValue(!Number.isFinite(s.focusPausedAt), '请先恢复全屏考试', 409);
    const section = s.sections[s.activeSectionIndex];
    requireValue(!!section.audioPlan && s.phase !== 'break' && Number.isFinite(section.startedAt), '当前没有可以继续的模考听力', 409);
    if (this.shiftPausedListening(s, this.now())) { s.updatedAt = this.now(); this.persist(); }
    return this.sessionView(s);
  }

  pauseExamFocus(id, input = {}) {
    requireValue(object(input), '全屏暂停格式无效');
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.mode === 'exam', '当前没有正在进行的考试', 409);
    if (s.status === 'finished') return this.sessionView(s);
    const reason = input.reason || 'fullscreen';
    requireValue(['fullscreen','hidden','blur','navigation','refresh'].includes(reason), '全屏暂停原因无效');
    if (!Number.isFinite(s.focusPausedAt)) {
      const now = this.now(), section = s.sections[s.activeSectionIndex];
      s.focusPausedAt = now; s.focusPauseReason = reason; s.focusInterruptions = (s.focusInterruptions || 0) + 1;
      s.focusPausedListening = !!section.audioPlan && s.phase !== 'break' && !Number.isFinite(s.listeningPausedAt);
      if (s.focusPausedListening) s.listeningPausedAt = now;
      s.updatedAt = now; this.persist();
    }
    return this.sessionView(s);
  }

  shiftFocusPause(s, at) {
    if (!Number.isFinite(s.focusPausedAt)) return false;
    const duration = Math.max(0, at - s.focusPausedAt), section = s.sections[s.activeSectionIndex];
    if (section.audioPlan && s.phase !== 'break') {
      if (s.focusPausedListening) this.shiftPausedListening(s, at);
    } else {
      s.sectionDeadline += duration;
      if (s.phase === 'break') { s.breakDeadline += duration; if (Number.isFinite(section.restStartedAt)) section.restStartedAt += duration; }
      else section.startedAt += duration;
    }
    delete s.focusPausedAt; delete s.focusPauseReason; delete s.focusPausedListening;
    s.lastAnsweredAt = at; return true;
  }

  resumeExamFocus(id) {
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.mode === 'exam', '当前没有正在进行的考试', 409);
    if (s.status === 'finished') return this.sessionView(s);
    if (this.shiftFocusPause(s, this.now())) { s.updatedAt = this.now(); this.persist(); }
    return this.sessionView(s);
  }

  advanceSection(s, at) {
    s.sections[s.activeSectionIndex].status = 'finished'; s.sections[s.activeSectionIndex].finishedAt = at;
    if (s.activeSectionIndex === s.sections.length - 1) { this.finalize(s, at); return; }
    this.beginSection(s, s.activeSectionIndex + 1, at);
  }

  nextSection(id) {
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.mode === 'exam' && s.status === 'active', '当前没有正在进行的考试');
    requireValue(!Number.isFinite(s.focusPausedAt), '请先恢复全屏考试', 409);
    requireValue(s.phase !== 'break', '请先开始听力部分', 409);
    requireValue(!Number.isFinite(s.listeningPausedAt), '听力已暂停，请先继续考试', 409);
    this.advanceSection(s, this.now()); this.persist(); return this.sessionView(s);
  }

  recordAttempt(s, q, chosen, at, durationSeconds = 0) {
    const correct = q.answer === chosen;
    this.state.events.push({ questionId: q.id, sessionId: s.id, level: s.level, correct, time: at, durationSeconds });
    if (!correct) {
      const before = this.state.wrong[q.id];
      this.state.wrong[q.id] = { wrongCount: (before?.wrongCount || 0) + 1, lastWrongAt: at, resolved: false, lastChosen: chosen };
    } else if (this.state.wrong[q.id]) this.state.wrong[q.id].resolved = true;
    return { correct, answer: q.answer, explanation: q.explanation || '' };
  }

  answer(id, input) {
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.status === 'active', '本次练习已结束', 409);
    requireValue(!Number.isFinite(s.focusPausedAt), '请先恢复全屏考试', 409);
    requireValue(object(input), '作答格式无效');
    const q = s.questions.find(q => q.id === input.questionId);
    requireValue(q, '题目不属于本次练习', 404);
    requireValue(q.options.some(o => o.id === input.optionId), '所选答案不属于该题');
    requireValue(s.phase !== 'break', '休息中不能作答，请先开始听力部分', 409);
    requireValue(!Number.isFinite(s.listeningPausedAt), '听力已暂停，请先继续考试', 409);
    if (s.mode === 'exam') requireValue(q.sectionId === s.sections[s.activeSectionIndex].id, '只能作答当前科目，已结束科目不能修改', 409);
    if (s.mode !== 'exam' && own(s.answers, q.id)) {
      requireValue(s.answers[q.id] === input.optionId, '本题已作答，请进入下一题', 409);
      return copy(s.feedback[q.id]);
    }
    const now = this.now(); s.answers[q.id] = input.optionId; s.updatedAt = now;
    const duration = Math.min(300, Math.max(0, (now - s.lastAnsweredAt) / 1000)); s.lastAnsweredAt = now;
    if (s.mode !== 'exam') s.feedback[q.id] = this.recordAttempt(s, q, input.optionId, now, duration);
    this.persist(); return s.mode === 'exam' ? { saved: true } : copy(s.feedback[q.id]);
  }

  checkpoint(id, input) {
    const s = this.findSession(id); this.syncTime(s);
    requireValue(s.status === 'active', '本次练习已结束', 409);
    requireValue(object(input), '进度格式无效');
    if (input.currentIndex !== undefined) {
      requireValue(Number.isInteger(input.currentIndex) && input.currentIndex >= 0 && input.currentIndex < s.questions.length, '题号无效');
      requireValue(s.phase !== 'break' || input.currentIndex === s.currentIndex, '休息中不能切换题目', 409);
      if (s.mode === 'exam') requireValue(s.questions[input.currentIndex].sectionId === s.sections[s.activeSectionIndex].id, '只能查看当前科目', 409);
      s.currentIndex = input.currentIndex;
    }
    if (input.flags !== undefined) {
      requireValue(Array.isArray(input.flags) && input.flags.length <= s.questions.length && input.flags.every(id => s.questions.some(q => q.id === id)), '标记题目无效');
      s.flags = [...new Set(input.flags)];
    }
    s.updatedAt = this.now(); this.persist(); return { saved: true };
  }

  finalize(s, at) {
    if (s.status === 'finished') return;
    this.shiftFocusPause(s, at);
    this.shiftPausedListening(s, at);
    s.status = 'finished'; s.finishedAt = at; s.updatedAt = at;
    const elapsedSeconds = Math.max(0, Math.floor((at - s.createdAt) / 1000));
    if (s.mode === 'exam') {
      const answered = s.questions.filter(q => own(s.answers, q.id));
      for (const q of answered) this.recordAttempt(s, q, s.answers[q.id], at, elapsedSeconds / Math.max(1, answered.length));
      for (const section of s.sections) if (section.status === 'active') { section.status = 'finished'; section.finishedAt = at; }
    }
    const questions = s.questions.map(q => ({ ...this.safeQuestion(q), answer: q.answer, chosen: s.answers[q.id] || null, correct: s.answers[q.id] === q.answer, explanation: q.explanation || '' }));
    const correct = questions.filter(q => q.correct).length, unanswered = questions.filter(q => !q.chosen).length;
    const sectionIds = [...new Set(questions.map(q => q.sectionId || 'all'))];
    s.result = { total: questions.length, correct, wrong: questions.length - correct - unanswered, unanswered, accuracy: percentage(correct, questions.length), elapsedSeconds,
      sections: sectionIds.map(id => { const sq = questions.filter(q => (q.sectionId || 'all') === id); return { id, title: sq[0]?.sectionTitle || '全部题目', total: sq.length, correct: sq.filter(q => q.correct).length }; }), questions };
  }

  finish(id) { const s = this.findSession(id); this.syncTime(s); this.finalize(s, this.now()); this.persist(); return copy(s.result); }

  favorite(id) {
    requireValue(this.questions.has(id), '题目不存在', 404);
    if (own(this.state.favorites, id)) delete this.state.favorites[id]; else this.state.favorites[id] = this.now();
    this.persist(); return { favorite: own(this.state.favorites, id) };
  }

  review(kind = 'wrong', level = 'N2') {
    requireValue(['wrong', 'favorites'].includes(kind) && LEVELS.includes(level), '复习条件无效');
    const ids = kind === 'wrong' ? Object.keys(this.state.wrong).filter(id => !this.state.wrong[id].resolved) : Object.keys(this.state.favorites);
    const rows = ids.map(id => this.questions.get(id)).filter(q => q?.level === level);
    rows.sort((a, b) => (kind === 'wrong' ? this.state.wrong[b.id].lastWrongAt - this.state.wrong[a.id].lastWrongAt : this.state.favorites[b.id] - this.state.favorites[a.id]));
    return { items: rows.map(q => ({ ...this.safeQuestion(q), answer: q.answer, explanation: q.explanation, ...(this.state.wrong[q.id] ? { wrongCount: this.state.wrong[q.id].wrongCount, lastChosen: this.state.wrong[q.id].lastChosen } : {}) })) };
  }

  history(level = 'N2') {
    requireValue(LEVELS.includes(level), '等级无效');
    for (const s of Object.values(this.state.sessions)) this.syncTime(s);
    return { items: Object.values(this.state.sessions).filter(s => s.level === level).sort((a, b) => b.updatedAt - a.updatedAt).map(s => this.summary(s)) };
  }

  exportState() { return { app: 'jlpt-desk', exportedAt: this.now(), ...copy(this.state) }; }
  resetProgress(input) {
    requireValue(object(input) && input.confirmation === 'reset-all-progress', '请先确认重置所有学习进度');
    const next = blankState();
    atomicWrite(this.statePath, next);
    this.state = next;
    return { reset: true, message: '所有学习进度已重置，可以重新开始学习。' };
  }
  restore(input) { const next = this.validateState(input); this.state = next; this.persist(); return { restored: true, sessions: Object.keys(next.sessions).length }; }

  importBank(input) {
    const incoming = validateBank(input);
    requireValue(incoming.questions.length > 0, '导入题库没有可用题目');
    const papers = new Map(this.bank.papers.map(p => [p.id, p])); incoming.papers.forEach(p => papers.set(p.id, p));
    const questions = new Map(this.bank.questions.map(q => [q.id, q])); incoming.questions.forEach(q => questions.set(q.id, q));
    const bank = validateBank({ papers: [...papers.values()], questions: [...questions.values()], meta: this.bank.meta });
    atomicWrite(this.bankPath, bank); this.setBank(bank);
    return { imported: incoming.questions.length, questionCount: incoming.questions.length, papers: incoming.papers.length, totalQuestions: bank.questions.length, message: `已导入 ${incoming.questions.length} 道题目，题库共 ${bank.questions.length} 道题。` };
  }
}
