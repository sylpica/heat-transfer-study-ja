// Browser-independent learning rules shared by the app and its automated checks.
import { calculateFinEfficiency } from './fin-efficiency.mjs';
import { calculateExchanger } from './heat-exchanger.mjs';
import { calculateSlabTransient } from './transient-slab.mjs';
import { calculateRadiationEnclosure } from './radiation-enclosure.mjs';
import { calculateCylindricalInsulation } from './cylindrical-insulation.mjs';
import { calculateSemiInfinite } from './semi-infinite-solid.mjs';
import { calculateFlatPlateConvection } from './forced-convection-flat-plate.mjs';
import { calculatePipeConvection } from './turbulent-pipe-convection.mjs';
import { calculateCylinderCrossflow } from './cylinder-crossflow.mjs';
import { calculateNaturalConvection } from './natural-convection-vertical.mjs';
import { calculateLaminarPipe } from './laminar-pipe-convection.mjs';
import { calculateFilmCondensation } from './laminar-film-condensation.mjs';
import { calculateBinaryDiffusion } from './binary-gas-diffusion.mjs';
import { calculateNucleateBoiling } from './pool-boiling-nucleate.mjs';
import { calculateCriticalHeatFlux } from './pool-boiling-chf.mjs';
// Calculators for the simulator modes added after the original five. Stored
// comparison conditions for these modes are valid only when the mode's own
// calculator accepts them; unknown modes keep failing validation exactly as
// before, so older saved data is never reinterpreted.
export const SIM_MODEL_CALCULATORS = {
  fin: calculateFinEfficiency,
  exchanger: calculateExchanger,
  slab: calculateSlabTransient,
  enclosure: calculateRadiationEnclosure,
  cylinder: calculateCylindricalInsulation,
  halfspace: calculateSemiInfinite,
  flatplate: calculateFlatPlateConvection,
  pipe: calculatePipeConvection,
  crossflow: calculateCylinderCrossflow,
  natural: calculateNaturalConvection,
  laminarpipe: calculateLaminarPipe,
  condensation: calculateFilmCondensation,
  diffusion: calculateBinaryDiffusion,
  nucleate: calculateNucleateBoiling,
  chf: calculateCriticalHeatFlux
};
export function calculateSimulationModel(mode, values) {
  if (mode === 'transient') return calculateLumpedCooling(values);
  if (Object.hasOwn(SIM_MODEL_CALCULATORS, mode)) return SIM_MODEL_CALCULATORS[mode](values);
  return calculateHeatTransfer(mode, values);
}
export const DATA_FORMAT = 'heat-study-ja-learning-data';
export function createEmptyState() {
  return { schemaVersion: 1, settings: { theme: 'system', contentLanguage: 'ja', fontScale: 1, lineHeight: 1.8, width: 'reading' },
    lastSection: '1.1', readerPositions: {}, readSections: {}, bookmarks: [], questionBookmarks: [], termBookmarks: [], attempts: [],
    flashcards: { mode: 'list', backFirst: false, sort: 'default', scope: 'all', chapter: 'all', category: 'all', order: null, index: 0, flipped: false },
    mistakeNotes: {}, questionReports: {}, notes: [], reviews: {}, completedReviews: {}, sessions: [],
    plan: { active: false, goal: '', targetDate: '', minutesPerDay: 15 }, simComparisons: {}, activities: [], quizDraft: null };
}
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string';
const finite = v => typeof v === 'number' && Number.isFinite(v);
const instant = v => new Date(v).getTime();
const time = v => (text(v) || finite(v)) && Number.isFinite(instant(v));
export function validDay(v) {
  if (!text(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
}
export function localDay(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isFinite(+d) ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
}
export function shiftMonth(day, offset) {
  if (!validDay(day) || !Number.isInteger(offset)) return '';
  const d = new Date(`${day}T12:00:00`), old = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+offset);
  d.setDate(Math.min(old, new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return localDay(d);
}
function unsafeKeys(v, depth=0) {
  if (depth>24) return true;
  if (!v || typeof v!=='object') return false;
  return Object.entries(v).some(([k,x]) => ['__proto__','constructor','prototype'].includes(k) || unsafeKeys(x,depth+1));
}
const optional = (o,k,check) => o[k] === undefined || check(o[k]);
const attemptOK = a => record(a) && text(a.questionId) && a.questionId.length>0 && typeof a.correct==='boolean' && time(a.at)
  && optional(a,'id',text) && optional(a,'selected',v=>Number.isInteger(v)&&v>=0&&v<4)
  && optional(a,'confidence',v=>['high','medium','low','unsure'].includes(v)) && optional(a,'mode',text)
  && optional(a,'questionRevision',v=>text(v)&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/.test(v));
// Two attempt rows describe the same answer when every answer-bearing field
// agrees. Derived display text (selectedText/correctText) is excluded: a
// backup written by another build may phrase it differently for one answer.
function attemptKey(a) {
  return JSON.stringify([a.questionId,a.correct,instant(a.at),a.selected??null,a.confidence??null,a.mode??null,a.questionRevision??'initial']);
}
function dedupeAttempts(rows) {
  const byId=new Map(),byKey=new Map(),out=[];
  for (const a of rows) {
    const key=attemptKey(a);
    const existing=(a.id?byId.get(a.id):undefined)||byKey.get(key);
    if (existing) {
      // Keep a single row per answer; when only one copy carries an id, the
      // id-bearing copy wins so references to it stay meaningful.
      if (!existing.id&&a.id) { out[out.indexOf(existing)]=a; byId.set(a.id,a); byKey.set(key,a); }
      continue;
    }
    out.push(a); if (a.id) byId.set(a.id,a); byKey.set(key,a);
  }
  return out;
}
// Flashcard preferences are learner settings, like the display settings:
// every field is optional in stored/imported data (older records predate
// them) but a present field must hold a value the app itself could write.
const flashcardPrefsOK = v => record(v)
  && optional(v,'mode',x=>['list','cards'].includes(x))
  && optional(v,'backFirst',x=>typeof x==='boolean')
  && optional(v,'flipped',x=>typeof x==='boolean')
  && optional(v,'sort',x=>['default','kana','section'].includes(x))
  && optional(v,'scope',x=>['all','bookmarks'].includes(x))
  && optional(v,'chapter',x=>text(x)&&x.length<=8)
  && optional(v,'category',x=>text(x)&&x.length<=200)
  && optional(v,'order',x=>x===null||(Array.isArray(x)&&x.length<=20000&&x.every(text)))
  && optional(v,'index',x=>Number.isInteger(x)&&x>=0);
export function validateLearningData(data, {stored=false}={}) {
  const invalid = message => `${message}現在の記録は変更していません。`;
  if (!record(data) || data.schemaVersion!==1 || (!stored && data.format!==DATA_FORMAT)) return invalid('対応する学習データ形式ではありません。');
  if (unsafeKeys(data)) return invalid('データの階層または項目名が正しくありません。');
  for (const [key,label] of Object.entries({attempts:'回答履歴',bookmarks:'本文のしおり',questionBookmarks:'問題ブックマーク',sessions:'学習セッション'})) if (!Array.isArray(data[key])) return invalid(`「${label}」の形式が正しくありません。`);
  for (const key of ['settings','plan','mistakeNotes']) if (!record(data[key])) return invalid('設定・計画・間違いノートの形式が正しくありません。');
  if (data.attempts.length>100000 || data.bookmarks.length>20000 || data.sessions.length>20000) return invalid('データ件数の上限を超えています。');
  if (!data.attempts.every(attemptOK)) return invalid('回答履歴の日時・選択肢・自信度を確認してください。');
  if (!data.bookmarks.every(b=>record(b)&&text(b.id)&&text(b.sectionId)&&text(b.note)&&time(b.createdAt)&&optional(b,'position',v=>finite(v)&&v>=0)&&optional(b,'blockId',text)&&optional(b,'language',v=>['ja','en'].includes(v)))) return invalid('しおりの形式が正しくありません。');
  if (!data.questionBookmarks.every(text)) return invalid('問題ブックマークの形式が正しくありません。');
  if (!optional(data,'termBookmarks',v=>Array.isArray(v)&&v.length<=20000&&v.every(text))) return invalid('用語ブックマークの形式が正しくありません。');
  if (!optional(data,'flashcards',flashcardPrefsOK)) return invalid('単語帳の設定の形式が正しくありません。');
  if (!data.sessions.every(s=>record(s)&&validDay(s.date)&&Number.isInteger(s.total)&&s.total>=0&&Number.isInteger(s.correct)&&s.correct>=0&&s.correct<=s.total&&time(s.startedAt)&&optional(s,'finishedAt',time)&&optional(s,'activeSeconds',v=>finite(v)&&v>=0)&&optional(s,'answers',v=>Array.isArray(v)&&v.every(attemptOK)))) return invalid('学習セッションの形式が正しくありません。');
  const s=data.settings;
  if (!optional(s,'theme',v=>['system','light','dark'].includes(v)) || !optional(s,'contentLanguage',v=>['ja','en'].includes(v)) || !optional(s,'fontScale',v=>finite(v)&&v>=0.7&&v<=2) || !optional(s,'lineHeight',v=>finite(v)&&v>=1.2&&v<=3) || !optional(s,'width',v=>['reading','wide'].includes(v))) return invalid('表示設定の値が正しくありません。');
  const p=data.plan;
  if (!optional(p,'active',v=>typeof v==='boolean') || !optional(p,'goal',text) || !optional(p,'targetDate',v=>v===''||validDay(v)) || !optional(p,'minutesPerDay',v=>finite(v)&&v>=5&&v<=60)) return invalid('学習計画の日付・時間が正しくありません。');
  if (!Object.values(data.mistakeNotes).every(n=>record(n)&&['reason','memory','nextTime'].every(k=>optional(n,k,text))&&optional(n,'updatedAt',time))) return invalid('間違いノートの形式が正しくありません。');
  if (!optional(data,'notes',v=>Array.isArray(v)&&v.every(n=>record(n)&&text(n.id)&&text(n.text)&&text(n.sectionId)&&time(n.createdAt)&&optional(n,'title',text)))) return invalid('学習メモの形式が正しくありません。');
  if (!optional(data,'reviews',v=>record(v)&&Object.values(v).every(r=>record(r)&&validDay(r.dueDate)&&optional(r,'suggestedDays',d=>d===null||(finite(d)&&d>0))&&optional(r,'lastAnsweredAt',time)&&optional(r,'lastReviewedAt',time)))) return invalid('復習予定の形式が正しくありません。');
  if (!optional(data,'completedReviews',v=>record(v)&&Object.values(v).every(time))) return invalid('復習完了記録の日時が正しくありません。');
  if (!optional(data,'questionReports',v=>record(v)&&Object.values(v).every(a=>Array.isArray(a)&&a.every(r=>record(r)&&text(r.category)&&text(r.message)&&time(r.at))))) return invalid('問題報告の形式が正しくありません。');
  if (!optional(data,'readerPositions',v=>record(v)&&Object.values(v).every(p=>(finite(p)&&p>=0)||(record(p)&&finite(p.scrollY)&&p.scrollY>=0&&optional(p,'blockId',text)&&optional(p,'updatedAt',time))))) return invalid('読書位置の形式が正しくありません。');
  if (!optional(data,'readSections',v=>record(v)&&Object.values(v).every(x=>typeof x==='boolean'))) return invalid('読了記録の形式が正しくありません。');
  if (!optional(data,'lastSection',text)) return invalid('最後に読んだ節の形式が正しくありません。');
  if (!optional(data,'simComparisons',v=>record(v)&&Object.entries(v).every(([mode,values])=>record(values)&&!calculateSimulationModel(mode,values).error))) return invalid('比較用シミュレーター条件が正しくありません。');
  if (!optional(data,'activities',v=>Array.isArray(v)&&v.length<=100000&&v.every(a=>record(a)&&text(a.id)&&validDay(a.date)&&['reading','practice','review','simulation','glossary'].includes(a.kind)&&finite(a.seconds)&&a.seconds>=0&&a.seconds<=86400&&time(a.updatedAt)&&['sectionId','sessionId','field'].every(k=>optional(a,k,text))))) return invalid('学習時間の記録の形式が正しくありません。');
  if (!optional(data,'quizDraft',v=>v===null||quizDraftOK(v))) return invalid('中断した演習の形式が正しくありません。');
  if (!stored) {
    // Restore/import only: reject records the app itself would never write
    // (duplicate answers, unbounded strings, unbounded collections) and name
    // the cause. Stored data skips these checks so a learner can never be
    // locked out of their own record; loading heals duplicates instead.
    const seenAttempts=new Set();
    for (const a of data.attempts) { const k=attemptKey(a); if (seenAttempts.has(k)) return invalid('回答履歴に重複した記録が含まれています。'); seenAttempts.add(k); }
    // The app never writes two rows with the same id in any of these
    // collections; a file that does would silently double-count study time
    // or drop an answer when normalized, so reject it here like the
    // duplicate-answer check above.
    const dupId=(rows,label)=>{ const seen=new Set(); for (const r of rows||[]) { if (!r||typeof r.id!=='string'||!r.id) continue; if (seen.has(r.id)) return invalid(`${label}に重複した記録が含まれています。`); seen.add(r.id); } return ''; };
    const dupError=dupId(data.attempts,'回答履歴')||dupId(data.sessions,'学習セッション')||dupId(data.activities,'学習時間の記録')||dupId(data.notes,'学習メモ')||dupId(data.bookmarks,'本文のしおり');
    if (dupError) return dupError;
    const tooLong=v=>typeof v==='string'&&v.length>10000;
    if ((Array.isArray(data.notes)&&data.notes.some(n=>tooLong(n.text)||tooLong(n.title)))
      || data.bookmarks.some(b=>tooLong(b.note))
      || Object.values(data.mistakeNotes).some(n=>['reason','memory','nextTime'].some(k=>tooLong(n[k])))
      || tooLong(data.plan.goal)
      || (record(data.questionReports)&&Object.values(data.questionReports).some(list=>list.some(r=>tooLong(r.category)||tooLong(r.message)))))
      return invalid('メモやノートの文字数が長すぎます（1項目あたり10,000文字まで）。');
    const entryCount=v=>record(v)?Object.keys(v).length:0;
    if ((Array.isArray(data.notes)&&data.notes.length>20000)
      || entryCount(data.mistakeNotes)>20000 || entryCount(data.reviews)>20000
      || entryCount(data.completedReviews)>20000 || entryCount(data.readerPositions)>20000
      || entryCount(data.readSections)>20000)
      return invalid('メモ・復習記録などの件数が上限を超えています。');
    if (record(data.questionReports)) {
      const lists=Object.values(data.questionReports);
      if (lists.some(list=>list.length>1000)||lists.reduce((n,list)=>n+list.length,0)>20000)
        return invalid('問題報告の件数が上限を超えています。');
    }
    let size=0; try { size=JSON.stringify(data).length; } catch { return invalid('データの形式が正しくありません。'); }
    if (size>16000000) return invalid('データ全体の容量が上限を超えています。');
  }
  return '';
}
export function normalizeLearningData(data) {
  const out=createEmptyState();
  for (const k of Object.keys(out)) if (data[k]!==undefined) out[k]=structuredClone(data[k]);
  out.settings={...createEmptyState().settings,...out.settings}; out.plan={...createEmptyState().plan,...out.plan};
  out.attempts.sort((a,b)=>instant(a.at)-instant(b.at));
  out.attempts=dedupeAttempts(out.attempts);
  // Bookmarks are addressed by id everywhere they are listed, edited, or
  // deleted, so collapse duplicate ids (keeping the newest copy) instead of
  // letting a restored file surface the same bookmark twice. Merge already
  // keyed rows by id; this extends the same healing to plain loads/imports.
  const bookmarkById=new Map();
  for (const b of out.bookmarks) {
    const key=b&&b.id?b.id:JSON.stringify(b);
    const prev=bookmarkById.get(key);
    if (!prev||instant(b&&b.createdAt)>=instant(prev&&prev.createdAt)) bookmarkById.set(key,b);
  }
  out.bookmarks=[...bookmarkById.values()];
  // Sessions, activities, and notes are also addressed by id (calendar
  // totals sum activities, session lists render one row per session), so
  // heal duplicate ids the same way instead of double-counting them.
  const dedupeRowsById=rows=>{ const byId=new Map(); for (const r of rows) { const key=r&&r.id?r.id:JSON.stringify(r); const prev=byId.get(key); if (!prev||updated(r)>=updated(prev)) byId.set(key,r); } return [...byId.values()]; };
  out.sessions=dedupeRowsById(out.sessions);
  out.activities=dedupeRowsById(out.activities);
  out.notes=dedupeRowsById(out.notes);
  // Session records embed a snapshot of their answers. Heal duplicate rows
  // inside a snapshot with the same content key as attempts; the session
  // totals are stored separately and are deliberately not recomputed here.
  for (const s of out.sessions) if (s&&Array.isArray(s.answers)) s.answers=dedupeAttempts(s.answers);
  out.questionBookmarks=[...new Set(out.questionBookmarks)];
  out.termBookmarks=[...new Set(Array.isArray(out.termBookmarks)?out.termBookmarks:[])];
  // Flashcard preferences merge over the defaults so a record written by an
  // older build (or a partial import) still yields a complete settings set.
  out.flashcards={...createEmptyState().flashcards,...(record(out.flashcards)?out.flashcards:{})};
  if(out.flashcards.order!==null&&!Array.isArray(out.flashcards.order))out.flashcards.order=null;
  if(!Number.isInteger(out.flashcards.index)||out.flashcards.index<0)out.flashcards.index=0;
  out.sessions.sort((a,b)=>instant(a.finishedAt??a.startedAt)-instant(b.finishedAt??b.startedAt));
  return out;
}
const updated = v => record(v) ? Math.max(-Infinity,...[v.updatedAt,v.at,v.createdAt,v.lastReviewedAt,v.lastAnsweredAt].filter(x=>text(x)||finite(x)).map(instant).filter(Number.isFinite)) : -Infinity;
function newest(a,b) { return updated(b)>updated(a) ? b : a; }
function mergeMap(a,b) { const out={...a}; for(const [k,v] of Object.entries(b)) out[k]=k in out ? newest(out[k],v) : v; return out; }
function mergeRows(a,b) {
  const map=new Map();
  for(const item of [...a,...b]) { const key=item.id||JSON.stringify(item); map.set(key,map.has(key)?newest(map.get(key),item):item); }
  return [...map.values()];
}
export function mergeLearningData(current, incoming) {
  const a=normalizeLearningData(current), b=normalizeLearningData(incoming);
  const out={...a,settings:{...a.settings,...incoming.settings},plan:{...a.plan,...incoming.plan}};
  for(const k of ['attempts','sessions','bookmarks','notes']) out[k]=mergeRows(a[k],b[k]);
  out.attempts.sort((x,y)=>instant(x.at)-instant(y.at));
  // mergeRows keys rows by id when one exists, so an id-bearing row and an
  // id-less copy of the same answer survive it as two rows; collapse them.
  out.attempts=dedupeAttempts(out.attempts);
  out.sessions.sort((x,y)=>instant(x.finishedAt??x.startedAt)-instant(y.finishedAt??y.startedAt));
  out.questionBookmarks=[...new Set([...a.questionBookmarks,...b.questionBookmarks])];
  out.termBookmarks=[...new Set([...a.termBookmarks,...b.termBookmarks])];
  // Legacy exports have no flashcard preferences. Normalizing them supplies
  // defaults for replacement, but those defaults must not erase a current
  // deck's position or shuffled order during an additive import.
  out.flashcards={...a.flashcards,...(record(incoming.flashcards)?incoming.flashcards:{})};
  for(const k of ['mistakeNotes','readerPositions','reviews']) out[k]=mergeMap(a[k],b[k]);
  out.readSections={...a.readSections}; for(const [k,v] of Object.entries(b.readSections)) out.readSections[k]=Boolean(a.readSections[k]||v);
  out.questionReports={...a.questionReports}; for(const [k,v] of Object.entries(b.questionReports)) out.questionReports[k]=mergeRows(a.questionReports[k]||[],v);
  out.completedReviews={...a.completedReviews}; for(const [k,v] of Object.entries(b.completedReviews)) if(!out.completedReviews[k]||instant(v)>instant(out.completedReviews[k])) out.completedReviews[k]=v;
  out.simComparisons={...a.simComparisons,...b.simComparisons};
  out.activities=mergeRows(a.activities,b.activities);
  out.quizDraft=a.quizDraft&&b.quizDraft?newest(a.quizDraft,b.quizDraft):a.quizDraft||b.quizDraft;
  if(out.quizDraft&&out.sessions.some(s=>s.id===out.quizDraft.id))out.quizDraft=null;
  return out;
}

export function questionFingerprint(question) {
  return JSON.stringify([question.id,question.prompt,question.choices,question.answer,question.figure||null,question.solutionSteps||question.hints||[],question.revision||'initial']);
}
export function quizChoiceOrder(sessionId, questionId) {
  const order=[0,1,2,3];
  if(!sessionId||!questionId)return order;
  let seed=2166136261;
  for(const char of `${sessionId}:${questionId}`)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  for(let i=3;i>0;i--){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const j=(seed>>>0)%(i+1);[order[i],order[j]]=[order[j],order[i]];}
  return order;
}
export function quizDraftOK(q) {
  return record(q)&&text(q.id)&&Array.isArray(q.ids)&&q.ids.length>0&&q.ids.length<=500&&q.ids.every(text)&&new Set(q.ids).size===q.ids.length
    &&Number.isInteger(q.index)&&q.index>=0&&q.index<q.ids.length&&finite(q.startedAt)&&time(q.startedAt)&&time(q.updatedAt)
    &&record(q.signatures)&&q.ids.every(id=>text(q.signatures[id]))&&Array.isArray(q.answers)&&q.answers.length<=q.index+1
    &&q.answers.every((a,i)=>a===null||a===undefined||(attemptOK(a)&&a.questionId===q.ids[i]))
    &&q.ids.slice(0,q.index).every((id,i)=>q.answers[i]?.questionId===id)
    &&(q.selected===null||(Number.isInteger(q.selected)&&q.selected>=0&&q.selected<4))
    &&['high','medium','low','unsure'].includes(q.confidence)&&Number.isInteger(q.hintCount)&&q.hintCount>=0;
}
export function quizResumeIssue(draft,questions) {
  if(!quizDraftOK(draft))return '中断した演習の形式を読み取れません。回答履歴は保持しています。';
  const byId=new Map(questions.map(q=>[q.id,q]));
  if(draft.ids.some(id=>!byId.has(id)))return 'このセットの問題が現在の教材にありません。該当する教材を読み込むと再開できます。';
  if(draft.ids.some(id=>questionFingerprint(byId.get(id))!==draft.signatures[id]))return '問題の内容が更新されています。以前の回答履歴を保持し、新しいセットで解き直してください。';
  return '';
}
export function splitStudyInterval(from,to) {
  if(!finite(from)||!finite(to)||to<=from||to-from>30000)return [];
  const result=[];let cursor=from;
  while(cursor<to){const d=new Date(cursor),midnight=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime(),end=Math.min(to,midnight);result.push({date:localDay(d),seconds:(end-cursor)/1000});cursor=end;}
  return result;
}
export function recordStudyActivity(records,context,from,to,pageId) {
  if(!context)return records;
  const result=records.map(a=>({...a}));
  for(const interval of splitStudyInterval(from,to)){
    const id=JSON.stringify([pageId,interval.date,context.kind,context.sectionId||'',context.sessionId||'',context.field||'']);
    const prior=result.find(a=>a.id===id),updatedAt=new Date(to).toISOString();
    if(prior){prior.seconds+=interval.seconds;prior.updatedAt=updatedAt;}
    else result.push({id,...context,...interval,updatedAt});
  }
  return result;
}
// A stored score for an older question must never count as a correct response
// to a newly revised question. Legacy records without a revision are 'initial'.
export function isCurrentQuestionAnswer(question,answer) {
  return Boolean(question&&answer&&(answer.questionRevision??'initial')===(question.revision??'initial'));
}

// Keep historical session snapshots intact. An imported/older summary can
// disagree with its optional answer details; report that distinction rather
// than silently rewriting history or treating the stored count as verified.
export function sessionSummaryMismatch(session) {
  if (!Array.isArray(session?.answers)) return false;
  return session.total !== session.answers.length
    || session.correct !== session.answers.filter(answer => answer.correct === true).length;
}
export function fieldProgress(questions,attempts) {
  const byId=new Map(questions.map(q=>[q.id,q])),latest=new Map();
  for(const a of attempts)if(byId.has(a.questionId)&&(!latest.has(a.questionId)||instant(a.at)>=instant(latest.get(a.questionId).at)))latest.set(a.questionId,a);
  const current=[...latest.entries()].filter(([id,a])=>isCurrentQuestionAnswer(byId.get(id),a));
  const answered=current.length,correct=current.filter(([,a])=>a.correct===true).length;
  return {answered,correct,enough:answered>=3,ratio:answered?correct/answered:0,total:questions.length,outdated:latest.size-answered};
}
export function studyDuration(seconds) {
  const numeric=Number(seconds),value=Number.isFinite(numeric)?Math.max(0,Math.round(numeric)):0;
  return value<60?`${value}秒`:`${Math.floor(value/60)}分${value%60?`${value%60}秒`:''}`;
}
export function chapterKey(value) {
  if (value==='supplement'||!value) return 'supplement';
  const m=String(value).match(/^(?:ch)?(\d+)/); return m ? `ch${m[1]}` : String(value);
}
export function normalizedText(v) { return String(v||'').normalize('NFKC').toLowerCase(); }
export function searchRanges(value,query) {
  const s=String(value||''),q=normalizedText(query);if(!q)return [];
  const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(s)]:Array.from(s).map((segment,i,a)=>({segment,index:a.slice(0,i).join('').length}));
  let normalized='';const starts=[],ends=[];
  for(const {segment,index} of segments){const part=normalizedText(segment);normalized+=part;for(let i=0;i<part.length;i++){starts.push(index);ends.push(index+segment.length);}}
  const ranges=[];let at=0,index;
  while((index=normalized.indexOf(q,at))!==-1){const next=[starts[index],ends[index+q.length-1]];if(ranges.length&&next[0]<=ranges.at(-1)[1])ranges.at(-1)[1]=next[1];else ranges.push(next);at=index+q.length;}
  return ranges;
}
export function searchSnippet(value, query, limit=240) {
  const s=String(value||''),first=searchRanges(s,query)[0];
  let start=Math.max(0,(first?.[0]??0)-Math.floor(limit/3)), end=Math.min(s.length,Math.max(start+limit,first?.[1]??0));
  const boundaries=new Set([0,s.length]);
  if(typeof Intl.Segmenter==='function')for(const {index} of new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(s))boundaries.add(index);
  else {let index=0;for(const point of s){index+=point.length;boundaries.add(index);}}
  while(start>0&&!boundaries.has(start))start--;
  while(end<s.length&&!boundaries.has(end))end++;
  return `${start?'…':''}${s.slice(start,end)}${end<s.length?'…':''}`;
}
export function searchEntries(entries,{query='',kind='all',chapter='all',field='all'}={}) {
  const terms=normalizedText(query).split(/\s+/).filter(Boolean); if(!terms.length)return [];
  return entries.filter(e=>(kind==='all'||e.kind===kind)&&(chapter==='all'||chapterKey(e.chapter)===chapterKey(chapter))&&(field==='all'||e.field===field)&&terms.every(term=>normalizedText(`${e.title} ${e.text}`).includes(term)));
}
export function nextReviewDays(attempts,answer) {
  if(!answer.correct || ['low','unsure'].includes(answer.confidence))return 1;
  // The streak is a property of answer times, not of storage order: restored
  // or merged histories may list attempts out of chronological order.
  let streak=0; for(const a of [...attempts].sort((x,y)=>instant(x.at)-instant(y.at)).reverse()) {if(!a.correct||['low','unsure'].includes(a.confidence))break;streak++;}
  return (answer.confidence==='high'?[7,14,30,60]:[4,7,14,30])[Math.min(streak,3)];
}
export function planMinutes(total) {
  const n=Math.min(60,Math.max(5,Math.round(Number(total)||15))), reading=Math.max(1,Math.round(n*.4)), practice=Math.max(1,Math.round(n*.35));
  return [reading,practice,n-reading-practice];
}
export const STEFAN_BOLTZMANN_VALUE=5.670374419e-8;
export function calculateHeatTransfer(mode,values) {
  const fields={conduction:['k','area','thickness','hot','cold'],convection:['h','area','surface','fluid'],radiation:['emissivity','area','surface','surrounding'],resistance:['area','hot','cold','hHot','hCold','k1','k2','L1','L2']}[mode];
  if(!fields||!record(values))return {error:'計算の種類と入力項目を確認してください。'};
  const numeric={};
  for(const k of fields) {
    const v=values[k]; if(!['number','string'].includes(typeof v)||String(v).trim()===''||!Number.isFinite(Number(v)))return {error:'すべての項目に有限の数値を入力してください。空欄は計算できません。'};
    numeric[k]=Number(v);
  }
  if(numeric.area<=0)return {error:'面積 A は0より大きい値にしてください。'};
  const temperatures=['conduction','resistance'].includes(mode)?['hot','cold']:mode==='convection'?['surface','fluid']:['surface','surrounding'];
  if(temperatures.some(k=>numeric[k]<=-273.15))return {error:'温度は絶対零度（−273.15 ℃）より高い値にしてください。'};
  let watts,delta,extra={};
  if(mode==='conduction') {if(numeric.k<=0||numeric.thickness<=0)return {error:'熱伝導率 k と厚さ L は0より大きい値にしてください。'};delta=numeric.hot-numeric.cold;watts=numeric.k*numeric.area*delta/numeric.thickness;}
  if(mode==='convection') {if(numeric.h<=0)return {error:'対流熱伝達率 h は0より大きい値にしてください。'};delta=numeric.surface-numeric.fluid;watts=numeric.h*numeric.area*delta;}
  if(mode==='radiation') {if(numeric.emissivity<0||numeric.emissivity>1)return {error:'放射率 ε は0〜1で入力してください。'};const surfaceK=numeric.surface+273.15,surroundingK=numeric.surrounding+273.15;delta=numeric.surface-numeric.surrounding;watts=numeric.emissivity*STEFAN_BOLTZMANN_VALUE*numeric.area*delta*(surfaceK+surroundingK)*(surfaceK**2+surroundingK**2);extra={surfaceK,surroundingK};}
  if(mode==='resistance'){
    if(['hHot','hCold','k1','k2','L1','L2'].some(k=>numeric[k]<=0))return {error:'両側の熱伝達率・各層の熱伝導率・厚さは0より大きい値にしてください。'};
    const resistances=[1/(numeric.hHot*numeric.area),numeric.L1/(numeric.k1*numeric.area),numeric.L2/(numeric.k2*numeric.area),1/(numeric.hCold*numeric.area)],totalResistance=resistances.reduce((n,r)=>n+r,0);
    if(!Number.isFinite(totalResistance)||totalResistance<=0)return {error:'熱抵抗を計算できる数値範囲を超えました。入力値を見直してください。'};
    delta=numeric.hot-numeric.cold;watts=delta/totalResistance;
    const temperatures=[numeric.hot];for(const r of resistances)temperatures.push(temperatures.at(-1)-watts*r);
    extra={resistances,totalResistance,temperatures,overallU:1/(totalResistance*numeric.area)};
  }
  if(!Number.isFinite(watts)||!Number.isFinite(delta))return {error:'計算できる数値範囲を超えました。入力値を小さくしてください。'};
  if(watts===0&&delta!==0&&!(mode==='radiation'&&numeric.emissivity===0))return {error:'入力値の差や係数が小さすぎて計算精度を保てません。差や係数を大きくして試してください。'};
  return {watts,delta,values:numeric,...extra};
}
// Temperature of a spatially uniform solid exchanging heat with a fixed fluid.
// Independent teaching model; Biot validity must be assessed, not assumed.
export function calculateLumpedCooling(values) {
  const fields=['h','area','volume','density','cp','k','initial','ambient','time'];
  if(!record(values))return {error:'入力データを確認してください。'};
  const v={};
  for(const field of fields){
    const raw=values[field];
    if(!['number','string'].includes(typeof raw)||String(raw).trim()===''||!Number.isFinite(Number(raw)))
      return {error:'入力欄はすべて有限の数値で指定してください。'};
    v[field]=Number(raw);
  }
  if(['h','area','volume','density','cp','k'].some(k=>v[k]<=0))
    return {error:'熱伝達率、面積、体積、密度、比熱、熱伝導率はすべて0より大きくしてください。'};
  if(v.time<0)return {error:'経過時間 t は0秒以上で指定してください。'};
  if(v.initial<=-273.15||v.ambient<=-273.15)
    return {error:'初期温度と周囲温度は絶対零度（−273.15 ℃）より高くしてください。'};
  const capacity=v.density*v.volume*v.cp; // J/K
  const conductance=v.h*v.area; // W/K
  const characteristicLength=v.volume/v.area; // m = V/A_s
  const biot=v.h*characteristicLength/v.k;
  const tau=capacity/conductance; // seconds
  if([capacity,conductance,characteristicLength,biot,tau].some(x=>!Number.isFinite(x)||x<=0))
    return {error:'時間定数またはビオ数が計算可能範囲外です。値と単位を見直してください。'};
  const exponent=-v.time/tau;
  const fraction=Math.exp(exponent); // remaining difference / original difference
  const delta0=v.initial-v.ambient;
  const temperature=v.ambient+delta0*fraction;
  const watts=conductance*delta0*fraction; // + means outward, cooling
  const energyJ=-capacity*delta0*Math.expm1(exponent); // + means total heat lost
  const delta=temperature-v.ambient;
  if([exponent,fraction,temperature,watts,energyJ,delta].some(x=>!Number.isFinite(x)))
    return {error:'計算可能な数値範囲を超えました。極端な値を見直してください。'};
  return {values:v,temperature,watts,energyJ,delta,delta0,capacity,conductance,
    characteristicLength,biot,tau,fraction,validLumpedApproximation:biot<0.1,
    applicability:biot<0.1?'集中熱容量近似の目安 Bi＜0.1 を満たします。内部温度差を無視する近似は形状・物性・境界条件も確認してください。':
      'Bi≧0.1 のため、内部温度を一様とする近似の精度を保証できません。温度分布を扱う非定常熱伝導モデルが必要です。'};
}

export function safeLocalFigurePath(src) {
  if(typeof src!=='string')return false;
  const relative=src.startsWith('./')?src.slice(2):src;
  return !relative.includes('..')&&/^data\/(?:figures|local\/figures|drafts)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|svg|webp)$/i.test(relative);
}
export function validateQuestion(q) {
  if(!record(q)||!text(q.id)||!text(q.prompt)||!Array.isArray(q.choices)||q.choices.length!==4||!q.choices.every(text)||new Set(q.choices).size!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)return '問題文・4つの選択肢・正解の形式を確認してください。';
  if(!text(q.explanation)||!Array.isArray(q.distractors)||q.distractors.length!==4||!q.distractors.every(v=>text(v)&&v.trim()))return '4つの選択肢それぞれの理由が必要です。';
  if(!record(q.source)||(!text(q.source.section)&&!(q.source.type==='supplement'&&text(q.source.reference))))return '問題の出典を確認してください。';
  if(q.figure&&(!text(q.figure.alt)||!q.figure.alt.trim()))return '図の代替説明が必要です。';
  if(q.figure?.kind==='book'&&q.figure.src!==undefined&&!safeLocalFigurePath(q.figure.src))return '書籍図は端末内の教材画像を参照してください。';
  return '';
}

export function speechChunks(blocks, maxLength=240) {
  if(!Array.isArray(blocks)||!Number.isInteger(maxLength)||maxLength<40)return [];
  const chunks=[],strings=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):[];
  for(const block of blocks){
    const parts=[block.title,block.caption,block.alt||block.expression,block.text,block.explanation,block.description,block.headers,block.rows,block.items,block.attribution];
    if(block.type==='supplement')parts.unshift('補足説明。');
    if(block.type==='footnote')parts.unshift('脚注。');
    for(const part of [...new Set(parts.flatMap(strings))]){
      let remaining=part.trim();
      while(remaining){
        let end=Math.min(maxLength,remaining.length);
        if(end<remaining.length){
          const prefix=remaining.slice(0,end),boundaries=[...prefix.matchAll(/[。！？\n]|[.!?;]\s|\s/gu)];
          const split=boundaries.at(-1);if(split&&split.index>=maxLength/3)end=split.index+split[0].length;
          if(/[\uD800-\uDBFF]/u.test(remaining[end-1]))end--;
        }
        const chunk=remaining.slice(0,end).trim();if(chunk)chunks.push(chunk);remaining=remaining.slice(end).trim();
      }
    }
  }
  return chunks;
}
