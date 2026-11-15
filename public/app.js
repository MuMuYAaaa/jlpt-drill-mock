'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book:'<path d="M12 5.5C9 3.5 5 3.5 3 4v15c3-.7 6-.5 9 1.5C15 18.5 18 18.3 21 19V4c-2-.5-6-.5-9 1.5z"/><path d="M12 5.5v15"/>',
  pen:'<path d="m15 4 5 5M4 20l4.8-1L21 6.8 17.2 3 5 15.2 4 20z"/><path d="M13 20h8"/>',
  paper:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  wrong:'<path d="M5 3h14v18l-7-4-7 4z"/><path d="m9 7 6 6m0-6-6 6"/>',
  star:'<path d="m12 3 2.8 5.7L21 9.6l-4.5 4.3 1.1 6.1-5.6-2.9L6.4 20l1.1-6.1L3 9.6l6.2-.9z"/>',
  history:'<path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2"/>',
  data:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  left:'<path d="m15 5-7 7 7 7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  circlecheck:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  flag:'<path d="M5 21V3m0 1c5-3 9 3 14 0v11c-5 3-9-3-14 0"/>',
  headphones:'<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13h2v7H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm16 0h-2v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z"/>',
  language:'<path d="M4 5h12M10 3v2M6 5c1 6 4 8 9 11M14 5c-1 6-5 10-10 12m10 4 4-10 4 10m-6.5-3h5"/>',
  chart:'<path d="M4 3v18h17M8 16V9m5 7V5m5 11v-5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 7h.01"/>',
  moon:'<path d="M21 13a8.7 8.7 0 0 1-10-10A9 9 0 1 0 21 13z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  play:'<path d="m8 4 13 8-13 8z"/>',
  resume:'<path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7"/><path d="m10 8 6 4-6 4z"/>',
  spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
const navigation = [
  ['dashboard','学习概览','grid'],['practice','专项刷题','pen'],['exam','模拟考试','paper'],['wrong','错题本','wrong'],['favorites','收藏夹','star'],['history','练习记录','history'],['data','题库与备份','data'],
];
const categories = [
  {id:1,title:'文字词汇',english:'VOCABULARY',icon:'language',note:'从每一个词，积累语感'},
  {id:2,title:'语法',english:'GRAMMAR',icon:'pen',note:'把理解，变成自然表达'},
  {id:3,title:'阅读',english:'READING',icon:'book',note:'读懂文字，也读懂意图'},
  {id:4,title:'听力',english:'LISTENING',icon:'headphones',note:'在声音里，找到关键信息'},
];
const defaultTypes = {101:'汉字读法',102:'汉字表记',103:'词语构成',104:'前后关系',105:'近义替换',106:'用法',201:'语法形式',202:'句子组织',203:'文章语法',301:'内容理解（短篇）',302:'内容理解（中篇）',303:'内容理解（长篇）',304:'综合理解',305:'主张理解',306:'信息检索',401:'课题理解',402:'要点理解',403:'概要理解',404:'即时应答',405:'综合理解',406:'发话表达'};
const state = {level:localStorage.getItem('jlpt-level') || 'N2',page:'dashboard',catalog:null,session:null,result:null,history:[],review:[],reviewQuery:'',reviewPage:0,practiceCategory:0,paperYear:'all',busy:false,feedback:{},selectedCount:20,selectedOrder:'random',reviewResultFilter:'all',showReadings:false,routeGeneration:0};
let timerBusy = false;
let loadedSessionAt = Date.now();
let audioPauseBusy=false;
let examAudioNotice='';
const examAudio=new ExamAudioPlayer({onState:paintExamAudio,onComplete:()=>{if(!timerBusy){timerBusy=true;refreshSession().catch(e=>toast(e.message,true)).finally(()=>timerBusy=false);}},onError:message=>pauseExamAudio(message),onBlocked:()=>pauseExamAudio('浏览器需要你点击继续，听力考试已暂停。')});
const examFocus=new ExamFocusController({
 onFreeze:()=>{examAudio.focusPaused=true;examAudio.paused=true;examAudio.audio.pause();$('#modal').close();},
 onInterrupt:async(id,reason)=>{const s=await api(`/api/sessions/${encodeURIComponent(id)}/pause-focus`,{reason});if(state.page==='session'&&state.session?.id===id){state.session=s;loadedSessionAt=Date.now();renderSession();}},
 onResume:id=>api(`/api/sessions/${encodeURIComponent(id)}/resume-focus`,{}),
 onRestored:s=>{if(state.session?.id!==s.id)return;state.session=s;loadedSessionAt=Date.now();examAudio.focusPaused=false;if(!s.listening?.paused)examAudio.retry();renderSession();}
});

function integer(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : fallback; }
function fmt(value) { return integer(value).toLocaleString('zh-CN'); }
function pct(value) { const n = Number(value || 0); return Number.isFinite(n) ? Math.round(n) : 0; }
function minutes(seconds) { return Math.max(1,Math.round(Number(seconds || 0)/60)); }
function duration(seconds) { const s = Math.max(0,integer(seconds)); return s >= 3600 ? `${Math.floor(s/3600)} 小时 ${Math.floor(s%3600/60)} 分` : `${Math.floor(s/60)} 分 ${s%60} 秒`; }
function timerText(seconds) { const s = Math.max(0,Math.ceil(seconds)); return `${s>=3600?`${String(Math.floor(s/3600)).padStart(2,'0')}:`:''}${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function dateText(value) { const d = new Date(value); return isNaN(d) ? '—' : d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}); }
function modeTitle(mode) { return ({exam:'模拟考试',practice:'专项练习',wrong:'错题复习',favorites:'收藏练习'})[mode] || '练习'; }
function typeTitle(q) { return q.typeTitle || defaultTypes[q.type] || '综合练习'; }
function safeURL(value) { const s = String(value || ''); return /^(https?:\/\/|\/(?!\/))/.test(s) ? esc(s) : ''; }

async function api(path, body) {
  const response = await fetch(path,{method:body === undefined ? 'GET' : 'POST',headers:body === undefined ? {} : {'Content-Type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body)});
  let result;
  try { result = await response.json(); } catch { throw new Error('服务返回了无法读取的数据，请重新启动学习空间后重试。'); }
  if (!response.ok || result.error) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || result.message || `操作未完成（${response.status}）`);
  return result;
}
function toast(message,error = false) { const el = document.createElement('div'); el.className = `toast${error?' error':''}`; el.textContent = message; $('#toast-region').append(el); setTimeout(() => el.remove(),error?6500:3300); }
function setSaved(message = '已自动保存') { $('#save-status').textContent = message; }
function empty(title,text,action = '',compact = false,ico = 'book') { return `<div class="empty${compact?' compact':''}"><span class="empty-icon">${icon(ico,compact?18:24)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`; }
function heading(eyebrow,title,description,right = '') { return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${description?`<p>${esc(description)}</p>`:''}</div>${right}</div>`; }
function info(text) { return `<div class="info-note">${icon('info',16)}<span>${esc(text)}</span></div>`; }
function categoryCount(id) { return (state.catalog?.types || []).filter(t => Math.floor(Number(t.id)/100) === id).reduce((n,t) => n+Number(t.count || 0),0); }
function currentQuestion() { return state.session?.questions?.[state.session.currentIndex || 0]; }
function currentSection(s = state.session) { return s?.sections?.[s.activeSectionIndex || 0]; }
function answerMatches(a,b) { return a != null && b != null && String(a) === String(b); }

// Only supported document nodes are rendered; all text is escaped before display.
function renderDocument(doc, readings = false, depth = 0) {
  if (!doc || depth > 16) return '';
  if (typeof doc === 'string') return esc(doc);
  if (Array.isArray(doc)) return doc.map(n => renderDocument(n,readings,depth+1)).join('');
  if (doc.blocks) return renderDocument(doc.blocks,readings,depth+1);
  const type = doc.type || '';
  if (type === 'image') {
    const url = safeURL(doc.src || doc.url || doc.path || doc.mediaUrl);
    return url ? `<figure class="document-figure"><img class="question-image" src="${url}" alt="${esc(doc.alt || '题目图片')}" loading="lazy"><div class="image-fallback" hidden><p>图片暂时无法加载，请检查网络后重试。</p>${doc.text_document?renderDocument(doc.text_document,readings,depth+1):''}</div></figure>` : '';
  }
  if (type === 'table') {
    const rows = doc.rows || doc.children || [];
    return `<div class="document-table"><table>${rows.map(row => `<tr>${(Array.isArray(row)?row:row.cells || row.children || []).map(cell => `<td rowspan="${Math.min(100,Math.max(1,integer(cell.row_span,1)))}" colspan="${Math.min(100,Math.max(1,integer(cell.column_span,1)))}">${renderDocument(cell,readings,depth+1)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  if (doc.spans) {
    const content = doc.spans.map(span => {
      let text = esc(span.text ?? '');
      const marks = span.marks || [];
      if (readings && span.reading) text = `<ruby>${text}<rt>${esc(span.reading)}</rt></ruby>`;
      if (marks.includes('underline')) text = `<u>${text}</u>`;
      if (marks.includes('bold')) text = `<strong>${text}</strong>`;
      if (marks.includes('italic')) text = `<em>${text}</em>`;
      return text;
    }).join('');
    return type === 'paragraph' ? `<div class="document-paragraph">${content || '<br>'}</div>` : content;
  }
  if (doc.children || doc.content) return renderDocument(doc.children || doc.content,readings,depth+1);
  if (doc.cells) return renderDocument(doc.cells,readings,depth+1);
  if (doc.text != null) return esc(doc.text);
  return '';
}
function stemHTML(q,readings = false) { return renderDocument(q.stemDocument,readings) || esc(q.stem || '请根据题目内容选择正确答案。'); }
function optionHTML(o,readings = false) { return renderDocument(o.document,readings) || esc(o.text || ''); }
function passageHTML(q,readings = false) { const content = renderDocument(q.passageDocument,readings) || esc(q.passage || ''); return content ? `<div class="passage">${content}</div>` : ''; }
function extraImagesHTML(q,readings = false) { const docs = stemHTML(q,readings)+passageHTML(q,readings);return (q.images || []).filter(url=>safeURL(url)&&!docs.includes(`src="${safeURL(url)}"`)).map(url=>`<img class="question-image" src="${safeURL(url)}" alt="题目配图" loading="lazy">`).join(''); }
function plainDocument(doc) { if (!doc) return ''; if(typeof doc === 'string') return doc; if(Array.isArray(doc)) return doc.map(plainDocument).join(' '); if(doc.spans) return doc.spans.map(x => x.text || '').join(''); return [doc.text,plainDocument(doc.blocks || doc.children || doc.content || doc.rows || doc.cells)].filter(Boolean).join(' '); }

function renderNav() {
  const stats = state.catalog?.stats || {};
  $('#nav').innerHTML = navigation.map(([id,title,ico],i) => `${i===6?'<div class="nav-break"></div>':''}<a class="nav-link${state.page===id?' active':''}" href="#${id}" title="${title}" ${state.page===id?'aria-current="page"':''}>${icon(ico,19)}<span>${title}</span>${(id==='wrong'&&stats.wrong)?`<b class="nav-count">${fmt(stats.wrong)}</b>`:''}</a>`).join('');
  $('#page-title').textContent = navigation.find(n => n[0]===state.page)?.[1] || (state.page==='result'?'练习结果':modeTitle(state.session?.mode));
  $('#level').value = state.level;
  $('#theme-button').innerHTML = icon(document.documentElement.dataset.theme==='dark'?'sun':'moon',17);
}
async function loadCatalog() { const [catalog,offline]=await Promise.all([api(`/api/catalog?level=${encodeURIComponent(state.level)}`),api('/api/offline-status').catch(()=>({complete:false}))]);state.catalog=catalog;state.offline=offline;renderNav(); }

async function route() {
  const generation = ++state.routeGeneration;
  const [page = 'dashboard',id] = (location.hash.replace(/^#/,'') || 'dashboard').split('/');
  const previous=state.session;
  if(examFocus.id&&previous?.status==='active'&&(page!=='session'||id!==previous.id)){
    history.replaceState(null,'',`#session/${encodeURIComponent(previous.id)}`);
    examFocus.interrupt('navigation');return;
  }
  if(state.page==='session'&&previous?.status==='active'&&previous.listening&&(page!=='session'||id!==previous.id)){
    if(!previous.listening.paused)try{state.session=await api(`/api/sessions/${encodeURIComponent(previous.id)}/pause-listening`,{});}catch(e){toast(e.message,true);}
  }
  if(page!=='session'||id!==previous?.id)examAudio.configure(null);
  if (!navigation.some(n => n[0]===page) && !['session','result'].includes(page)) { location.hash='dashboard'; return; }
  state.page = page; state.feedback = {}; state.showReadings = false; renderNav();
  $('#main').innerHTML = '<div class="loading"><span class="spinner"></span>正在载入…</div>';
  try {
    if (page === 'session' || page === 'result') {
      if (!id) { location.hash='dashboard'; return; }
      const [session,offline] = await Promise.all([api(`/api/sessions/${encodeURIComponent(id)}`),api('/api/offline-status').catch(()=>({complete:false}))]);state.offline=offline;
      if (generation !== state.routeGeneration) return;
      state.session = session; loadedSessionAt = Date.now();
      if (session.level) { state.level = session.level; localStorage.setItem('jlpt-level',state.level); }
      if (session.status==='finished' || page==='result') {
        state.page = 'result'; state.result = session.result || (session.status==='finished'?session:null); state.reviewResultFilter='all';
        if (!state.result) throw new Error('这次练习尚未交卷，请从继续练习入口返回。');
        renderNav(); renderResult();
      } else { state.feedback = session.feedback || {}; renderNav(); renderSession(); }
      return;
    }
    await loadCatalog();
    if (generation !== state.routeGeneration) return;
    if (page === 'history') { const r = await api(`/api/history?level=${encodeURIComponent(state.level)}`); if(generation!==state.routeGeneration)return;state.history=r.items || []; }
    if (page === 'wrong' || page === 'favorites') { const r = await api(`/api/review?kind=${page}&level=${encodeURIComponent(state.level)}`);if(generation!==state.routeGeneration)return;state.review=r.items || [];state.reviewQuery='';state.reviewPage=0; }
    renderPage();
  } catch (e) {
    if(generation!==state.routeGeneration)return;
    $('#main').innerHTML = heading('LEARNING SPACE','暂时无法打开学习空间','请确认本地服务正在运行。') + `<div class="error-banner">${esc(e.message)}</div><button class="button primary" data-action="retry">${icon('resume',16)} 重新载入</button>`;
  }
}
function renderPage() {
  if(state.page==='dashboard')renderDashboard();
  else if(state.page==='practice')renderPractice();
  else if(state.page==='exam')renderExam();
  else if(state.page==='history')renderHistory();
  else if(state.page==='wrong'||state.page==='favorites')renderReview();
  else if(state.page==='data')renderData();
}

function renderDashboard() {
  const stats=state.catalog?.stats || {}, active=state.catalog?.active || [], total=(state.catalog?.types || []).reduce((sum,t)=>sum+Number(t.count||0),0);
  const date = new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  $('#main').innerHTML = heading('YOUR DAILY PRACTICE','今天，也向前一步。','让练习更专注，让进步看得见。',`<div class="date-label">${esc(date)}</div>`) + `
    <section class="hero"><div class="hero-content"><div class="eyebrow">${esc(state.level)} · YOUR NEXT CHAPTER</div><h2>把日语，练成自己的能力。</h2><p>从一道题开始，找到适合你的节奏。专项巩固、整卷模拟，和每一次值得回看的错题。</p><div class="hero-actions"><a href="#practice" class="button lime">开始今日练习 ${icon('arrow',16)}</a><a href="#exam" class="button transparent">进入模拟考场 ${icon('chevron',13)}</a></div></div><div class="hero-art" aria-hidden="true"><div class="motto-dot"></div><div class="japanese-motto">昨日より、<br>一歩先へ。<div class="motto-small">PRACTICE MAKES PROGRESS</div></div></div></section>
    <div class="stats-grid">
      ${statCard('累计作答',fmt(stats.answered),'题',`今日已练习 ${fmt(stats.todayAnswered)} 题`,'pen')}
      ${statCard('作答正确率',pct(stats.accuracy),'%',Number(stats.answered)?`已答对 ${fmt(stats.correct)} 题`:'完成练习后，了解自己的状态','chart')}
      ${statCard('待复习错题',fmt(stats.wrong),'题','把薄弱点，练成拿手题','wrong')}
      ${statCard('专注学习',Math.floor(Number(stats.studySeconds || 0)/60),'分钟','每一份积累，都算数','clock')}
    </div>
    <section><div class="section-heading"><h2>专项练习<span class="section-sub">按题型逐个突破</span></h2><a href="#practice" class="text-button">全部题型 ${icon('arrow',14)}</a></div><div class="category-grid">${categories.map(c=>`<button class="category-card" data-action="category" data-id="${c.id}"><span class="category-icon">${icon(c.icon,20)}</span><span class="category-name">${c.title}</span><span class="category-meta"><span>${fmt(categoryCount(c.id))} 道题目</span>${icon('arrow',15)}</span></button>`).join('')}</div></section>
    <div class="dashboard-bottom"><section class="panel"><h2 class="panel-title">接着上次，继续进步 <span class="tiny-tag">${active.length?'已保存进度':'随时开始'}</span></h2>${active.length?`<div class="progress-list">${active.slice(0,3).map(s=>`<div class="progress-row"><span class="progress-icon">${icon(s.mode==='exam'?'paper':'pen',17)}</span><div class="progress-detail"><strong>${esc(s.title || modeTitle(s.mode))}</strong><small>${modeTitle(s.mode)} · 已答 ${integer(s.answered)} / ${integer(s.total)} 题</small><div class="mini-progress"><span style="width:${Math.min(100,integer(s.answered)*100/Math.max(1,integer(s.total)))}%"></span></div></div><a class="button small" href="#session/${encodeURIComponent(s.id)}">继续 ${icon('chevron',12)}</a></div>`).join('')}</div>`:empty('你的下一次进步，从这里开始','开始练习后，答题进度会自动保存在这里。',`<a href="#practice" class="text-button" style="margin-top:14px">挑选一个题型 ${icon('arrow',14)}</a>`,true,'pen')}</section><section class="panel"><h2 class="panel-title">属于你的学习节奏 ${icon('spark',16)}</h2><div class="plan-note"><strong>${esc(state.level)} <span style="font-size:11px;color:var(--muted)">目标等级</span></strong>当前可练习 ${fmt(total)} 题，覆盖 ${integer(state.catalog?.types?.filter(t=>t.count>0).length)} 个题型。<br>先做一组专项练习，再用模拟考试检验学习成果。</div><a href="#wrong" class="text-button" style="margin-top:17px">回顾错题，把知识记牢 ${icon('arrow',14)}</a></section></div>`;
}
function statCard(label,value,unit,note,ico) { return `<section class="stat-card"><div class="stat-label">${label}<span class="stat-icon">${icon(ico,16)}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot">${esc(note)}</div></section>`; }

function renderPractice() {
  const types=state.catalog?.types || [];
  $('#main').innerHTML = heading('FOCUSED PRACTICE','每个题型，都能成为强项。','选择一个专项开始练习，作答后即时查看答案与解析。',`<button class="button primary" data-action="setup-practice">${icon('play',14)} 综合练习</button>`) + `<div class="practice-toolbar"><button class="pill${!state.practiceCategory?' active':''}" data-action="filter-category" data-id="0">全部专项</button>${categories.map(c=>`<button class="pill${state.practiceCategory===c.id?' active':''}" data-action="filter-category" data-id="${c.id}">${c.title}</button>`).join('')}</div><div class="practice-columns">${categories.filter(c=>!state.practiceCategory || c.id===state.practiceCategory).map(c=>{
    const list=types.filter(t=>Math.floor(Number(t.id)/100)===c.id);
    return `<section class="practice-panel"><div class="practice-panel-head"><span class="category-icon">${icon(c.icon,20)}</span><div><h2>${c.title}</h2><p>${c.english} · ${fmt(categoryCount(c.id))} 题</p></div></div>${list.length?list.map((t,i)=>`<button class="type-row" data-action="setup-practice" data-type="${esc(t.id)}" ${!t.count?'disabled':''}><div><span class="type-number">${String(i+1).padStart(2,'0')}</span><strong>${esc(t.title || defaultTypes[t.id] || '题型')}</strong></div><span class="type-right">${fmt(t.count)} 题 ${icon('chevron',14)}</span></button>`).join(''):empty('该专项暂无题目','可以在“题库与备份”中导入题目。','',true)}</section>`;
  }).join('')}</div>`;
}
function renderExam() {
  const papers=state.catalog?.papers || [], years=[...new Set(papers.map(p=>(p.title.match(/20\d{2}/)||[])[0]).filter(Boolean))].sort().reverse();
  const list=state.paperYear==='all'?papers:papers.filter(p=>p.title.includes(state.paperYear));
  $('#main').innerHTML = heading('THE MOCK EXAM','认真练习，也认真检验。','选择一套试卷，进入专注的模拟考场。') + info('模考按科目分别计时，提交本节后进入下一节。考试中不显示答案，交卷后统一回顾；结果展示参考总分、三项分数和正确率，供学习参考。') + `<div class="filter-bar"><span class="muted" style="font-size:11px;margin-right:5px">试卷年份</span><select class="search-input" id="paper-year" aria-label="试卷年份" style="min-width:130px;margin-left:0"><option value="all">全部年份</option>${years.map(y=>`<option${state.paperYear===y?' selected':''}>${y}</option>`).join('')}</select><span class="count-heading" style="margin-left:auto">${list.length} 套可用试卷</span></div>${list.length?`<div class="paper-grid">${list.map(p=>`<article class="paper-card"><div class="paper-head"><span class="tiny-tag">${esc(state.level)} · 模拟考试</span><h3>${esc(p.title)}</h3><p><span>${icon('paper',13)} ${integer(p.questionCount)} 题</span><span>${icon('clock',13)} ${minutes(p.durationSeconds)} 分钟</span></p></div><div class="paper-sections">${(p.sections || []).map(s=>`<span><b style="font-weight:400">${esc(s.title)}</b><b style="font-weight:400">${integer(s.questionCount)} 题 · ${minutes(s.durationSeconds)} 分钟</b></span>`).join('')}</div><div class="paper-foot"><button class="button" data-action="setup-exam" data-id="${esc(p.id)}">进入考场 ${icon('arrow',15)}</button></div></article>`).join('')}</div>`:empty('暂时没有可用试卷','请更换目标等级，或导入一份完整题库。',`<a href="#data" class="button">管理题库 ${icon('arrow',14)}</a>`,'','paper')}`;
}

function renderReview() {
  const wrong=state.page==='wrong', q=state.reviewQuery.toLowerCase();
  const filtered=state.review.filter(item=>!q || `${item.stem || ''} ${plainDocument(item.stemDocument)} ${typeTitle(item)}`.toLowerCase().includes(q));
  const pageSize=25,totalPages=Math.ceil(filtered.length/pageSize),start=state.reviewPage*pageSize;
  const list=filtered.slice(start,start+pageSize);
  $('#main').innerHTML = heading(wrong?'LEARN FROM MISTAKES':'YOUR PERSONAL COLLECTION',wrong?'错过的题，值得再会一次。':'把好题，留给下次相遇。',wrong?'记录每一个薄弱点，让复习更有方向。':'收藏需要巩固的题目，形成自己的练习清单。',state.review.length?`<button class="button primary" data-action="setup-review" data-kind="${state.page}">${icon('play',14)} ${wrong?'复习错题':'练习收藏'}</button>`:'') + `<div class="filter-bar"><span class="count-heading">${esc(state.level)} · 共 ${fmt(state.review.length)} 道${wrong?'待复习错题':'收藏题目'}</span><input class="search-input" id="review-search" aria-label="搜索题目" placeholder="搜索题目或题型…" value="${esc(state.reviewQuery)}"></div>${list.length?`<div class="review-list">${list.map(item=>`<article class="review-card"><div class="review-card-top"><div class="review-meta"><span class="tiny-tag">${esc(typeTitle(item))}</span><span>${esc(item.paperTitle || item.sectionTitle || state.level)}</span>${wrong?`<span>错过 ${integer(item.wrongCount,1)} 次</span>`:''}</div><button class="icon-button${item.favorite?' selected':''}" data-action="review-favorite" data-id="${esc(item.id)}" title="${item.favorite?'取消收藏':'收藏题目'}" aria-label="${item.favorite?'取消收藏':'收藏题目'}">${icon('star',17)}</button></div><div class="review-stem">${stemHTML(item)}</div><div class="review-card-bottom"><span>${esc(item.number?`第 ${item.number} 题`:'专注这一题')}</span><button class="text-button" data-action="practice-one" data-id="${esc(item.id)}" data-kind="${state.page}">重新练习 ${icon('arrow',14)}</button></div></article>`).join('')}</div>${totalPages>1?`<div class="filter-bar" style="margin-top:22px;justify-content:center"><button class="button small" data-action="review-page" data-page="${state.reviewPage-1}" ${!state.reviewPage?'disabled':''}>上一页</button><span class="count-heading">${state.reviewPage+1} / ${totalPages}</span><button class="button small" data-action="review-page" data-page="${state.reviewPage+1}" ${state.reviewPage>=totalPages-1?'disabled':''}>下一页</button></div>`:''}`:empty(q?'没有找到匹配题目':wrong?'错题本，等你把它变薄。':'这里，留给值得反复练习的题。',q?'试试其他关键词。':wrong?'练习或考试中的错题会自动汇集到这里。':'在答题时点击星标，即可加入收藏。',q?'':`<a href="#practice" class="button">去做一组练习 ${icon('arrow',14)}</a>`,'',wrong?'wrong':'star')}`;
}
function renderHistory() {
  const list=state.history;
  $('#main').innerHTML = heading('YOUR LEARNING JOURNEY','每一次练习，都留下足迹。','回看作答记录，找到自己的进步。') + (list.length?`<div class="table-wrap"><table><thead><tr><th>练习 / 试卷</th><th>时间</th><th>进度</th><th>正确率</th><th></th></tr></thead><tbody>${list.map(s=>`<tr><td><strong style="font-weight:500">${esc(s.title || modeTitle(s.mode))}</strong><small>${esc(s.level || state.level)} · ${modeTitle(s.mode)}</small></td><td>${dateText(s.updatedAt || s.finishedAt || s.createdAt)}</td><td>${s.status==='finished'?'<span class="tiny-tag">已完成</span>':'<span class="tiny-tag warm">进行中</span>'}<small>${integer(s.answered ?? s.result?.total)} / ${integer(s.total ?? s.result?.total)} 题</small></td><td>${s.status==='finished'?`${pct(s.accuracy ?? s.result?.accuracy)}%`:'—'}</td><td><a class="button small" href="#${s.status==='finished'?'result':'session'}/${encodeURIComponent(s.id)}">${s.status==='finished'?'查看结果':'继续练习'} ${icon('chevron',12)}</a></td></tr>`).join('')}</tbody></table></div>`:empty('下一次回看，会看到进步。','完成一组练习或一次模拟考试后，就能在这里看到记录。',`<a href="#practice" class="button primary">开始练习 ${icon('arrow',14)}</a>`,'','history'));
}
function renderData() {
  $('#main').innerHTML = heading('YOUR LOCAL LIBRARY','题库与进度，都由你掌握。','导入题目、备份学习记录，在电脑上安心练习。') + `<div class="data-grid"><section class="data-card"><span class="category-icon">${icon('book',23)}</span><h2>导入题库</h2><p>导入兼容格式的 JSON 题库。支持 N1–N5、专项题型、阅读材料和听力地址。导入后即可开始练习。</p><button class="button primary" data-action="import-bank">${icon('upload',15)} 选择题库文件</button><input type="file" id="bank-file" accept=".json,application/json"><details style="margin-top:22px"><summary class="raw-note" style="cursor:pointer">查看题库格式示例</summary><pre class="format-sample">${esc(JSON.stringify({papers:[{id:'my-n2',level:'N2',title:'我的 N2 练习卷',sections:[{id:'vocab',title:'文字词汇',durationSeconds:1200}]}],questions:[{id:'my-001',paperId:'my-n2',level:'N2',sectionId:'vocab',type:101,stem:'请选择正确读音。',options:[{id:'1',text:'选项一'},{id:'2',text:'选项二'},{id:'3',text:'选项三'},{id:'4',text:'选项四'}],answer:'1',explanation:'答案解析'}]},null,2))}</pre></details></section><section class="data-card"><span class="category-icon">${icon('download',23)}</span><h2>备份学习记录</h2><p>导出本机的练习进度、作答记录、错题与收藏。定期备份，让每一次学习都有迹可循。</p><a class="button" href="/api/export" download="日语研习室-学习备份.json">${icon('download',15)} 导出学习备份</a><button class="button" data-action="restore" style="margin-left:6px">${icon('upload',15)} 恢复备份</button><input type="file" id="restore-file" accept=".json,application/json"><div class="info-note" style="margin-top:25px;margin-bottom:0">${icon('info',16)}<span>本地数据存储在程序的 data 文件夹中。移动程序时，请一同保留该文件夹；更换电脑前建议先导出备份。</span></div></section></div><section class="panel" style="margin-top:23px"><h2 class="panel-title">当前学习空间 <span class="tiny-tag">${esc(state.level)}</span></h2><div class="raw-note">当前等级可练习 <strong style="color:var(--ink)">${fmt((state.catalog?.types || []).reduce((sum,t)=>sum+Number(t.count||0),0))}</strong> 道题，${fmt(state.catalog?.papers?.length)} 套试卷。学习记录保存在本机，无需连接模拟器即可继续练习。<br>题目图片和听力若使用网络地址，播放与加载时需要网络连接；缺失的资源会在题目中提示。</div></section>`;
  $('#main').insertAdjacentHTML('beforeend',`<section class="panel reset-progress-panel"><div><h2>重新开始学习</h2><p>重置所有等级的练习、模考、作答统计、错题和收藏记录。</p></div><button type="button" class="button destructive" data-action="reset-progress">${icon('resume',16)} 重置所有学习进度</button></section>`);
}
function clearLearningView(){
  examFocus.release();examAudio.focusPaused=false;
  examAudio.configure(null);state.session=null;state.result=null;state.feedback={};state.history=[];state.review=[];state.catalog=null;state.restorePayload=null;
  localStorage.removeItem('jlpt-last-session');
}
async function resetAllProgress(){
  if(state.busy)return;state.busy=true;
  const button=$('[data-action="confirm-reset-progress"]');if(button){button.disabled=true;button.textContent='正在重置…';}
  try{
    const result=await api('/api/reset-progress',{confirmation:'reset-all-progress'});
    clearLearningView();localStorage.setItem('jlpt-progress-reset-at',String(Date.now()));$('#modal').close();
    await loadCatalog();renderData();setSaved('已重置学习进度');toast(result.message);
  }catch(e){toast(e.message,true);if(button){button.disabled=false;button.textContent='确认重置所有学习进度';}}
  finally{state.busy=false;}
}

function examStages(s){
 const parts=[];for(let i=0;i<s.sections.length;i++){const sec=s.sections[i];if(sec.audioPlan&&sec.restBeforeSeconds)parts.push({title:'休息',active:s.phase==='break'&&i===s.activeSectionIndex,done:i<s.activeSectionIndex||(i===s.activeSectionIndex&&s.phase!=='break')});parts.push({title:sec.title,active:i===s.activeSectionIndex&&s.phase!=='break',done:i<s.activeSectionIndex});}
 return `<div class="exam-stages">${parts.map(p=>`<span class="exam-stage${p.active?' active':''}${p.done?' done':''}"><i></i>${esc(p.title)}</span>`).join('')}</div>`;
}
function renderExamBreak(){
 const s=state.session;examAudio.configure(null);
 $('#main').innerHTML=`<div class="session-page">${examStages(s)}${heading('EXAM BREAK','稍作休息，准备听力。',`${s.title} · 语言知识与阅读部分已提交。`)}<section class="exam-break panel"><span class="break-symbol">${icon('headphones',42)}</span><p>听力部分将在休息结束后自动开始</p><div class="break-clock timer" id="timer">10:00</div><button class="button primary" data-action="start-listening">立即开始听力部分 ${icon('play',15)}</button><p class="break-note">进入听力后，录音按整卷顺序连续播放。<br>切题不会改变录音进度；播完并留足作答时间后自动交卷。</p><button class="text-button" data-action="leave-session">保存并离开</button></section></div>`;updateTimer();
}
function examAudioPanel(){return `<section class="exam-listening" id="exam-audio-panel"><div class="exam-listening-heading">${icon('headphones',19)}<strong>听力考试 · 连续播放</strong><span class="tiny-tag">本地音频</span></div><div class="exam-listening-status" id="exam-audio-status">正在准备录音…</div><div class="mini-progress" role="progressbar" aria-label="整卷听力进度"><span id="exam-audio-progress"></span></div><div class="exam-listening-bottom"><span id="exam-audio-time"></span><label>音量 <input id="exam-volume" aria-label="考试音量" type="range" min="0" max="1" step="0.05" value="${examAudio.audio.volume}"></label></div><div class="exam-audio-alert" id="exam-audio-alert" hidden><span id="exam-audio-message"></span><button class="button primary small" data-action="resume-listening">继续听力考试</button></div><div class="exam-audio-foot"><span>录音连续播放，切题不会重播或快进。</span><button class="text-button" data-action="follow-listening">查看当前录音对应题目</button></div></section>`;}
function paintExamAudio(p){
 if(!$('#exam-audio-panel')||state.page!=='session')return;
 const questions=state.session.questions.filter(q=>p.item?.questionIds.includes(q.id));
 const label=questions.map(q=>state.session.questions.indexOf(q)+1).join('、');
 $('#exam-audio-status').textContent=p.paused?'听力考试已暂停':p.phase==='gap'?`${p.itemIndex===currentSection().audioPlan.items.length-1?'最后作答时间':'作答间隔'} · 剩余 ${Math.ceil(p.gapRemainingMs/1000)} 秒`:p.phase==='complete'?'听力结束，正在交卷…':`正在播放第 ${p.itemIndex+1} 段录音 · 对应第 ${label} 题`;
 $('#exam-audio-progress').style.width=`${Math.min(100,p.elapsedMs*100/p.totalDurationMs)}%`;
 $('#exam-audio-time').textContent=`${timerText(p.elapsedMs/1000)} / ${timerText(p.totalDurationMs/1000)}`;
 const alert=$('#exam-audio-alert');alert.hidden=!(p.paused||p.blocked||p.error);$('#exam-audio-message').textContent=examAudioNotice||'点击继续，从暂停位置恢复录音。';
 const paused=p.paused||p.blocked||p.error;
 for(const b of document.querySelectorAll('[data-action="answer"]'))b.disabled=paused||state.busy;
}
async function pauseExamAudio(message){
 if(audioPauseBusy||state.page!=='session'||!state.session?.listening)return;
 audioPauseBusy=true;examAudioNotice=message;
 try{const s=await api(`/api/sessions/${encodeURIComponent(state.session.id)}/pause-listening`,{});state.session=s;loadedSessionAt=Date.now();renderSession();}
 catch(e){examAudio.audio.pause();toast(e.message,true);}finally{audioPauseBusy=false;}
}
async function beginListening(resume=false){
 if(state.busy)return;state.busy=true;
 try{const s=await api(`/api/sessions/${encodeURIComponent(state.session.id)}/${resume?'resume-listening':'start-listening'}`,{});examAudioNotice='';examAudio.retry();state.session=s;loadedSessionAt=Date.now();renderSession();}
 catch(e){toast(e.message,true);}finally{state.busy=false;if(state.page==='session')renderSession();}
}
async function pauseAndLeave(){
 if(state.busy)return;state.busy=true;
 try{await checkpoint();state.session=await api(`/api/sessions/${encodeURIComponent(state.session.id)}/pause-listening`,{});examAudio.configure(null);$('#modal').close();location.hash='exam';toast('考试已暂停，答案与录音位置已保存。');}
 catch(e){toast(e.message,true);}finally{state.busy=false;}
}
function renderSession() {
  const s=state.session;
  examFocus.configure(s);examAudio.focusPaused=examFocus.locked;
  if(s?.mode==='exam'&&s.phase==='break'){renderExamBreak();return;}
  if(!s?.questions?.length) { $('#main').innerHTML=empty('这组练习没有题目','请返回专项练习重新选择。','<a class="button" href="#practice">返回练习</a>');return; }
  s.currentIndex=Math.min(s.questions.length-1,Math.max(0,integer(s.currentIndex)));
  const q=currentQuestion(),feedback=state.feedback[q.id],chosen=s.answers?.[q.id],exam=s.mode==='exam',section=currentSection(),sectionLocked=exam && section && q.sectionId!==section.id;
  const examContinuous=exam&&!!section?.audioPlan;
  const answered=Object.keys(s.answers || {}).length,flags=s.flags || [], read=state.showReadings && !exam && !!feedback;
  const sections=s.sections?.length?s.sections:[...new Map(s.questions.map(q=>[q.sectionId,{id:q.sectionId,title:q.sectionTitle}])).values()];
  $('#main').innerHTML = `<div class="session-page"><div class="session-breadcrumb"><a href="#${exam?'exam':'practice'}">${modeTitle(s.mode)}</a>${icon('chevron',11)}<span>${esc(s.level)}</span>${icon('chevron',11)}<span>${esc(s.title || '本次练习')}</span></div><div class="page-heading"><div><h1>${esc(s.title || modeTitle(s.mode))}</h1><p>${exam?'在自己的节奏里，认真完成这次检验。':'一次专注，一点积累。答题后，即可查看解析。'}</p></div><button class="button small" data-action="leave-session">${icon('bookmark',14)} 保存并离开</button></div>${exam && sections.length>1?`<div class="section-tabs">${sections.map((sec,i)=>`<button class="section-tab${q.sectionId===sec.id?' active':''}" data-action="go-section" data-id="${esc(sec.id)}" ${exam&&section&&sec.id!==section.id?'disabled':''}>${esc(sec.title || `第 ${i+1} 节`)}${exam?` · ${{pending:'待开始',active:'进行中',finished:'已结束'}[sec.status] || ''}`:''}</button>`).join('')}</div>`:''}<div class="session-layout"><div class="question-card"><div class="question-header"><div class="question-header-left"><span class="question-number">${String(s.currentIndex+1).padStart(2,'0')}</span><span class="muted">/ ${s.questions.length}</span><span class="tiny-tag">${esc(typeTitle(q))}</span><span class="question-source">${esc(q.paperTitle || "")}</span></div><div class="question-tools">${!exam && feedback?`<button class="icon-button${read?' selected':''}" data-action="readings" title="切换注音" aria-label="切换注音"><span style="font-size:12px">あ</span></button>`:''}<button class="icon-button${flags.includes(q.id)?' selected':''}" data-action="flag" title="标记待检查" aria-label="标记待检查">${icon('flag',17)}</button><button class="icon-button${q.favorite?' selected':''}" data-action="favorite" title="${q.favorite?'取消收藏':'收藏题目'}" aria-label="${q.favorite?'取消收藏':'收藏题目'}">${icon('star',18)}</button></div></div><div class="question-main">${sectionLocked?`<div class="info-note">${icon('info',15)}<span>${section.status==='finished'?'当前科目已结束。':'当前正在作答'} ${esc(section.title)}，仅能作答当前科目的题目。</span></div>`:''}${q.instruction?`<div class="question-instruction">${esc(q.instruction)}</div>`:''}${passageHTML(q,read)}${extraImagesHTML(q,read)}${!examContinuous&&q.audio?`<div class="audio-box">${icon('headphones',15)} 听力材料<audio controls preload="none" src="${safeURL(q.audio)}" data-audio="question"></audio><div class="audio-state" id="audio-state" hidden>正在加载听力材料…</div><div class="audio-error" id="audio-error" hidden>音频暂不可用，请检查网络后重试；已缓存的音频可离线播放。</div></div>`:!examContinuous&&Math.floor(Number(q.type)/100)===4?`<div class="audio-box">${icon('headphones',15)} 这道题暂未提供可播放的听力文件。</div>`:''}<div class="question-stem">${stemHTML(q,read)}</div><div class="options">${(q.options || []).map((o,i)=>{
    const selected=answerMatches(chosen,o.id),right=feedback&&answerMatches(feedback.answer,o.id),wrong=feedback&&selected&&!feedback.correct;
    return `<button class="option${selected?' selected':''}${right?' correct':''}${wrong?' wrong':''}" data-action="answer" data-option="${esc(o.id)}" ${state.busy || sectionLocked || (!exam&&feedback)?'disabled':''}><span class="option-key">${i+1}</span><span class="option-text">${optionHTML(o,read)}</span>${right?`<span class="option-status">${icon('check',16)}</span>`:wrong?`<span class="option-status">${icon('close',16)}</span>`:''}</button>`;
  }).join('')}</div></div>${feedback&&!exam?`<div class="explanation${feedback.correct?'':' incorrect'}"><h3>${icon(feedback.correct?'circlecheck':'info',16)} ${feedback.correct?'回答正确，继续保持。':'记住这一题，下次会更好。'}</h3><div class="answer-label">正确答案：${esc((q.options || []).findIndex(o=>answerMatches(o.id,feedback.answer))+1 || feedback.answer)}</div><p>${esc(feedback.explanation || '本题暂未提供文字解析。')}</p></div>`:''}<div class="question-footer"><span class="key-hint"><kbd>1</kbd> – <kbd>4</kbd> 答题 <span style="margin:0 5px">·</span> <kbd>←</kbd> <kbd>→</kbd> 切题</span><div class="question-footer-buttons"><button class="button" data-action="prev" ${s.currentIndex===0||(exam&&section&&s.questions[s.currentIndex-1]?.sectionId!==section.id)?'disabled':''}>${icon('left',13)} 上一题</button><button class="button primary" data-action="next">${s.currentIndex===s.questions.length-1?'检查并交卷':'下一题'} ${icon('chevron',13)}</button></div></div></div><aside class="answer-panel"><div class="timer-row"><span>${exam?'本节剩余时间':'本次练习用时'}</span>${icon('clock',14)}</div><div class="timer" id="timer">--:--</div>${exam&&section?`<div style="font-size:10px;color:var(--muted);margin:-5px 0 16px">${esc(section.title)}</div>`:''}<div class="session-progress"><span>作答进度</span><span>${answered} / ${s.questions.length}</span></div><div class="mini-progress"><span style="width:${answered*100/s.questions.length}%"></span></div><h3>答题卡</h3><div class="answer-grid">${s.questions.map((item,i)=>`<button class="answer-dot${s.answers?.[item.id]!=null?' answered':''}${state.feedback[item.id]?.correct===false?' incorrect':''}${i===s.currentIndex?' current':''}${flags.includes(item.id)?' flagged':''}" data-action="go-question" data-index="${i}" ${exam&&section&&item.sectionId!==section.id?'disabled':''} title="第 ${i+1} 题${s.answers?.[item.id]!=null?'，已作答':'，未作答'}" aria-label="第 ${i+1} 题">${i+1}</button>`).join('')}</div><div class="grid-legend"><span><i class="legend-dot done"></i> 已作答</span><span><i class="legend-dot"></i> 未作答</span><span><i class="legend-dot flag"></i> 待检查</span></div>${exam&&section&&s.activeSectionIndex<sections.length-1?`<button class="button primary submit-button" data-action="next-section">提交本节，进入下一节 ${icon('arrow',13)}</button><button class="text-button" data-action="finish" style="margin-top:13px;width:100%;justify-content:center;font-size:10px">提前交整卷</button>`:`<button class="button primary submit-button" data-action="finish">${icon('check',15)} ${exam?'交卷并查看结果':'结束练习，查看结果'}</button>`}<div class="keyboard-note"><kbd>1</kbd> – <kbd>4</kbd> 选择答案<br><kbd>←</kbd> <kbd>→</kbd> 切换题目 <span style="margin-left:8px"><kbd>F</kbd> 收藏</span><br><kbd>Enter</kbd> 下一题</div>${exam?'<div class="session-warning">计时不会因关闭页面而暂停。每次作答均会自动保存。</div>':''}</aside></div></div>`;
  if(exam)$('#main .session-page').insertAdjacentHTML('afterbegin',examStages(s));
  if(examContinuous){$('.question-main').insertAdjacentHTML('afterbegin',examAudioPanel());examAudio.configure(s);}else examAudio.configure(null);
  if(exam&&!examContinuous&&q.audio&&q.paperId?.startsWith('jlpt:'))$('.question-main').insertAdjacentHTML('afterbegin',info('本场考试保留旧版进度。要使用新版整卷连续听力，请从试卷列表新开一场模考。'));
  const warning=$('.session-warning');if(warning&&exam)warning.textContent='切换窗口或退出全屏将暂停计时'+(examContinuous?'与听力':'')+'；恢复全屏后继续。每次作答会自动保存。';
  if(q.sourceWarning){const warning=document.createElement('div');warning.className='info-note source-warning';warning.textContent=q.sourceWarning;$('.question-main').prepend(warning);}
  const audio=$('audio[data-audio]');
  if(audio){
    const box=audio.closest('.audio-box');for(const node of [...box.childNodes])if(node.nodeType===3&&node.textContent.trim()==='听力材料')node.remove();
    const label=document.createElement('span');label.className='audio-source-label';label.textContent=`${state.offline?.complete?'离线音频':'听力材料'} · ${q.paperTitle || s.title} · 第 ${q.number || s.currentIndex+1} 题`;box.insertBefore(label,audio);
    const errorBox=$('#audio-error');
    const errorMessage=document.createElement('span');errorMessage.textContent=errorBox.textContent;
    const retry=document.createElement('button');retry.type='button';retry.className='button small';retry.textContent='重试加载';retry.style.marginLeft='12px';
    retry.addEventListener('click',()=>{errorBox.hidden=true;audio.load();audio.play().catch(()=>{});});
    errorBox.replaceChildren(errorMessage,retry);
    audio.addEventListener('error',async()=>{
      errorBox.hidden=false;const wait=$('#audio-state');if(wait)wait.hidden=true;
      try{
        const r=await fetch(audio.getAttribute('src'),{headers:{Range:'bytes=0-0'}});
        if(!audio.isConnected){await r.body?.cancel();return;}
        if(!r.ok){const detail=await r.json();if(detail.error)errorMessage.textContent=detail.error;}
        else{await r.body?.cancel();errorMessage.textContent='音频文件已可用，请点击重试加载。';}
      }catch{if(audio.isConnected)errorMessage.textContent='无法连接本地学习服务，请重新启动程序后重试。';}
    });
    for(const event of ['waiting','loadstart'])audio.addEventListener(event,()=>{const wait=$('#audio-state');if(wait)wait.hidden=false;});
    for(const event of ['canplay','playing','pause'])audio.addEventListener(event,()=>{const wait=$('#audio-state');if(wait)wait.hidden=true;if(event!=='pause')errorBox.hidden=true;});
  }
  updateTimer();
}

function resultScoringHTML(scoring, level) {
  if(!scoring)return '';
  const scoreText=value=>value==null?'—':Number(value).toFixed(1);
  const explanation=scoring.partial?'仅汇总本次涉及的部分；未涉及的部分不计入满分。':'三项各 60 分，总分 180 分。';
  return `<section class="result-scoring" aria-label="参考分数">
    <div class="result-score-total"><span>本次参考总分</span><strong data-total-score>${scoreText(scoring.score)}<small> / ${integer(scoring.maxScore)} 分</small></strong><p>${explanation}</p></div>
    <div class="result-score-method"><span class="tiny-tag">${esc(level)} · 按题型加权</span><p>单项参考分 = 答对题的加权分 ÷ 本次该部分的加权满分 × 60。各项保留 1 位小数后相加。</p><p>正确率 = 答对题数 ÷ 该部分题数；未作答计零分。题型权重不同，正确率与得分比例可能不同。</p>
    <details class="result-score-weights"><summary>查看题型分值</summary><p>文字词汇（含语法）：用法每题 2 分，其余每题 1 分。</p><p>阅读：短篇 2 分；中篇、长篇、综合理解 3 分；论点理解、信息检索 4 分。</p><p>听力：课题理解、要点理解、概要理解 2 分；即时应答、发话表达 1 分；综合理解 3 分。</p></details></div>
  </section>${info('按提供的 N2 表格权重计算，其他等级沿用相同规则。分母按本次实际题量计算；这是练习参考分，不代表 JLPT 官方量尺分数或合格判定。')}
  <div class="result-section-grid result-score-grid">${scoring.sections.map(sec=>`<section class="result-section result-score-card" data-score-section="${esc(sec.id)}"><h3>${esc(sec.title)}<span>${sec.total?`${integer(sec.correct)} / ${integer(sec.total)} 题`:'未涉及'}</span></h3><div class="result-section-score"><strong data-section-score>${scoreText(sec.score)}<small> / 60 分</small></strong><span data-section-accuracy>${sec.accuracy==null?'未涉及':`正确率 ${scoreText(sec.accuracy)}%`}</span></div><div class="mini-progress"><span style="width:${sec.accuracy??0}%"></span></div><p>${!sec.total?'本次未包含该部分题目。':sec.unsupported?'含未配置权重的题型，暂不计算分数。':`加权得分 ${integer(sec.earned)} / ${integer(sec.possible)} · 未答 ${integer(sec.unanswered)} 题`}</p></section>`).join('')}</div>${scoring.unclassified?info(`本次有 ${integer(scoring.unclassified)} 道题无法归入三个部分，参考总分暂不计算。`):''}`;
}

function renderResult() {
  examFocus.release();examAudio.focusPaused=false;
  examAudio.configure(null);
  const r=state.result,s=state.session;
  if(!r)return;
  const questions=r.questions || [],list=state.reviewResultFilter==='wrong'?questions.filter(q=>!q.correct):questions;
  $('#main').innerHTML = heading(s?.mode==='exam'?'EXAM COMPLETE':'PRACTICE COMPLETE',s?.mode==='exam'?'考试已完成，回顾每一分进步。':'完成一次练习，多一点把握。',`${s?.title || '练习结果'} · ${esc(s?.level || state.level)}`,`<a href="#${s?.mode==='exam'?'exam':'practice'}" class="button">${icon('arrow',14)} 再练一组</a>`) + `<section class="result-hero"><div class="accuracy-ring" style="--percent:${Math.max(0,Math.min(100,pct(r.accuracy)))}"><div class="accuracy-ring-inner"><strong>${pct(r.accuracy)}<small>%</small></strong><span>本次正确率</span></div></div><div class="result-intro"><div class="eyebrow">SMALL STEPS, REAL PROGRESS</div><h2>${pct(r.accuracy)>=85?'练得扎实，继续向前。':pct(r.accuracy)>=60?'积累正在发生，继续保持。':'看见薄弱点，就是进步的开始。'}</h2><p>错题已自动收录，回顾解析后再练一次，把知识留在记忆里。</p><div class="result-numbers"><div><strong>${integer(r.correct)}<span style="margin-left:4px">/ ${integer(r.total)}</span></strong><span>答对题数</span></div><div><strong>${integer(r.wrong)}</strong><span>答错题数</span></div><div><strong>${integer(r.unanswered)}</strong><span>未作答</span></div><div><strong>${Math.floor(Number(r.elapsedSeconds || 0)/60)}<span style="margin-left:4px">分钟</span></strong><span>${s?.mode==='exam'?'考试用时':'练习用时'}</span></div></div></div></section>${resultScoringHTML(r.scoring,s?.level || state.level)}<div class="section-heading"><h2>逐题回顾<span class="section-sub">理解解析，比记住答案更重要</span></h2><div style="display:flex;gap:6px"><button class="pill${state.reviewResultFilter==='all'?' active':''}" data-action="result-filter" data-kind="all">全部</button><button class="pill${state.reviewResultFilter==='wrong'?' active':''}" data-action="result-filter" data-kind="wrong">错题与未答</button></div></div>${list.length?list.map(q=>`<details class="result-review"><summary><span class="review-number">${questions.indexOf(q)+1}.</span><span class="review-stem">${stemHTML(q)}</span><span class="result-status${q.correct?'':' bad'}">${q.correct?'回答正确':q.chosen==null?'未作答':'回答错误'} ${icon('chevron',12)}</span></summary><div class="result-answer-body">${passageHTML(q)}${extraImagesHTML(q)}${(q.options || []).map((o,i)=>`<div class="result-choice${answerMatches(q.answer,o.id)?' right':answerMatches(q.chosen,o.id)?' wrong':''}">${i+1}. ${optionHTML(o)}${answerMatches(q.answer,o.id)?'　✓ 正确答案':answerMatches(q.chosen,o.id)?'　你的答案':''}</div>`).join('')}<div class="result-explanation">${esc(q.explanation || '本题暂未提供文字解析。')}</div><button class="text-button" data-action="result-favorite" data-id="${esc(q.id)}" style="margin-top:15px">${icon('star',14)} ${q.favorite?'已收藏':'收藏此题'}</button></div></details>`).join(''):empty('这组题，全都掌握了。','继续保持，换一组题检验更多知识点。','',true,'circlecheck')}<div class="result-actions"><a href="#wrong" class="button">${icon('wrong',15)} 前往错题本</a><a href="#history" class="button">${icon('history',15)} 查看练习记录</a></div>`;
}

function showModal(title,description,body,footer) {
  $('#modal-content').innerHTML=`<div class="modal-head"><div><h2>${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close',17)}</button></div><div class="modal-body">${body}</div><div class="modal-footer"><button class="button" data-action="close-modal">取消</button>${footer}</div>`;
  if(!$('#modal').open)$('#modal').showModal();
}
function setupPractice(type,kind='practice',questionId) {
  const t=(state.catalog?.types || []).find(t=>String(t.id)===String(type));
  state.selectedCount=questionId?1:20;state.selectedOrder='random';
  state.setup={mode:kind,type:type?integer(type):undefined,questionIds:questionId?[questionId]:undefined};
  state.availableCount=questionId?1:kind==='wrong'||kind==='favorites'?state.review.length:type?integer(t?.count):(state.catalog?.types||[]).reduce((sum,t)=>sum+integer(t.count),0);
  const title=kind==='wrong'?'复习错题':kind==='favorites'?'练习收藏':t?.title || defaultTypes[type] || '综合练习';
  showModal(title,`${state.level} · 为这次练习，定一个小目标。`,`${questionId?'<p class="modal-warning">只练习你选中的这道题，作答后即可查看答案与解析。</p>':`<div class="form-field"><span id="practice-count-label">本组题量</span><div class="choice-chips" role="group" aria-labelledby="practice-count-label">${[10,20,30,50,'all','custom'].map(n=>`<button type="button" class="choice-chip${n===20?' active':''}" data-action="count-choice" data-count="${n}" aria-pressed="${n===20}">${n==='all'?'全部':n==='custom'?'自定义':n+' 题'}</button>`).join('')}</div><div id="custom-count-field" class="custom-count-field" hidden><label for="practice-custom-count">自定义题量</label><div class="custom-count-input"><input id="practice-custom-count" type="number" min="1" max="${Math.min(state.availableCount,5000)}" step="1" inputmode="numeric" value="${Math.min(20,state.availableCount)}" aria-describedby="practice-count-hint practice-count-error"><span>题</span></div></div><small id="practice-count-hint"></small><small id="practice-count-error" class="count-error" role="status" hidden></small></div><label class="form-field"><span>练习顺序</span><select id="practice-order"><option value="random">随机抽题</option><option value="sequential">按题库顺序</option></select></label>`}<div class="info-note" style="margin:20px 0 0">${icon('info',15)}<span>作答后即时显示解析，进度自动保存。你可以随时离开，下次接着练。</span></div>`,`<button class="button primary" data-action="create-practice">开始练习 ${icon('arrow',14)}</button>`);
  updatePracticeCount();
}
function practiceCountSelection(){
  const available=state.availableCount??0;
  if(!available)return {error:'当前条件下没有可练习的题目。',planned:0};
  if(state.selectedCount==='all')return {count:'all',planned:available};
  if(state.selectedCount==='custom'){
    const field=$('#practice-custom-count'),raw=field?.value??'',count=Number(raw),max=Math.min(available,5000);
    if(!raw||!Number.isInteger(count)||count<1||count>max||field?.validity.badInput)return {error:`请输入 1–${fmt(max)} 之间的整数。`,planned:0};
    return {count,planned:count};
  }
  return {count:state.selectedCount,planned:Math.min(state.selectedCount,available)};
}
function updatePracticeCount(){
  const custom=state.selectedCount==='custom',field=$('#practice-custom-count'),wrap=$('#custom-count-field');
  if(wrap)wrap.hidden=!custom;
  for(const b of document.querySelectorAll('.choice-chips [data-action="count-choice"]')){const active=String(state.selectedCount)===b.dataset.count;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
  const selection=practiceCountSelection(),hint=$('#practice-count-hint'),error=$('#practice-count-error');
  if(hint)hint.textContent=`当前条件可用 ${fmt(state.availableCount)} 题${selection.error?'':`，本组将练习 ${fmt(selection.planned)} 题${state.selectedCount==='all'?'（全部）':''}`}。`;
  if(error){error.hidden=!selection.error;error.textContent=selection.error||'';}
  if(field){field.required=custom;field.setAttribute('aria-invalid',String(custom&&!!selection.error));}
  const start=$('[data-action="create-practice"]');if(start)start.disabled=state.busy||!!selection.error;
  return selection;
}
function setupExam(id) {
  const p=(state.catalog?.papers || []).find(p=>p.id===id);if(!p)return;
  state.setup={mode:'exam',paperId:id};
  showModal('准备好，进入模拟考场。',p.title,`<div class="modal-count">${integer(p.questionCount)}<small>题 · 原卷参考时长 ${minutes(p.durationSeconds)} 分钟</small></div><div class="modal-warning">开始后自动进入<strong>全屏考场</strong>，考试中隐藏学习导航，提交整卷后退出。切换窗口、退出全屏或刷新后，计时与听力暂停；恢复全屏后才能继续作答。系统快捷键仍由 Windows 控制。<br><br>考试按科目分别计时，<strong>提交本节后无法返回修改</strong>。听力前可休息 10 分钟，可立即开始；正式听力按原计划整卷连播，录音及末尾作答时间结束后自动交卷。</div>`,`<button class="button primary" data-action="create-exam">全屏开始考试 ${icon('arrow',14)}</button>`);
}
async function createSession(exam) {
  const selection=exam?null:updatePracticeCount();
  if(selection?.error){$('#practice-custom-count')?.focus();return;}
  if(state.busy)return;state.busy=true;
  const b=$(`[data-action="${exam?'create-exam':'create-practice'}"]`);if(b){b.disabled=true;b.innerHTML='<span class="spinner"></span> 正在准备…';}
  try {
    if(exam)await examFocus.enterFullscreen();
    const payload={...state.setup,level:state.level};
    if(!exam){payload.count=selection.count;payload.order=$('#practice-order')?.value || 'random';}
    const s=await api('/api/sessions',payload);
    $('#modal').close();localStorage.setItem('jlpt-last-session',s.id);location.hash=`session/${encodeURIComponent(s.id)}`;
  } catch(e) {if(exam)examFocus.release(true);toast(e.message,true);if(b){b.disabled=false;b.textContent=exam?'全屏开始考试':'开始练习';}}finally{state.busy=false;}
}
async function checkpoint() { if(!state.session || state.session.status!=='active')return;const s=state.session;await api(`/api/sessions/${encodeURIComponent(s.id)}/checkpoint`,{currentIndex:s.currentIndex,flags:s.flags || []});setSaved(); }
async function goQuestion(index) {
  const s=state.session;if(!s || state.busy||examFocus.locked)return;
  const nextIndex=Math.max(0,Math.min(s.questions.length-1,index));
  const sec=currentSection(s);
  if(s.mode==='exam'&&sec&&s.questions[nextIndex].sectionId!==sec.id){toast('请先完成当前科目，再进入下一节。');return;}
  s.currentIndex=nextIndex;renderSession();
  try{await checkpoint();}catch(e){toast(e.message,true);}
}
async function answer(optionId) {
  if(state.busy)return;const s=state.session,q=currentQuestion();if(!s||!q)return;
  if(s.phase==='break'||s.listening?.paused||examFocus.locked)return;
  if(s.mode!=='exam'&&state.feedback[q.id])return;
  const sec=currentSection();if(s.mode==='exam'&&sec&&q.sectionId!==sec.id)return;
  state.busy=true;
  try {
    const r=await api(`/api/sessions/${encodeURIComponent(s.id)}/answer`,{questionId:q.id,optionId});
    s.answers ||= {};s.answers[q.id]=optionId;
    if(s.mode!=='exam')state.feedback[q.id]=r;
    setSaved();
  } catch(e){toast(e.message,true);if(s.mode==='exam')await refreshSession();}
  finally{state.busy=false;if(state.page==='session')renderSession();}
}
function confirmFinish() {
  const s=state.session;if(!s)return;
  const unanswered=s.questions.filter(q=>s.answers?.[q.id]==null).length;
  showModal(s.mode==='exam'?'确认交卷？':'完成这次练习？','交卷后可以查看完整结果与逐题解析。',`<div class="modal-count">${Object.keys(s.answers || {}).length}<small>/ ${s.questions.length} 题已作答</small></div><p class="modal-warning">${unanswered?`还有 <strong>${unanswered} 道题未作答</strong>，交卷后会计入未答题。<br><br>`:''}已作答的错题会自动加入错题本。${s.mode==='exam'?'提交整卷后，本次考试将结束。':'本组练习结束后，你可以随时回看结果。'}</p>`,`<button class="button primary" data-action="submit-finish">确认${s.mode==='exam'?'交卷':'完成'} ${icon('check',14)}</button>`);
}
function confirmNextSection() {
  const s=state.session,sec=currentSection(),next=s.sections?.[s.activeSectionIndex+1];if(!sec||!next)return confirmFinish();
  const unanswered=s.questions.filter(q=>q.sectionId===sec.id&&s.answers?.[q.id]==null).length;
  showModal('提交本节，进入下一节？',sec.title,`<p class="modal-warning">${unanswered?`本节还有 <strong>${unanswered} 道题未作答</strong>。<br><br>`:''}${next.audioPlan&&next.restBeforeSeconds?'提交后先进入 10 分钟休息，可随时立即开始听力。':'提交后将开始“'+esc(next.title)+'”的计时。'}提交后无法返回修改本节答案。</p>`,`<button class="button primary" data-action="submit-next-section">提交并继续 ${icon('arrow',14)}</button>`);
}
async function finish() {
  if(state.busy)return;state.busy=true;const button=$('[data-action="submit-finish"]');if(button)button.disabled=true;
  try{state.result=await api(`/api/sessions/${encodeURIComponent(state.session.id)}/finish`,{});state.session.status='finished';state.session.result=state.result;$('#modal').close();location.hash=`result/${encodeURIComponent(state.session.id)}`;}catch(e){toast(e.message,true);if(button)button.disabled=false;}finally{state.busy=false;}
}
async function nextSection() {
  if(state.busy)return;state.busy=true;
  try{const s=await api(`/api/sessions/${encodeURIComponent(state.session.id)}/next-section`,{});state.session=s;loadedSessionAt=Date.now();state.feedback=s.feedback || {};$('#modal').close();renderSession();toast(s.phase==='break'?'已进入听力前休息。':`已进入${currentSection()?.title || '下一节'}`);}catch(e){toast(e.message,true);}finally{state.busy=false;}
}
async function refreshSession() {
  const previous=state.session;if(!previous)return;
  const s=await api(`/api/sessions/${encodeURIComponent(previous.id)}`);
  if(state.page!=='session' || state.session?.id!==s.id)return;
  state.session=s;loadedSessionAt=Date.now();state.feedback=s.feedback || {};
  if(s.status==='finished'){location.hash=`result/${encodeURIComponent(s.id)}`;return;}
  if(s.activeSectionIndex!==previous.activeSectionIndex)toast(`上节时间结束，已进入${currentSection()?.title || '下一节'}`);
  renderSession();
}
function updateTimer() {
  if(state.page!=='session' || !state.session)return;
  const s=state.session,el=$('#timer');if(!el)return;
  const deadline=s.sectionDeadline || s.deadline;
  if(s.mode==='exam'&&deadline){
    const remaining=s.focus?.paused?s.focus.remainingMs/1000:s.listening?.paused?(s.listening.totalDurationMs-s.listening.elapsedMs)/1000:(Number(deadline)-Date.now()-(examAudio.active?examAudio.clockOffset:0))/1000;
    if(!examFocus.locked||s.focus?.paused)el.textContent=timerText(remaining);el.classList.toggle('urgent',s.phase!=='break'&&remaining<=300);
    if(remaining<=0&&!examFocus.locked&&!timerBusy&&!state.busy){timerBusy=true;refreshSession().catch(e=>toast(e.message,true)).finally(()=>{timerBusy=false;});}
  }else el.textContent=timerText(Number(s.elapsedSeconds || 0)+(Date.now()-loadedSessionAt)/1000);
}
async function toggleFavorite(id,source='session') {
  const r=await api('/api/favorites',{questionId:id});
  if(source==='session'){const q=state.session?.questions.find(q=>q.id===id);if(q)q.favorite=r.favorite;renderSession();}
  else if(source==='result'){const q=state.result?.questions.find(q=>q.id===id);if(q)q.favorite=r.favorite;renderResult();}
  else{const q=state.review.find(q=>q.id===id);if(q)q.favorite=r.favorite;if(state.page==='favorites'&&!r.favorite)state.review=state.review.filter(q=>q.id!==id);renderReview();}
  toast(r.favorite?'已加入收藏':'已取消收藏');
}

async function handleAction(button) {
  const action=button.dataset.action==='focus-finish'?'finish':button.dataset.action;if(button.disabled)return;
  if(action==='resume-exam-focus'){await examFocus.resume();return;}
  if(examFocus.locked&&!['finish','submit-finish','close-modal'].includes(action))return;
  if(examFocus.id&&['leave-session','pause-leave'].includes(action)){confirmFinish();return;}
  if(action==='close-modal'){$('#modal').close();return;}
  if(action==='start-listening'){await beginListening();return;}
  if(action==='resume-listening'){await beginListening(true);return;}
  if(action==='pause-leave'){await pauseAndLeave();return;}
  if(action==='follow-listening'){const p=examAudio.getPosition();const index=state.session.questions.findIndex(q=>p?.item?.questionIds.includes(q.id));if(index>=0)await goQuestion(index);return;}
  if(action==='retry'){await route();return;}
  if(action==='category'){state.practiceCategory=integer(button.dataset.id);if(state.page==='practice')renderPractice();else location.hash='practice';return;}
  if(action==='filter-category'){state.practiceCategory=integer(button.dataset.id);renderPractice();return;}
  if(action==='setup-practice'){setupPractice(button.dataset.type);return;}
  if(action==='setup-review'){setupPractice(null,button.dataset.kind);return;}
  if(action==='practice-one'){setupPractice(null,button.dataset.kind,button.dataset.id);return;}
  if(action==='setup-exam'){setupExam(button.dataset.id);return;}
  if(action==='count-choice'){state.selectedCount=['all','custom'].includes(button.dataset.count)?button.dataset.count:integer(button.dataset.count);updatePracticeCount();if(state.selectedCount==='custom'){$('#practice-custom-count').focus();$('#practice-custom-count').select();}return;}
  if(action==='create-practice'){await createSession(false);return;}
  if(action==='create-exam'){await createSession(true);return;}
  if(action==='answer'){await answer(button.dataset.option);return;}
  if(action==='prev'){await goQuestion(state.session.currentIndex-1);return;}
  if(action==='next'){
    const s=state.session,sec=currentSection();
    if(s.mode==='exam'&&sec){const next=s.questions.findIndex((q,i)=>i>s.currentIndex&&q.sectionId===sec.id);if(next>=0)await goQuestion(next);else confirmNextSection();}
    else if(s.currentIndex>=s.questions.length-1)confirmFinish();else await goQuestion(s.currentIndex+1);return;
  }
  if(action==='go-question'){await goQuestion(integer(button.dataset.index));return;}
  if(action==='go-section'){const i=state.session.questions.findIndex(q=>q.sectionId===button.dataset.id);if(i>=0)await goQuestion(i);return;}
  if(action==='flag'){const s=state.session,q=currentQuestion();s.flags ||= [];s.flags=s.flags.includes(q.id)?s.flags.filter(id=>id!==q.id):[...s.flags,q.id];renderSession();await checkpoint();return;}
  if(action==='favorite'){await toggleFavorite(currentQuestion().id);return;}
  if(action==='review-favorite'){await toggleFavorite(button.dataset.id,'review');return;}
  if(action==='result-favorite'){await toggleFavorite(button.dataset.id,'result');return;}
  if(action==='readings'){state.showReadings=!state.showReadings;renderSession();return;}
  if(action==='finish'){confirmFinish();return;}
  if(action==='next-section'){confirmNextSection();return;}
  if(action==='submit-next-section'){await nextSection();return;}
  if(action==='submit-finish'){await finish();return;}
  if(action==='leave-session'){if(state.session.listening){showModal('暂停并退出听力考试？','已答题目和录音位置将保留。','<p class="modal-warning">继续考试时从暂停位置恢复，录音不会从头重播。</p>','<button class="button primary" data-action="pause-leave">保存并暂停</button>');return;}await checkpoint();location.hash=state.session.mode==='exam'?'exam':'dashboard';toast('进度已保存，下次可以接着练。');return;}
  if(action==='result-filter'){state.reviewResultFilter=button.dataset.kind;renderResult();return;}
  if(action==='review-page'){state.reviewPage=integer(button.dataset.page);renderReview();window.scrollTo({top:0,behavior:'smooth'});return;}
  if(action==='import-bank'){$('#bank-file').click();return;}
  if(action==='restore'){$('#restore-file').click();return;}
  if(action==='reset-progress'){
    showModal('重置所有学习进度？','这将清空 N1–N5 所有等级的学习记录。','<div class="reset-confirm-warning"><p>将清除练习与模拟考试记录、作答进度与统计、错题本和收藏。</p><p>题库与已下载的音频会保留。重置后，可通过已有备份恢复学习记录。</p></div><p class="reset-backup-link">需要保留记录时，可先 <a href="/api/export" download="日语研习室-重置前备份.json">导出学习备份</a>。</p>','<button type="button" class="button destructive" data-action="confirm-reset-progress">确认重置所有学习进度</button>');return;
  }
  if(action==='confirm-reset-progress'){await resetAllProgress();return;}
  if(action==='confirm-restore'){
    const result=await api('/api/restore',state.restorePayload);state.restorePayload=null;$('#modal').close();await loadCatalog();renderData();toast(result.message || '备份已恢复。');return;
  }
}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(b)handleAction(b).catch(e=>toast(e.message,true));});
document.addEventListener('error',ev=>{if(ev.target.tagName==='IMG'){const figure=ev.target.closest('.document-figure');const fallback=figure?.querySelector('.image-fallback');if(fallback){ev.target.hidden=true;fallback.hidden=false;}}},true);
document.addEventListener('change',async ev=>{
  try{
    if(ev.target.id==='paper-year'){state.paperYear=ev.target.value;renderExam();}
    if(ev.target.id==='bank-file'&&ev.target.files[0]){
      const file=ev.target.files[0];if(file.size>100*1024*1024)throw new Error('题库文件超过 100 MB，请拆分后再导入。');
      const data=JSON.parse(await file.text());const r=await api('/api/import',data);await loadCatalog();renderData();toast(r.message || `题库已导入${r.questionCount?`，共 ${r.questionCount} 题`:''}。`);
    }
    if(ev.target.id==='restore-file'&&ev.target.files[0]){
      const file=ev.target.files[0];if(file.size>100*1024*1024)throw new Error('备份文件过大。');state.restorePayload=JSON.parse(await file.text());
      showModal('恢复这份学习备份？','请确认选择的是日语研习室导出的备份文件。','<p class="modal-warning">恢复操作会用备份中的练习记录、错题、收藏与进度替换当前学习记录。请先导出当前记录再恢复备份。</p>','<button class="button primary" data-action="confirm-restore">恢复备份</button>');
    }
  }catch(e){toast(e instanceof SyntaxError?'文件格式无法读取，请选择有效的 JSON 文件。':e.message,true);ev.target.value='';}
});
let searchDebounce;
document.addEventListener('input',ev=>{if(ev.target.id==='review-search'){const cursor=ev.target.selectionStart;clearTimeout(searchDebounce);searchDebounce=setTimeout(()=>{state.reviewQuery=ev.target.value;state.reviewPage=0;renderReview();const search=$('#review-search');search.focus();search.setSelectionRange(cursor,cursor);},180);}});
document.addEventListener('input',ev=>{if(ev.target.id==='exam-volume')examAudio.setVolume(ev.target.value);});
document.addEventListener('input',ev=>{if(ev.target.id==='practice-custom-count')updatePracticeCount();});
$('#level').addEventListener('change',()=>{if(state.page==='session'){toast('请先保存并离开当前练习，再切换目标等级。');$('#level').value=state.level;return;}state.level=$('#level').value;localStorage.setItem('jlpt-level',state.level);state.paperYear='all';route();});
$('#theme-button').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('jlpt-theme',theme);renderNav();});
$('#modal').addEventListener('click',ev=>{if(ev.target===$('#modal')){const rect=ev.target.getBoundingClientRect();if(ev.clientX<rect.left||ev.clientX>rect.right||ev.clientY<rect.top||ev.clientY>rect.bottom)$('#modal').close();}});
document.addEventListener('keydown',ev=>{
  if(state.page!=='session'||examFocus.locked||state.session?.phase==='break'||state.session?.listening?.paused||$('#modal').open||state.busy||ev.altKey||ev.ctrlKey||ev.metaKey||/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName))return;
  const q=currentQuestion();if(!q)return;
  if(/^[1-4]$/.test(ev.key)){const option=q.options[Number(ev.key)-1];if(option){ev.preventDefault();answer(option.id).catch(e=>toast(e.message,true));}}
  if(ev.key==='ArrowLeft'){ev.preventDefault();goQuestion(state.session.currentIndex-1);}
  if(ev.key==='ArrowRight'||ev.key==='Enter'){ev.preventDefault();const next=$('[data-action="next"]');if(next)next.click();}
  if(ev.key.toLowerCase()==='f'){ev.preventDefault();toggleFavorite(q.id).catch(e=>toast(e.message,true));}
});
window.addEventListener('hashchange',()=>{window.scrollTo({top:0});route();});
window.addEventListener('storage',ev=>{if(ev.key==='jlpt-progress-reset-at'&&ev.newValue){clearLearningView();$('#modal').close();if(location.hash!=='#data')location.hash='data';else route();toast('学习进度已在另一个窗口中重置。');}});
window.addEventListener('beforeunload',()=>{if(state.page==='session'&&state.session?.status==='active'){const s=state.session;fetch(`/api/sessions/${encodeURIComponent(s.id)}/checkpoint`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentIndex:s.currentIndex,flags:s.flags || []}),keepalive:true}).catch(()=>{});if(s.mode==='exam')fetch(`/api/sessions/${encodeURIComponent(s.id)}/pause-focus`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"reason":"refresh"}',keepalive:true}).catch(()=>{});}});
document.documentElement.dataset.theme=localStorage.getItem('jlpt-theme') || 'light';
setInterval(updateTimer,1000);
route();
