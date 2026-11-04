import {readerSectionFromHash,dynamicLinkForSection,dynamicLinkForQuestion} from './dynamic-navigation.mjs';
import { createEmptyState, validateLearningData, normalizeLearningData, mergeLearningData, calculateHeatTransfer, calculateLumpedCooling, calculateSimulationModel, chapterKey, normalizedText, searchEntries, searchSnippet, searchRanges, localDay, validDay, shiftMonth, nextReviewDays, planMinutes, validateQuestion, safeLocalFigurePath, speechChunks, questionFingerprint, quizChoiceOrder, quizResumeIssue, recordStudyActivity, fieldProgress, studyDuration, isCurrentQuestionAnswer } from './study-core.mjs';
import { FIN_DEFAULTS, finFieldNames, renderFinFields, renderFinSteps, renderFinDiagram, finTemperatureGraph } from './fin-efficiency.mjs';
import { EXCHANGER_DEFAULTS, exchangerFieldNames, renderExchangerFields, renderExchangerSteps, renderExchangerDiagram, exchangerEffectivenessGraph } from './heat-exchanger.mjs';
import { SLAB_DEFAULTS, slabFieldNames, renderSlabFields, renderSlabSteps, renderSlabDiagram, slabProfileGraph, slabHistoryGraph } from './transient-slab.mjs';
import { RADIATION_ENCLOSURE_DEFAULTS, radiationEnclosureFieldNames, renderRadiationEnclosureFields, renderRadiationEnclosureSteps, renderRadiationEnclosureDiagram, radiationEnclosureHeatGraph } from './radiation-enclosure.mjs';
import { CYLINDER_DEFAULTS, cylinderFieldNames, renderCylinderFields, renderCylinderSteps, renderCylinderDiagram, cylinderTemperatureGraph, cylinderThicknessGraph } from './cylindrical-insulation.mjs';
import { SEMI_INFINITE_DEFAULTS, semiInfiniteFieldNames, renderSemiInfiniteFields, renderSemiInfiniteSteps, renderSemiInfiniteDiagram, semiInfiniteProfileGraph, semiInfiniteHistoryGraph } from './semi-infinite-solid.mjs';
import { FLAT_PLATE_DEFAULTS, flatPlateFieldNames, renderFlatPlateFields, renderFlatPlateSteps, renderFlatPlateDiagram, flatPlateLocalGraph, flatPlateVelocityGraph } from './forced-convection-flat-plate.mjs';
import { PIPE_DEFAULTS, pipeFieldNames, renderPipeFields, renderPipeSteps, renderPipeDiagram, pipeBulkGraph, pipeVelocityGraph } from './turbulent-pipe-convection.mjs';
import { CROSSFLOW_DEFAULTS, crossflowFieldNames, renderCrossflowFields, renderCrossflowSteps, renderCrossflowDiagram, crossflowVelocityGraph, crossflowDiameterGraph } from './cylinder-crossflow.mjs';
import { NATURAL_DEFAULTS, naturalFieldNames, renderNaturalFields, renderNaturalSteps, renderNaturalDiagram, naturalTemperatureGraph, naturalHeightGraph } from './natural-convection-vertical.mjs';
import { LAMINAR_PIPE_DEFAULTS, laminarPipeFieldNames, renderLaminarPipeFields, renderLaminarPipeSteps, renderLaminarPipeDiagram, laminarPipeBulkGraph, laminarPipeNusseltGraph } from './laminar-pipe-convection.mjs';
import { CONDENSATION_DEFAULTS, condensationFieldNames, renderCondensationFields, renderCondensationSteps, renderCondensationDiagram, condensationThicknessGraph, condensationLocalGraph } from './laminar-film-condensation.mjs';
import { BINARY_DIFFUSION_DEFAULTS, binaryDiffusionFieldNames, renderBinaryDiffusionFields, renderBinaryDiffusionSteps, renderBinaryDiffusionDiagram, binaryDiffusionProfileGraph, binaryDiffusionBoundaryGraph } from './binary-gas-diffusion.mjs';
import { NUCLEATE_DEFAULTS, nucleateFieldNames, renderNucleateFields, renderNucleateSteps, renderNucleateDiagram, nucleateHeatFluxGraph, nucleateSurfaceSensitivityGraph } from './pool-boiling-nucleate.mjs';
import { CHF_DEFAULTS, chfFieldNames, renderCriticalHeatFluxFields, renderCriticalHeatFluxSteps, renderCriticalHeatFluxDiagram, criticalHeatFluxSensitivityGraph } from './pool-boiling-chf.mjs';
import { GUIDE_SECTIONS, searchGuide } from './guide.mjs';
import {questionChapter,questionsForChapter,chapterLearningOverview} from './chapter-curriculum.mjs';
import {validateOriginalNotes,independentNoteForSection} from './original-notes.mjs';
import {validateDeepLessons,deepLessonForSection} from './original-deep-lessons.mjs';
import {renderTransientFields,renderTransientSteps,transientGraph,transientFieldNames} from './transient-ui.mjs';
import {matchTerms,renderTermLinks,renderTermSheet,renderTermExample,renderTermLearningLinks,linkTermTextNodes} from './term-links.mjs';
import {renderSimulationDiagram} from './sim-diagrams.mjs';
import {lessonDiagramPath} from './lesson-diagrams.mjs';
const CORE_DATA_FILES = ['./data/book.json', './data/questions.json', './data/glossary.json', './data/content-manifest.json', './data/original-notes.json', './data/original-deep-lessons.json'];
const LEGACY_STORAGE_KEY = 'heat-study-ja:v1';
const PROFILES_KEY = 'heat-study-ja:profiles:v1';
const ACTIVE_PROFILE_KEY = 'heat-study-ja:active-profile:v1';
let profileIssue = '';
const profiles = loadProfiles();
const activeProfileId = loadActiveProfileId();
const STORAGE_KEY = activeProfileId === 'legacy' ? LEGACY_STORAGE_KEY : `heat-study-ja:profile:${activeProfileId}:v1`;
const root = document.querySelector('#app');
const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');
const emptyState = createEmptyState;
let storageIssue = '', recoveryRaw = '', storageBlocked = false, lastSavedRaw = null, storageConflict = false;
let state = loadState();
let book;
let questionBank;
let glossary;
let contentManifest;
let originalNotes;
let deepLessons;
let speechRun = 0;
function routeFromHash() { return location.hash.slice(1).split('/')[0] || 'home'; }
function guideTargetFromHash() { const id=location.hash.slice(1).split('/')[1]; return GUIDE_SECTIONS.some(section=>section.id===id)?id:''; }
const activityPageId=makeId();
let activityTick=Date.now(),lastInteractionAt=activityTick,activityWasVisible=document.visibilityState!=='hidden'&&(!document.hasFocus||document.hasFocus());
let ui = {
  route: routeFromHash(),
  guideTarget: guideTargetFromHash(),
  guideQuery: '',
  pdfCacheStatus: 'checking',
  readerSection: state.lastSection,
  search: { query: '', kind: 'all', chapter: 'all' },
  quiz: null,
  quizResult: null,
  pendingQuizStart: null,
  reportId: null,
  termId: null,
  termReturnFocus: null,
  reportMessage: '',
  searchResults: null,
  searchLimit: 100,
  calendarDate: todayISO(),
  importDraft: null,
  simMode: 'conduction',
  simValues: {
    conduction: { k: 15, area: 0.5, thickness: 0.08, hot: 80, cold: 20 },
    convection: { h: 25, area: 1, surface: 80, fluid: 20 },
    radiation: { emissivity: 0.85, area: 1, surface: 150, surrounding: 25 },
    resistance:{area:1,hot:80,cold:20,hHot:10,hCold:20,k1:0.5,k2:0.1,L1:0.1,L2:0.05},
    transient:{h:20,area:0.1,volume:0.001,density:1000,cp:4000,k:10,initial:60,ambient:20,time:2000},
    // Initial values for the added modes mirror each model module's *_DEFAULTS.
    fin:{k:200,h:40,length:0.1,radius:0.01,base:80,ambient:20},
    exchanger:{flow:'counter',hotMass:0.2,hotCp:2000,coldMass:0.4,coldCp:1000,u:100,area:2,hotIn:80,coldIn:20},
    slab:{k:2,h:80,thickness:0.08,faceArea:0.1,density:2000,cp:900,initial:80,ambient:20,time:400},
    enclosure:{area1:1,area2:4,epsilon1:0.8,epsilon2:0.6,temp1:200,temp2:25},
    cylinder:{radius:0.004,thickness:0.003,length:1,k:0.05,h:5,base:80,ambient:20},
    halfspace:{k:15,density:7800,cp:500,initial:20,surface:100,time:60,depth:0.01,area:0.2,availableDepth:0.1},
    flatplate:{density:1.184,velocity:3,viscosity:0.00001849,cp:1007,conductivity:0.0263,length:0.5,width:0.2,surface:80,fluid:25},
    pipe:{density:996,velocity:1.2,viscosity:0.000797,cp:4180,conductivity:0.613,diameter:0.025,length:3,inlet:25,wall:60},
    crossflow:{density:1.184,velocity:3,viscosity:0.00001849,cp:1007,conductivity:0.0263,diameter:0.05,length:1,surface:80,ambient:25},
    natural:{density:1.184,viscosity:0.00001849,cp:1007,conductivity:0.0263,beta:0.00319,height:0.5,width:0.4,faces:1,surface:60,ambient:20},
    laminarpipe:{density:998,velocity:0.04,viscosity:0.001,cp:4180,conductivity:0.6,diameter:0.02,length:1,inlet:20,wall:60},
    condensation:{rhoLiquid:958,rhoVapor:0.6,viscosity:0.000282,conductivity:0.68,latent:2260000,cpLiquid:4200,height:0.1,width:0.4,saturation:100,wall:98},
    diffusion:{regime:'stagnant',diffusivity:0.000025,pressure:101325,temperature:298.15,thickness:0.002,area:0.01,yA1:0.3,yA2:0.05,molarMassA:0.018},
    nucleate:{rhoLiquid:958.4,rhoVapor:0.597,viscosity:0.000282,conductivity:0.679,cp:4216,latent:2257000,surfaceTension:0.0589,csf:0.013,n:1,superheat:10,area:0.01},
    chf:{rhoLiquid:958.4,rhoVapor:0.597,latent:2257000,surfaceTension:0.0589,area:0.01,appliedFlux:500000}
  }
};

function loadProfiles() {
  const fallback = [{id: 'legacy', name: '既存の記録'}];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length || parsed.length > 20 || parsed[0]?.id !== 'legacy' || parsed[0]?.name !== '既存の記録'
      || parsed.some(p => !p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40
        || typeof p.id !== 'string' || (p.id !== 'legacy' && !/^[0-9a-f-]{36}$/.test(p.id)))
      || new Set(parsed.map(p => p.id)).size !== parsed.length) throw new Error('invalid-profile-list');
    return parsed;
  } catch {
    profileIssue = '利用者の一覧を読み取れませんでした。新しい利用者の追加を止めています。記録をJSONで書き出し、保存状態を確認してください。';
    return fallback;
  }
}
function loadActiveProfileId() {
  try {
    const id = localStorage.getItem(ACTIVE_PROFILE_KEY) || 'legacy';
    if (profiles.some(profile => profile.id === id)) return id;
  } catch { /* Existing record remains accessible with the legacy key. */ }
  profileIssue ||= '前回の利用者を読み取れませんでした。既存の記録を表示しています。';
  return 'legacy';
}
function saveCurrentProfile() {
  flushLearningTime(true);
  if (ui.route === 'reader') captureReaderPosition();
  persistQuiz();
  if (!saveState()) { showStatus('今の記録を保存できないため、利用者を切り替えていません。JSONを書き出してください。'); return false; }
  return true;
}
function switchProfile(id) {
  if (id === activeProfileId || !profiles.some(profile => profile.id === id) || profileIssue) return;
  if (!saveCurrentProfile()) return;
  try { localStorage.setItem(ACTIVE_PROFILE_KEY, id); }
  catch { showStatus('利用者を切り替えられませんでした。ブラウザーの保存設定を確認してください。'); return; }
  window.location.reload();
}
function createProfile(form) {
  if (profileIssue || profiles.length >= 20) { showStatus(profileIssue || '利用者は20人まで登録できます。'); return; }
  const name = String(new FormData(form).get('profileName') || '').trim();
  if (!name || name.length > 40 || profiles.some(profile => profile.name === name)) { showStatus('1〜40文字で、既存と異なる利用者名を入力してください。'); return; }
  if (!globalThis.crypto?.randomUUID) { showStatus('このブラウザーでは安全に利用者を追加できません。'); return; }
  let priorList;
  try { priorList = localStorage.getItem(PROFILES_KEY); }
  catch { showStatus('利用者一覧を確認できませんでした。ブラウザーの保存設定を確認してください。'); return; }
  if (priorList && priorList !== JSON.stringify(profiles)) { showStatus('別のタブで利用者一覧が変わりました。再読み込みしてから追加してください。'); return; }
  if (!saveCurrentProfile()) return;
  const id = globalThis.crypto.randomUUID(), key = `heat-study-ja:profile:${id}:v1`;
  let listWritten = false;
  try {
    localStorage.setItem(key, JSON.stringify(emptyState()));
    localStorage.setItem(PROFILES_KEY, JSON.stringify([...profiles, {id, name}]));
    listWritten = true;
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch {
    if (listWritten) try {
      if (priorList === null) localStorage.removeItem(PROFILES_KEY);
      else localStorage.setItem(PROFILES_KEY, priorList);
    } catch { /* Keep the newly created profile reachable if rollback also fails. */ }
    showStatus('利用者を追加できませんでした。既存の記録は保持しています。空き容量と保存設定を確認してください。'); return;
  }
  window.location.reload();
}

function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    lastSavedRaw = raw;
    storageConflict = false;
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (validateLearningData(parsed, { stored: true })) throw new Error('invalid');
    return normalizeLearningData(parsed);
  } catch {
    if (raw) {
      recoveryRaw = raw;
      try { localStorage.setItem(`${STORAGE_KEY}:recovery`, raw); }
      catch { storageBlocked = true; }
      storageIssue = '保存済みデータを読み取れませんでした。元データを保管し、一時的な状態で開いています。元データを書き出して確認してください。';
    } else storageIssue = 'このブラウザーでは端末への保存を利用できません。設定から学習データを書き出してください。';
    return emptyState();
  }
}
function saveState(next = state) {
  try {
    if (storageBlocked) throw new Error('recovery-not-preserved');
    if (localStorage.getItem(STORAGE_KEY) !== lastSavedRaw) {
      storageIssue = '別のタブで学習記録が更新されました。このタブの変更は保存していません。必要ならJSONを書き出し、再読み込みしてから続けてください。';
      storageConflict = true;
      return false;
    }
    const raw=JSON.stringify(next);
    localStorage.setItem(STORAGE_KEY, raw);
    lastSavedRaw = raw;
    storageConflict = false;
    if (!recoveryRaw) storageIssue = '';
    return true;
  } catch {
    storageIssue = '端末への保存に失敗しています。画面上の変更は一時的です。設定からJSONを書き出し、空き容量やブラウザーの保存設定を確認してください。';
    return false;
  }
}
function todayISO(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function formatDate(value) { if (!value) return '未設定'; const date = new Date(`${value}T00:00:00`); return Number.isNaN(+date) ? '未設定' : new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(date); }
function formatTime(value) { return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function allSections() { return book.chapters.flatMap(chapter => chapter.sections.map(section => ({ ...section, chapterId: chapter.id, chapterTitle: chapter.title, part: chapter.part }))); }
function getSection(id) { return allSections().find(section => section.id === id); }
function getQuestion(id) { return questionBank.find(question => question.id === id); }
function sectionIsTranslated(section) { return Array.isArray(section?.blocks) && section.blocks.length > 0; }
function sectionProgressLabel(section) { return section?.localDraft ? '訳文下書き・未照合' : sectionIsTranslated(section) ? '訳文あり' : section?.translationStatus === 'private_only' ? '訳文未収録' : section?.translationStatus === 'draft_complete' ? '翻訳下書き・未移行' : section?.translationStatus === 'in_progress' ? '翻訳作業記録・未移行' : '訳文未着手'; }
function blockSourceLabel(block){
  const range=(first,last)=>`${first??'未記録'}${last&&last!==first?'–'+last:''}`;
  return `書籍 p.${range(block.bookPage,block.endBookPage)} · PDF p.${range(block.pdfPage,block.endPdfPage)}`;
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlight(value, query) {
  const text=String(value||'');let result='',end=0;
  for(const [start,stop] of searchRanges(text,query)){result+=escapeHTML(text.slice(end,start))+`<mark>${escapeHTML(text.slice(start,stop))}</mark>`;end=stop;}
  return result+escapeHTML(text.slice(end));
}
function renderMathText(value,query=''){
  return highlight(value,query)
    .replace(/(?:\p{L}\u0305)+/gu,s=>`<span class="math-overline">${s.replaceAll('\u0305','')}</span>`)
    .replace(/_([A-Za-zΑ-Ωα-ω0-9∞]+)/gu,'<sub>$1</sub>')
    .replace(/\^\(([−+\-0-9./]+)\)/gu,'<sup>$1</sup>')
    .replace(/\^([−+\-]?\d+(?:\.\d+)?)/gu,'<sup>$1</sup>');
}
function sourceLabel(source = {}) {
  if (source.type === 'supplement') return `補足説明・${escapeHTML(source.reference || '出典を確認中')}`;
  const section = source.section ? `第${escapeHTML(source.section)}節` : '';
  const figure=source.figure||(source.figures||[]).join('、'),equation=source.equation||(source.equations||[]).join('、');
  const evidence = [figure ? `図${escapeHTML(figure)}` : '', equation ? `式（${escapeHTML(equation)}）` : ''].filter(Boolean).join(' · ');
  return `本書 ${section}／書籍 p.${escapeHTML(source.bookPages || '未記録')}・PDF p.${escapeHTML(source.pdfPages || '未記録')}${evidence ? ` · ${evidence}` : ''}`;
}
function sourcePdfPage(source, section) {
  const specified=source?.pdfPages!==undefined&&source?.pdfPages!==null&&source.pdfPages!=='';
  const match=specified?/^([1-9]\d*)(?:\s*[–-]\s*[1-9]\d*)?$/.exec(String(source.pdfPages)):null;
  if(specified&&!match)return null;
  const page=Number(match?.[1]||section?.pdfStart);
  return Number.isInteger(page)&&page>=1&&page<=book.pdfPageCount?page:null;
}
function sourcePdfLink(source, section) {
  const page=sourcePdfPage(source,section);
  return page?`<a class="text-link" href="./book/AHTTv600.pdf#page=${page}" target="_blank" rel="noopener" aria-label="英語原本PDF p.${page}を開く ↗（別タブ）">英語原本PDF p.${page}を開く ↗</a>`:'';
}
function pdfCacheStatusLabel() {
  return ({checking:'原本PDFのオフライン保存状態を確認中です。',saving:'原本PDFをオフライン用に保存しています。',saved:'原本PDFはこのブラウザーに保存済みです。保存領域が消えると再取得が必要です。','not-saved':'原本PDFはオフライン用に未保存です。必要ならオンライン中に保存してください。',unknown:'原本PDFの保存状態を確認できませんでした。ネット接続と空き容量を確認してください。',unsupported:'このブラウザーではアプリ内のオフライン保存状態を確認できません。PDFのダウンロードを利用してください。'})[ui.pdfCacheStatus];
}
function setPdfCacheStatus(status) {
  ui.pdfCacheStatus=status;
  const indicator=document.querySelector('#pdf-cache-status');
  if(indicator)indicator.textContent=pdfCacheStatusLabel();
  const saveButton=document.querySelector('[data-action="cache-pdf"]');
  if(saveButton)saveButton.disabled=status==='saving';
}
const BOOK_BLOCK_TYPES = new Set(['heading','subheading','example','quote','experiment','footnote','formula','supplement','sourceNote','figure','table','list','problem','reference','paragraph']);
function validBookFigure(figure) {
  return figure && typeof figure === 'object' && !Array.isArray(figure) && typeof figure.alt === 'string' && !!figure.alt.trim() && (figure.src === undefined || figure.src === '' || safeLocalFigurePath(figure.src));
}
function validBookBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return false;
  const ids = new Set();
  return blocks.every(block => {
    if (!block || typeof block !== 'object' || Array.isArray(block) || !BOOK_BLOCK_TYPES.has(block.type)) return false;
    if (block.id !== undefined) {
      if (typeof block.id !== 'string' || !block.id || ids.has(block.id)) return false;
      ids.add(block.id);
    }
    if (['heading','subheading','example','quote','experiment','footnote','supplement','sourceNote','paragraph'].includes(block.type) && typeof block.text !== 'string') return false;
    if (block.type === 'formula' && typeof block.expression !== 'string') return false;
    if (block.type === 'figure' && !validBookFigure(block)) return false;
    if (block.type === 'list' && (!Array.isArray(block.items) || !block.items.every(item => typeof item === 'string'))) return false;
    if (block.type === 'table' && (!Array.isArray(block.headers) || !block.headers.every(item => typeof item === 'string') || !Array.isArray(block.rows) || !block.rows.every(row => Array.isArray(row) && row.every(item => typeof item === 'string')))) return false;
    if (block.type === 'problem' && ((block.items !== undefined && (!Array.isArray(block.items) || !block.items.every(item => typeof item === 'string'))) || (block.figureRefs !== undefined && (!Array.isArray(block.figureRefs) || !block.figureRefs.every(item => typeof item === 'string'))) || (block.formulaBlocks !== undefined && (!Array.isArray(block.formulaBlocks) || !block.formulaBlocks.every(item => item && typeof item === 'object' && typeof item.expression === 'string'))) || (block.figure !== undefined && !validBookFigure(block.figure)))) return false;
    return true;
  });
}
function setRoute(route) {
  flushLearningTime();
  if(ui.route==='reader'&&route!=='reader')captureReaderPosition();
  if(ui.route==='reader'&&route!=='reader')stopSpeech(false);
  ui.route = route;
  ui.guideTarget = '';
  if (location.hash !== `#${route}`) location.hash = route;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  focusPageHeading();
}
function focusPageHeading(){const heading=document.querySelector('.page-heading h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
function updateState(change) { state = typeof change === 'function' ? change(state) : { ...state, ...change }; saveState(); render(); }

const NAV_ITEMS = [
  ['home', 'ホーム', '⌂'], ['reader', '読む', '▤'], ['quiz', '問題', '◉'], ['review', '復習', '↻'],
  ['search', '検索', '⌕'], ['glossary', '用語集', 'あ'], ['map', '分野マップ', '◫'],
  ['simulator', 'シミュレーター', '≈'], ['plan', '学習計画', '▦'], ['calendar', 'カレンダー', '▣'], ['settings', '設定', '⚙'], ['guide', '使い方・学習ガイド', '?']
];

async function startApp() {
  try {
    [book, questionBank, glossary, contentManifest, originalNotes, deepLessons] = await Promise.all(CORE_DATA_FILES.map(path => fetch(path).then(response => {
      if (!response.ok) throw new Error(`教材データを読み込めません（${path}）`);
      return response.json();
    })));
    const independentIssues=validateOriginalNotes(book,originalNotes);
    if(independentIssues.length)throw new Error('独立作成の日本語節別ノートの整合性を確認してください: '+independentIssues[0]);
    const deepIssues=validateDeepLessons(book,deepLessons);
    if(deepIssues.length)throw new Error('独立発展講義の整合性を確認してください: '+deepIssues[0]);
    const contentFiles = await Promise.all((contentManifest.files || []).map(path => fetch(path).then(response => {
      if (!response.ok) throw new Error(`章別教材データを読み込めません（${path}）`);
      return response.json();
    })));
    for (const content of contentFiles) {
      if (!content || typeof content !== 'object') throw new Error('収録済みの章別教材データの構造を確認してください。');
      const section = book.chapters.flatMap(chapter => chapter.sections).find(item => item.id === content.sectionId);
      if (!section || !['ja','en'].includes(content.language) || !validBookBlocks(content.blocks)) throw new Error('収録済みの章別教材データの構造を確認してください。');
      if (content.language === 'ja') section.blocks = content.blocks;
      else if (content.language === 'en') section.blocksEn = content.blocks;
    }
    glossary = glossary.filter(term => term.availableInApp !== false);
    // Licensed additions stay in the user's local pack; a missing pack is a normal empty state.
    try {
      const response = await fetch('./data/local-content-manifest.json');
      if (response.ok) {
        const manifest = await response.json();
        for(const list of [manifest.files||[],manifest.questionFiles||[],manifest.glossaryFiles||[]])if(!Array.isArray(list)||list.length>500||list.some(p=>typeof p!=='string'||!p.startsWith('./data/local/')||p.includes('..')||/[?#]/.test(p)))throw new Error('local-path');
        const load = async path => { const r = await fetch(path); if (!r.ok) throw new Error('local-file'); return r.json(); };
        const content = await Promise.all((manifest.files || []).map(load));
        const questions = await Promise.all((manifest.questionFiles || []).map(load));
        const terms = await Promise.all((manifest.glossaryFiles || []).map(load));
        if(questions.some(list=>!Array.isArray(list)||list.some(q=>validateQuestion(q)||q.reviewStatus!=='source_checked'))||terms.some(list=>!Array.isArray(list)||list.some(t=>typeof t.ja!=='string'||typeof t.meaning!=='string'||!t.source)))throw new Error('local-question-format');
        // Commit the whole pack only after every referenced file has loaded.
        for (const entry of content) {
          const section = book.chapters.flatMap(c => c.sections).find(s => s.id === entry.sectionId);
          if (!section || !validBookBlocks(entry.blocks) || !['ja','en'].includes(entry.language) || !['source_checked','draft'].includes(entry.sourceReview)) throw new Error('local-format');
        }
        for (const entry of content) {
          const section = book.chapters.flatMap(c => c.sections).find(s => s.id === entry.sectionId);
          section[entry.language === 'en' ? 'blocksEn' : 'blocks'] = entry.blocks;
          if (entry.language === 'ja') {
            section.localSourceChecked = entry.sourceReview === 'source_checked';
            section.localDraft = entry.sourceReview === 'draft';
          }
        }
        questionBank = [...new Map([...questionBank, ...questions.flat()].map(q => [q.id,q])).values()];
        glossary = [...new Map([...glossary, ...terms.flat()].map(t => [t.id,t])).values()];
        ui.localCacheFiles=['./data/local-content-manifest.json',...(manifest.files||[]),...(manifest.questionFiles||[]),...(manifest.glossaryFiles||[]),...content.flatMap(entry=>entry.blocks.filter(b=>b.src).map(b=>`./${b.src.replace(/^\.\//,'')}`))];
      } else if (response.status !== 404) ui.contentWarning = 'ローカル教材を読み込めませんでした。収録済みの教材で学習を続けられます。';
    } catch { ui.contentWarning = '追加のローカル教材を読み込めませんでした。教材ファイルをそろえて再読み込みしてください。学習記録は保持しています。'; }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.addEventListener('message',event=>{
        if(event.data?.type==='CONTENT_CACHE_RESULT'&&!event.data.ok)showStatus('追加教材のオフライン保存が完了しませんでした。ネット接続中に再読み込みしてください。');
        if(event.data?.type==='PDF_CACHE_STATUS')setPdfCacheStatus(event.data.error?'unknown':event.data.cached?'saved':'not-saved');
        if(event.data?.type==='PDF_CACHE_RESULT'){
          setPdfCacheStatus(event.data.ok?'saved':'unknown');
          showStatus(event.data.ok?'原本PDFをオフライン用に保存しました。このブラウザーの保存領域が消えると再取得が必要です。':'原本PDFのオフライン保存が完了しませんでした。空き容量とネット接続を確認してください。');
        }
      });
      // A newly deployed service worker activates immediately (skipWaiting +
      // clients.claim), which would leave this already-open page running the
      // previous generation's code against the new generation's cached data.
      // Reload once into the new generation instead of mixing generations.
      // Pages not yet controlled (first install) skip the listener entirely.
      if (navigator.serviceWorker.controller) {
        let generationReloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (generationReloaded) return;
          generationReloaded = true;
          location.reload();
        });
      }
      navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(registration=>{
        registration.active?.postMessage({type:'CACHE_CONTENT',urls:ui.localCacheFiles||[]});
        registration.active?.postMessage({type:'CHECK_PDF_CACHE'});
      }).catch(()=>{setPdfCacheStatus('unsupported');showStatus('オフライン保存の準備に失敗しました。ネット接続中に再読み込みしてください。');});
    } else setPdfCacheStatus('unsupported');
    window.addEventListener('hashchange', () => {
      const next=routeFromHash(),guideTarget=guideTargetFromHash(),readerTarget=readerSectionFromHash(location.hash,allSections().map(s=>s.id));if(next===ui.route&&guideTarget===ui.guideTarget&&(!readerTarget||readerTarget===ui.readerSection))return;
      flushLearningTime();if(ui.route==='reader'){captureReaderPosition();stopSpeech(false);}persistQuiz();
      if(readerTarget)ui.readerSection=readerTarget;ui.route=next;ui.guideTarget=guideTarget;if(guideTarget)ui.guideQuery='';render();window.scrollTo({top:0,behavior:'instant'});focusPageHeading();
      if(next==='reader')setTimeout(()=>restoreReaderPosition(state.readerPositions[ui.readerSection]),100);
      if(next==='guide'&&guideTarget)setTimeout(()=>focusGuideSection(guideTarget),0);
    });
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onSimTabKeyDown);
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    window.addEventListener('storage',event=>{
      if(event.key===STORAGE_KEY&&event.newValue!==lastSavedRaw){
        storageConflict=true;
        storageIssue='別のタブで学習記録が更新されました。このタブの変更は保存していません。必要ならJSONを書き出し、再読み込みしてから続けてください。';
        showStatus('別のタブで学習記録が更新されました。再読み込み前に、このタブで必要な記録をJSONに書き出してください。');
      }
      if(event.key===ACTIVE_PROFILE_KEY&&event.newValue!==activeProfileId)showStatus('別のタブで利用者が切り替わりました。このタブも再読み込みして利用者を確認してください。');
    });
    window.addEventListener('scroll', saveReaderPosition, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,()=>{flushLearningTime();lastInteractionAt=Date.now();},{passive:true});
    document.addEventListener('visibilitychange',()=>{flushLearningTime(true);activityTick=Date.now();if(document.visibilityState==='visible')lastInteractionAt=activityTick;});
    window.addEventListener('blur',()=>{flushLearningTime(true);activityWasVisible=false;});
    window.addEventListener('focus',()=>{flushLearningTime();lastInteractionAt=Date.now();activityWasVisible=document.visibilityState!=='hidden';});
    window.addEventListener('pagehide',()=>{flushLearningTime(true);if(ui.route==='reader'){clearTimeout(saveReaderPosition.timer);state.readerPositions[ui.readerSection]=readerPosition();}persistQuiz();saveState();});
    setInterval(()=>flushLearningTime(true),5000);
    systemDark?.addEventListener?.('change', () => { if (state.settings.theme === 'system') render(); });
    const initialReaderTarget=readerSectionFromHash(location.hash,allSections().map(s=>s.id));if(initialReaderTarget)ui.readerSection=initialReaderTarget;
    render();
    if(ui.route==='reader')setTimeout(()=>restoreReaderPosition(state.readerPositions[ui.readerSection]),100);
    if(ui.route==='guide'&&ui.guideTarget)setTimeout(()=>focusGuideSection(ui.guideTarget),0);
  } catch (error) {
    root.innerHTML = `<main class="load-error"><div class="error-icon">!</div><h1>教材を読み込めませんでした</h1><p>${escapeHTML(error.message || '教材データを確認してください。')}</p><p>ネット接続を確認して再読み込みしてください。解決しない場合は、配信ファイルの不足を確認してください。</p></main>`;
  }
}

// A full re-render (connectivity change, system theme change, tick updates)
// rebuilds the DOM and would silently discard transient UI state: an open
// term sheet and the unsaved mistake-note draft. Snapshot both before the
// rebuild and restore them afterwards, but only when the route did not
// change — navigation must not resurrect a sheet or a draft (audit A2-UXS-13).
function captureTransientUi(){
  const snapshot={route:ui.renderedRoute,termId:null,note:null};
  if(ui.termId&&document.getElementById('term-overlay'))snapshot.termId=ui.termId;
  const form=document.getElementById('mistake-note-form');
  if(form&&ui.quiz&&!ui.quizResult){
    const data=new FormData(form);
    const draft={reason:String(data.get('reason')||''),memory:String(data.get('memory')||''),nextTime:String(data.get('nextTime')||'')};
    if(draft.reason||draft.memory||draft.nextTime)snapshot.note={questionId:ui.quiz.ids[ui.quiz.index],draft};
  }
  return snapshot;
}
function restoreTransientUi(snapshot){
  if(!snapshot||snapshot.route!==ui.route)return;
  if(snapshot.note&&ui.quiz&&!ui.quizResult&&ui.quiz.ids[ui.quiz.index]===snapshot.note.questionId){
    const form=document.getElementById('mistake-note-form');
    if(form)for(const [key,value] of Object.entries(snapshot.note.draft)){
      const field=form.elements.namedItem(key);if(field)field.value=value;
    }
  }
  if(snapshot.termId&&(glossary||[]).some(item=>item.id===snapshot.termId))openTermSheet(snapshot.termId,null);
}
function render() {
  if (!book) return;
  const transientSnapshot=captureTransientUi();
  // Route/data re-render destroys the overlay; never leave a stale modal keyboard trap.
  ui.termId=null;ui.termReturnFocus=null;
  const theme = state.settings.theme === 'system' ? (systemDark?.matches ? 'dark' : 'light') : state.settings.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--reader-scale', String(state.settings.fontScale || 1));
  document.documentElement.style.setProperty('--reader-line-height', String(state.settings.lineHeight || 1.8));
  document.documentElement.dataset.readerWidth = state.settings.width || 'reading';
  const routeView = routeContent();
  root.innerHTML = `
    <div class="app-shell">
      <a href="#main-content" class="skip-link" data-action="skip-content">本文へスキップ</a>
      <header class="topbar">
        <a href="#home" class="brand" aria-label="熱移動を学ぶ 読む・解く・ふり返る ホームへ">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span><strong>熱移動を学ぶ</strong><small>読む・解く・ふり返る</small></span>
        </a>
        <div class="topbar-status">
          <span class="source-pill">第6版の学習補助</span>
          <span class="connection ${navigator.onLine ? '' : 'is-offline'}"><i></i>${navigator.onLine ? 'オンライン' : 'オフライン'}</span>
          <button class="icon-button" type="button" data-action="toggle-theme" aria-label="表示モードを切り替え" title="表示モードを切り替え">${theme === 'dark' ? '☼' : '☾'}</button>
        </div>
      </header>
      <div class="app-layout">
        <nav class="main-nav" aria-label="メインメニュー">
          ${NAV_ITEMS.map(([id, label, icon]) => `<a class="nav-link ${ui.route === id ? 'active' : ''}" href="#${id}" ${ui.route === id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${id === 'review' && dueReviewCount() ? `<b class="nav-badge">${dueReviewCount()}</b>` : ''}</a>`).join('')}
        </nav>
        <main class="main-content" id="main-content" tabindex="-1">${storageIssue ? `<aside class="notice-card storage-warning" role="alert"><p>${escapeHTML(storageIssue)}</p><button type="button" class="button secondary" data-action="export-data">学習データを書き出す</button>${storageConflict ? '<button type="button" class="button secondary" data-action="force-save">このタブの内容で上書き保存する</button><p class="small-note">上書きすると、別のタブで新しく記録された内容は失われます。このタブの変更を残したい場合だけ使ってください。</p>' : ''}${recoveryRaw ? '<button type="button" class="button secondary" data-action="export-recovery">保管した元データを書き出す</button>' : ''}</aside>` : ''}${ui.contentWarning ? `<aside class="notice-card" role="alert"><p>${escapeHTML(ui.contentWarning)}</p></aside>` : ''}${routeView}</main>
      </div>
      <footer class="app-footer"><span>学習データはこのブラウザー内に保存されます。</span><span>教材進捗：${originalMaterialSectionCount()}節に独自日本語ノート・発展教材・図解を収録（原書の翻訳本文は未収録）</span></footer>
    </div>${ui.pendingQuizStart ? renderQuizStartConfirm() : ''}`;
  for(const block of root.querySelectorAll('.guide-body,.simulation-steps'))linkTermTextNodes(block,glossary||[]);
  if(ui.reportId)document.querySelector('.report-modal button')?.focus();
  if(ui.pendingQuizStart)document.querySelector('.quiz-start-modal [data-action="confirm-quiz-start"]')?.focus();
  restoreTransientUi(transientSnapshot);
  ui.renderedRoute=ui.route;
}

function routeContent() {
  const routes = { home: renderHome, reader: renderReader, search: renderSearch, glossary: renderGlossary, quiz: renderQuiz, review: renderReview, plan: renderPlan, calendar: renderCalendar, map: renderMap, simulator: renderSimulator, settings: renderSettings, guide: renderGuide };
  return (routes[ui.route] || renderHome)();
}

function learningContext(){
  if(ui.route==='reader'&&sectionIsTranslated(getSection(ui.readerSection)))return {kind:'reading',sectionId:ui.readerSection,field:getSection(ui.readerSection)?.chapterTitle||''};
  if(ui.route==='quiz'&&ui.quiz)return {kind:'practice',sessionId:ui.quiz.id||'',field:getQuestion(ui.quiz.ids[ui.quiz.index])?.field||''};
  if(ui.route==='review')return {kind:'review'};
  if(ui.route==='simulator')return {kind:'simulation',field:SIM_META[ui.simMode]?.title||''};
  if(ui.route==='glossary')return {kind:'glossary'};
  return null;
}
function flushLearningTime(save=false){
  const now=Date.now(),visible=document.visibilityState!=='hidden'&&(!document.hasFocus||document.hasFocus());
  const until=Math.min(now,lastInteractionAt+90000),context=book&&activityWasVisible?learningContext():null;
  if(context&&until>activityTick)state.activities=recordStudyActivity(state.activities,context,activityTick,until,activityPageId);
  activityTick=now;activityWasVisible=visible;if(save){persistQuiz();saveState();}
}
function persistQuiz(){
  if(!ui.quiz)return;
  const q=ui.quiz;
  q.id ||= makeId();q.startedAt ||= Date.now();q.hintCount ||= 0;q.confidence ||= 'medium';
  q.signatures ||= Object.fromEntries(q.ids.map(id=>[id,questionFingerprint(getQuestion(id)||{id})]));
  const draft=structuredClone(q);
  delete draft.updatedAt;
  const previous=state.quizDraft;
  if(previous){
    // An idle in-progress tab re-persists on a timer; if the draft content is
    // unchanged, keep the existing stamp so storage is not rewritten (which
    // would make every other open tab look stale and block its saves).
    const {updatedAt:_previousStamp,...previousBody}=previous;
    if(JSON.stringify(previousBody)===JSON.stringify(draft))return;
  }
  state.quizDraft={...draft,updatedAt:new Date().toISOString()};
}
function resumeQuiz(){
  const issue=quizResumeIssue(state.quizDraft,questionBank);
  if(issue){showStatus(issue);return;}
  flushLearningTime();
  ui.quiz=structuredClone(state.quizDraft);ui.quizResult=null;lastInteractionAt=Date.now();setRoute('quiz');
}
function renderQuizResume(){
  if(!state.quizDraft)return '';
  const issue=quizResumeIssue(state.quizDraft,questionBank);
  return `<aside class="notice-card quiz-resume"><div><strong>中断した演習があります</strong><p>${state.quizDraft.index+1} / ${state.quizDraft.ids.length}問目 · 回答履歴は保存されています。</p>${issue?`<p role="status">${escapeHTML(issue)}</p>`:''}<div class="button-row"><button class="button primary" type="button" data-action="resume-quiz" ${issue?'disabled':''}>中断した演習を再開</button><button class="text-button" type="button" data-action="discard-quiz">この中断セットを破棄</button></div></div></aside>`;
}
function pageHeading(eyebrow, title, description = '', actions = '') {
  const guideLink={home:'start',reader:'reader',quiz:'quiz',review:'review',search:'search',glossary:'search',map:'progress',simulator:'simulator',plan:'plan',calendar:'plan',settings:'data'}[ui.route];
  const help=guideLink?`<a class="text-link page-help" href="#guide/${guideLink}">この画面の使い方 →</a>`:'';
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p class="page-description">${description}</p>` : ''}</div>${actions||help ? `<div class="heading-actions">${actions}${help}</div>` : ''}</div>`;
}
function focusGuideSection(id){const section=document.getElementById(`guide-${id}`);section?.scrollIntoView({block:'start'});section?.focus({preventScroll:true});}
function renderGuide() {
  const matches=searchGuide(ui.guideQuery);
  return `${pageHeading('使い方・学習ガイド','操作と熱移動の考え方を学ぶ','基本操作、4つのシミュレーターのモデル、書籍11章に対応する独立作成の日本語補助講座を学べます。原本の翻訳ではありません。')}
    <div class="guide-layout"><aside class="surface-card guide-toc" aria-label="ガイドの目次"><h2>目次</h2><form id="guide-search-form" role="search"><label for="guide-query">ガイド内を検索</label><div class="guide-search-row"><input id="guide-query" name="query" type="search" value="${escapeHTML(ui.guideQuery)}" placeholder="例：放射率、復元、復習"/><button type="submit" class="button secondary">探す</button></div></form><nav aria-label="ガイドの項目">${GUIDE_SECTIONS.map(section=>`<a href="#guide/${section.id}">${escapeHTML(section.title)}</a>`).join('')}</nav></aside>
    <div class="guide-results"><p class="guide-count" role="status">${ui.guideQuery?`「${escapeHTML(ui.guideQuery)}」の検索結果：${matches.length}項目`:`全${GUIDE_SECTIONS.length}項目 · アプリ作成の説明`}</p>${matches.length?matches.map(section=>`<section class="surface-card guide-section" id="guide-${section.id}" tabindex="-1"><p class="eyebrow">${section.bookChapter ? `独立作成の章別補助講座 · 第${escapeHTML(section.bookChapter.slice(2))}章` : `使い方・学習ガイド`}</p><h2>${escapeHTML(section.title)}</h2><p class="guide-summary">${escapeHTML(section.summary)}</p><div class="guide-body">${section.html}</div>${section.bookChapter ? `<div class="button-row"><button type="button" class="button secondary" data-chapter-practice="${escapeHTML(section.bookChapter)}">第${escapeHTML(section.bookChapter.slice(2))}章の問題に挑戦 →</button><small>収録済みの独自・書籍出典問題に限ります。原本全節の理解度評価ではありません。</small></div>` : ''}<a class="text-link" href="#guide">ガイドの先頭へ ↑</a></section>`).join(''):'<div class="surface-card guide-empty"><p>該当する説明が見つかりませんでした。別の言葉で検索してください。</p></div>'}</div></div>`;
}
function statusPill(text, tone = 'neutral') { return `<span class="status-pill tone-${tone}">${text}</span>`; }
function translatedSectionCount() { return allSections().filter(sectionIsTranslated).length; }
function originalMaterialSectionCount() { return allSections().filter(section => independentNoteForSection(originalNotes, section.id) || deepLessonForSection(deepLessons, section.id)).length; }
function countReadSections() { return allSections().filter(s=>state.readSections[s.id]).length; }
function lastSectionLabel() { const section = getSection(state.lastSection); return section ? `第${section.id}節「${escapeHTML(section.title)}」` : '第1章1.1節「熱移動」'; }
function getAttemptStats(id) { const question=getQuestion(id); const attempts = state.attempts.filter(attempt => attempt.questionId === id && isCurrentQuestionAnswer(question,attempt)); const correct = attempts.filter(attempt => attempt.correct).length; return { attempts, correct, accuracy: attempts.length ? correct / attempts.length : null }; }
function questionsByField() { const fields = new Map(); for (const q of questionBank) { const field = q.field || 'その他'; fields.set(field, (fields.get(field) || 0) + 1); } return fields; }
function dueReviewCount() { return reviewCandidates().filter(item => item.due <= todayISO()).length; }
function reviewCandidates() {
  const items = [];
  for (const q of questionBank) {
    const { attempts, accuracy } = getAttemptStats(q.id);
    const hasOutdatedAnswer=state.attempts.some(a=>a.questionId===q.id&&!isCurrentQuestionAnswer(q,a));
    // "Latest" is defined by answer time everywhere in the app (field map,
    // field progress); storage order must not change the outcome.
    const ordered=[...attempts].sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime());
    const recent = ordered.at(-1);
    const review = state.reviews[q.id];
    const recentAt=recent?new Date(recent.at).getTime():null;
    // The fallback due date follows the same interval table as a fresh
    // answer (nextReviewDays over the attempts before the latest one).
    const due = !recent && hasOutdatedAnswer ? todayISO() : review?.dueDate || (recent ? addDaysISO(localDay(new Date(recentAt)), nextReviewDays(ordered.slice(0,-1), recent)) : '9999-12-31');
    const reasons = [];
    if(!recent&&hasOutdatedAnswer)reasons.push('問題改訂後の再回答が必要');
    const reviewedAfterLastAttempt = Boolean(review?.lastReviewedAt && recent && new Date(review.lastReviewedAt).getTime() >= recentAt);
    if (!reviewedAfterLastAttempt && recent) {
      if (!recent.correct) reasons.push('直近の誤答');
      // Mistake-based reasons describe the current state since the last
      // completed review, not the whole history: two or more solid correct
      // answers in a row mean the weakness is recovered, and answers given
      // before a completed review must not revive old reasons.
      const windowStart=review?.lastReviewedAt?new Date(review.lastReviewedAt).getTime():-Infinity;
      const window=ordered.filter(a=>new Date(a.at).getTime()>windowStart);
      let streak=0; for(const a of [...window].reverse()) {if(!a.correct||a.confidence==='low'||a.confidence==='unsure')break;streak++;}
      if (streak<2) {
        const wrongCount=window.filter(a=>!a.correct).length;
        if (wrongCount>=2) reasons.push(`誤答${wrongCount}回`);
        if (window.length>=3) { const windowAccuracy=window.filter(a=>a.correct).length/window.length; if (windowAccuracy<0.6) reasons.push(`正答率${Math.round(windowAccuracy*100)}%（3回以上）`); }
      }
      if (recent.confidence === 'low' || recent.confidence === 'unsure') reasons.push(recent.correct ? '正解したが自信が低い' : '自信が低い・迷った');
    }
    if (due <= todayISO() && attempts.length) reasons.push('復習予定日を過ぎている');
    if (!reasons.length) continue;
    items.push({ question: q, reasons: [...new Set(reasons)], due, attempts: attempts.length, accuracy });
  }
  return items.sort((a, b) => a.due.localeCompare(b.due) || b.reasons.length - a.reasons.length);
}
function renderHome() {
  const recentSession = state.sessions.at(-1);
  const recentWrong=(recentSession?.answers||[]).filter(a=>!a.correct).map(a=>a.questionId);
  const plan = state.plan;
  const readPercent = allSections().length ? Math.round(countReadSections() / allSections().length * 100) : 0;
  const todayAttempts = new Set(state.attempts.filter(attempt => localDay(attempt.at) === todayISO()).map(attempt=>attempt.questionId)).size;
  const contentPercent = translatedSectionCount() / allSections().length * 100;
  return `${pageHeading('学習ホーム', '次に進むことが、ひと目でわかる。', '読んで、問題を解いて、あとで振り返る。今日のペースで始めましょう。')}
    <section class="hero-card">
      <div class="hero-copy"><p class="eyebrow">学習の続き</p><h2>${lastSectionLabel()}</h2><p>節の目次から原本PDFの対応ページを開けます。読書位置は節ごとに保存されるので、前回の続きから再開できます。</p>
        <div class="hero-actions"><a class="button primary" href="#reader" data-open-section="${escapeHTML(state.lastSection)}">原本と目次を開く <span aria-hidden="true">→</span></a><a class="button secondary" href="#quiz">問題を解く</a></div>
      </div><div class="hero-side"><div class="ring-progress" style="--progress:${readPercent}%"><div><strong>${readPercent}%</strong><span>読了した節</span></div></div><small>${countReadSections()} / ${allSections().length} 節を読了（自己記録）</small></div>
    </section>
    ${renderQuizResume()}<div class="home-grid">
      <section class="surface-card today-card"><div class="card-heading"><div><p class="eyebrow">今日の学習</p><h2>無理のない一歩から</h2></div>${statusPill(`${todayAttempts}問回答`, 'blue')}</div>
        <div class="today-action-list"><a href="#review" class="today-action"><span class="action-icon amber">↻</span><span><strong>復習する</strong><small>${dueReviewCount() ? `${dueReviewCount()}問が復習時期です` : '復習候補を確認できます'}</small></span><b>→</b></a><a href="#quiz" data-quick-minutes="5" class="today-action"><span class="action-icon green">5</span><span><strong>5分だけ演習</strong><small>短い問題セットを始める</small></span><b>→</b></a><a href="#reader" class="today-action"><span class="action-icon violet">▤</span><span><strong>原本PDFを読む</strong><small>目次から対応ページへ</small></span><b>→</b></a></div>
      </section>
      <section class="surface-card plan-card"><div class="card-heading"><div><p class="eyebrow">あなたの学習計画</p><h2>${plan.active && plan.goal ? escapeHTML(plan.goal) : '目標を決めてみる'}</h2></div>${statusPill(plan.active ? '計画中' : '未設定', plan.active ? 'green' : 'neutral')}</div>
        ${plan.active && plan.goal ? `<p class="plan-summary">目標日：${formatDate(plan.targetDate)}　·　1日 ${Number(plan.minutesPerDay) || 15} 分</p><p class="muted">今日の学習内容は、学習記録と復習予定をもとに提案します。</p>` : '<p class="muted">目標と1日の時間を決めると、読書・演習・復習の進め方を提案できます。</p>'}<a class="text-link" href="#plan">計画を${plan.active ? '見直す' : '設定する'} <span aria-hidden="true">→</span></a>
      </section>
      <section class="surface-card recent-card"><div class="card-heading"><div><p class="eyebrow">最近の学習</p><h2>${recentSession ? '前回のふり返り' : '記録がここに並びます'}</h2></div><a href="#calendar" class="text-link">すべて見る →</a></div>
        ${recentSession ? `<p class="recent-date">${formatDate(recentSession.date)}</p><div class="recent-stats"><div><strong>${recentSession.total}</strong><span>問</span></div><div><strong>${recentSession.correct}</strong><span>正解</span></div><div><strong>${recentSession.total ? Math.round(recentSession.correct / recentSession.total * 100) : 0}%</strong><span>正答率</span></div></div>${recentWrong.length?`<button class="text-link" type="button" data-start-ids='${escapeHTML(JSON.stringify(recentWrong))}'>間違えた問題にもう一度挑戦 →</button>`:'<a class="text-link" href="#quiz">次の演習を始める →</a>'}` : '<div class="empty-state compact"><span class="empty-mark">✦</span><p>学習を始めると、取り組んだ分野や復習予定をここで振り返れます。</p></div>'}
      </section>
    <section class="surface-card focus-card"><div class="card-heading"><div><p class="eyebrow">教材の進み具合</p><h2>全訳までの道のり</h2></div><a href="#reader" class="text-link">目次を見る →</a></div><div class="progress-line"><span style="width:${contentPercent}%"></span></div><p class="progress-caption"><strong>${translatedSectionCount()}節 / ${allSections().length}節</strong>の翻訳本文を収録。翻訳本文が未収録の節では、独自日本語ノート・発展教材・図解と英語原本PDFで学習できます。</p><p class="small-note">収録節数の比率です。ページ全体の翻訳・確認完了率ではありません。専門家校閲は未実施です。</p></section>
    </div>`;
}

function linkedReaderText(value,limit=3){
  return renderTermLinks(value,glossary||[],{limit,highlights:ui.readerQuery?searchRanges(value,ui.readerQuery):[]});
}
function renderDeepLesson(lesson) {
  const esc=escapeHTML, mark=value=>linkedReaderText(value);
  const paragraphs=lesson.blocks.map((b,i)=>'<section class="deep-lesson-block" id="reader-block-'+esc(lesson.sectionId+'-deep-'+i)+'"><h4>'+mark(b.heading)+'</h4><p>'+mark(b.text)+'</p></section>').join('');
  const equations=lesson.equations.map((e,i)=>'<div class="deep-equation" id="reader-block-'+esc(lesson.sectionId+'-equation-'+i)+'"><strong>'+mark(e.label)+'</strong><p class="deep-expression">'+renderMathText(e.expression,ui.readerQuery||'')+'</p><p>'+mark(e.meaning)+'</p></div>').join('');
  const example=lesson.workedExample;
  const steps=example.steps.map((line,i)=>'<li><strong>手順'+(i+1)+'</strong> '+mark(line)+'</li>').join('');
  const pitfalls=lesson.pitfalls.map(text=>'<li>'+mark(text)+'</li>').join('');
  const sources=lesson.references.map(ref=>'<li><a class="text-link" target="_blank" rel="noopener noreferrer" href="'+esc(ref.url)+'" aria-label="'+esc(ref.title)+' ↗（別タブで開く）">'+esc(ref.title)+' ↗</a></li>').join('');
  return '<section class="reader-deep-lesson surface-card" id="reader-deep-lesson" lang="ja" aria-labelledby="deep-lesson-heading">'
    +'<p class="eyebrow">第'+esc(lesson.sectionId)+'節：独立作成の発展学習教材</p>'
    +'<h3 id="deep-lesson-heading"><span id="reader-block-'+esc(lesson.sectionId+'-deep-overview')+'"></span>'+mark(lesson.title)+'</h3>'
    +'<p class="small-note"><strong>原本の全文翻訳ではありません。外部専門家校閲前。</strong> 一般的な物理法則と確認可能な資料から独立執筆し、原本の表現・図版を転載していません。</p>'
    +'<p><strong>到達目標：</strong>'+mark(lesson.objective)+'</p>'+paragraphs
    +'<h4>代表式・単位・適用条件</h4>'+equations
    +'<section class="deep-worked-example" id="reader-block-'+esc(lesson.sectionId+'-deep-example')+'"><h4>解き方を追う：'+mark(example.title)+'</h4><p>'+mark(example.problem)+'</p><ol>'+steps+'</ol><p><strong>計算結果：</strong>'+mark(example.answer)+'</p><p><strong>仮定と限界：</strong>'+mark(example.limitations)+'</p></section>'
    +'<div id="reader-block-'+esc(lesson.sectionId+'-deep-pitfalls')+'"><h4>誤用しやすいポイント</h4><ul>'+pitfalls+'</ul></div>'
    +'<h4>独立講義で確認した関連資料</h4><ul>'+sources+'</ul>'
    +'<p class="small-note">'+esc(lesson.reviewStatus)+'</p></section>';
}
function renderReader() {
  const section = getSection(ui.readerSection) || getSection('1.1');
  ui.readerSection = section.id;
  state.lastSection = section.id; saveState();
  const chapter = book.chapters.find(item => item.id === section.chapterId);
  const independentChapterGuide = GUIDE_SECTIONS.find(item=>item.bookChapter===section.chapterId);
  const independentNote=independentNoteForSection(originalNotes,section.id);
  const deepLesson=deepLessonForSection(deepLessons,section.id);
  const independentQuestion=questionBank.find(q=>q.source?.sectionNoteId===section.id);
  const independentApplications=questionBank.filter(q=>q.source?.focusSectionId===section.id);
  const available = sectionIsTranslated(section);
  const hasOriginalMaterials = Boolean(independentNote || deepLesson);
  const hasEnglish = Array.isArray(section.blocksEn);
  const contentLanguage = hasEnglish && state.settings.contentLanguage === 'en' ? 'en' : 'ja';
  const displayTitle = contentLanguage === 'en' ? (section.sourceTitle || section.title) : section.title;
  const progress = section.translationProgress;
  const inProgress = section.translationStatus === 'in_progress';
  const draftComplete = section.translationStatus === 'draft_complete';
  const privateOnly = section.translationStatus === 'private_only';
  const draftLabel = privateOnly ? '日本語訳は未収録' : draftComplete ? '原書の翻訳下書きは未移行' : inProgress ? '原書の翻訳作業記録は未移行' : '日本語訳は未着手';
  const draftHeading = privateOnly ? '日本語訳・再構成した本文は公開していません' : draftComplete ? '旧PCに翻訳下書きの作成記録があります' : inProgress ? '旧PCに翻訳作業中の記録があります' : 'この節の日本語訳は、まだ用意されていません';
  const draftDescription = (privateOnly ? '英語の原本PDFは下のリンクから読めます。日本語訳、アプリ用に抽出した原文と原図の再配布は別に管理し、この画面には未収録です。' : draftComplete || inProgress ? `記録上の範囲は書籍 pp.${escapeHTML(progress?.draftBookPages || '確認中')}（PDF pp.${escapeHTML(progress?.draftPdfPages || '確認中')}）です。下書きの実物はこのクラウド環境に未移行で、本文の網羅性や確認状態は再検証できていません。英語原本PDFは下から読めます。` : '原本PDFの対応ページを開いて読めます。日本語訳を推測して表示することはしていません。') + (hasOriginalMaterials ? 'なお、この節については独自作成の日本語ノート・発展教材・図解を、このページ内の上の欄に収録しています（原書の翻訳本文ではありません）。' : '');
  const pdfPage=Number(section.pdfStart);
  const pdfHref=`./book/AHTTv600.pdf#page=${Number.isInteger(pdfPage)&&pdfPage>=1&&pdfPage<=810?pdfPage:1}`;
  const pdfLink=`<a class="button primary" href="${pdfHref}" target="_blank" rel="noopener" aria-label="原本PDFを開く · PDF p.${Number.isInteger(pdfPage)?pdfPage:1} ↗（別タブ）">原本PDFを開く · PDF p.${Number.isInteger(pdfPage)?pdfPage:1} ↗</a>`;
  const blocks = available ? section[contentLanguage === 'en' ? 'blocksEn' : 'blocks'].map((block,index) => `<div class="source-block" id="reader-block-${escapeHTML(block.id || `${section.id}-b${index}`)}" data-block-id="${escapeHTML(block.id || `${section.id}-b${index}`)}" data-book-page="${escapeHTML(block.bookPage || '')}"><small class="block-source">${escapeHTML(blockSourceLabel(block))}</small>${renderBookBlock(block,contentLanguage)}</div>`).join('') : `<div class="not-translated"><span class="large-status">${draftLabel}</span><h2>${draftHeading}</h2><p>${draftDescription}</p><div class="source-reference">原本：${escapeHTML(section.sourceTitle || section.title)}<br>書籍 p.${section.bookStart ?? '台帳未記録'}–${section.bookEnd ?? '未確認'} · PDF p.${section.pdfStart ?? '台帳未記録'}–${section.pdfEnd ?? '未確認'}</div><div class="button-row">${pdfLink}<a class="button secondary" href="#settings">教材の進捗を見る</a></div></div>`;
  const dynamicExperiment=dynamicLinkForSection(section.id);
  const sectionBookmarks = state.bookmarks.filter(bookmark => bookmark.sectionId === section.id);
  const editingNote=state.notes.find(n=>n.id===ui.noteEditId&&n.sectionId===section.id);
  const prevNext = allSections(); const index = prevNext.findIndex(item => item.id === section.id);
  const prev = prevNext[index-1];
  const next = prevNext[index+1];
  return `${pageHeading('読書モード', '章・節をたどって読む', '原本PDFの対応ページを開けます。書籍の日本語訳は公開版に収録していません。自分の訳稿などをローカル教材として追加した場合は、その本文を段落や式とともに表示します。全節に独自作成の日本語ノート・発展教材・図解を収録しています。読了・しおり・メモはこの端末に保存します。', '<a class="button secondary" href="#search">本文を検索</a>')}
    <div class="reader-layout">
      <aside class="reader-toc surface-card"><div class="toc-heading"><span class="eyebrow">目次</span><strong>A Heat Transfer Textbook</strong></div>
        ${book.chapters.map(item => `<details ${item.id === section.chapterId ? 'open' : ''}><summary><span>${escapeHTML(item.title)}</span><small>第${item.id.slice(2)}章</small></summary><div class="toc-items">${item.sections.map(sec => `<button class="toc-item ${sec.id === section.id ? 'selected' : ''} ${sectionIsTranslated(sec) ? '' : 'not-ready'}" type="button" data-section="${escapeHTML(sec.id)}"><span class="toc-number">${escapeHTML(sec.id)}</span><span>${escapeHTML(sec.title)}</span><i>${sectionProgressLabel(sec)}</i></button>`).join('')}${(item.backMatter || []).map(entry => `<div class="toc-item not-ready" aria-label="${escapeHTML(entry.title)}、${sectionProgressLabel(entry)}"><span class="toc-number">—</span><span>${escapeHTML(entry.title)}</span><i>${sectionProgressLabel(entry)}</i></div>`).join('')}</div></details>`).join('')}
        <details class="all-bookmarks"><summary>すべてのしおり（${state.bookmarks.length}件）</summary>${state.bookmarks.map(b=>`<button type="button" class="toc-item" data-bookmark="${escapeHTML(b.id)}"><span>第${escapeHTML(b.sectionId)}節 · 書籍 p.${b.bookPage||'未記録'}</span><span>${escapeHTML(b.note||'メモなし')}</span></button>`).join('')||'<p>しおりはまだありません。</p>'}</details><div class="appendix-list"><span class="eyebrow">付録・索引</span>${book.appendices.map(item => `<div class="appendix-row"><span>${escapeHTML(item.title)}</span>${statusPill('未着手')}</div>`).join('')}</div>
      </aside>
      <article class="reader-panel surface-card" id="reader-article">
        <div class="reader-toolbar"><div class="language-toggle" role="group" aria-label="本文の表示言語"><button type="button" class="${contentLanguage === 'ja' ? 'selected' : ''}" data-language="ja" aria-pressed="${contentLanguage === 'ja'}">日本語</button><button type="button" class="${contentLanguage === 'en' ? 'selected' : ''}" data-language="en" ${hasEnglish ? '' : 'disabled'} aria-pressed="${contentLanguage === 'en'}">英語</button></div><span class="language-note">${hasEnglish ? (contentLanguage === 'ja' ? '日本語訳' : '英語版') : '英語原文は原本PDFで閲覧'}</span><button class="icon-button" type="button" data-action="reader-width" title="本文の幅を切り替え" aria-label="本文の幅を切り替え">↔</button><button class="icon-button" type="button" data-action="reader-font-down" aria-label="文字を小さくする A−">A−</button><button class="icon-button" type="button" data-action="reader-font-up" aria-label="文字を大きくする A＋">A＋</button><button class="icon-button" type="button" data-action="reader-line" aria-label="行間を調整">↕</button><button class="icon-button" type="button" data-action="speak" ${available ? '' : 'disabled'} aria-label="本文を読み上げる">▶ 読み上げ</button><button class="icon-button" type="button" data-action="stop-speech" aria-label="読み上げを停止">■ 停止</button><button class="button secondary" type="button" data-action="prepare-bookmark">この位置にしおり</button></div>
        <div class="reader-meta"><span>${escapeHTML(chapter.part)} · 第${section.chapterId.slice(2)}章</span><span>書籍 p.${section.bookStart}–${section.bookEnd ?? '未確認'} · PDF p.${section.pdfStart}–${section.pdfEnd ?? '未確認'}</span></div>
        <div class="reader-pdf-actions">${available?pdfLink:''}<a class="button secondary" href="./book/AHTTv600.pdf" download="AHTTv600.pdf">原本PDFをダウンロード · 約31MB</a><button class="button secondary" type="button" data-action="cache-pdf" ${ui.pdfCacheStatus==='saving'?'disabled':''}>原本PDFをオフライン保存</button></div><p class="small-note" id="pdf-cache-status" role="status">${pdfCacheStatusLabel()}</p>
        <p class="small-note">原本PDFは英語版です。翻訳本文・原図の再利用とは権利を分けて扱います。PDFビューアーによっては指定ページへ自動移動しません。オフライン保存には空き容量と対応ブラウザーが必要です。</p>
        <h2 class="reader-title">${escapeHTML(section.id)}　${escapeHTML(displayTitle)}</h2>
        <div class="reader-status-row">${statusPill(available ? (section.localDraft ? '訳文下書き・未照合' : section.localSourceChecked ? '原本照合済み（作業者）' : '翻訳済み') : draftLabel, available ? section.localDraft ? 'amber' : 'green' : 'neutral')}${statusPill(available ? section.localDraft ? '文章・式・図表の照合待ち' : '専門家校閲待ち' : hasOriginalMaterials ? '独自日本語教材を収録' : privateOnly ? '訳文等の公開範囲を確認中' : draftComplete ? '確認待ち・アプリ未収録' : inProgress ? '下書きはアプリ未収録' : '日本語訳は未収録', available ? 'amber' : hasOriginalMaterials ? 'blue' : 'amber')}</div>
        ${section.localDraft ? '<aside class="notice-card compact-notice"><p>この訳文は以前のPCで作成した下書きです。原本との文章・数式・図表・ページの網羅性を再確認していません。学習時は英語原本PDFと照らし合わせてください。</p></aside>' : ''}
        ${independentNote ? `<section class="reader-original-note surface-card" id="reader-original-note" aria-labelledby="original-note-heading" lang="ja">
        <p class="eyebrow">第${escapeHTML(section.chapterId.slice(2))}章 · 第${escapeHTML(section.id)}節に関連する独自日本語ノート</p>
        <h3 id="original-note-heading">${linkedReaderText(independentNote.objective,4)}</h3>
        <p class="small-note"><strong>独立執筆・学術校閲前。</strong>原本の翻訳、節の全文掲載、図表の転載ではありません。原本の節との逐文対応は未検証です。</p>
        <dl class="original-note-fields">
          <dt>考え方</dt><dd>${linkedReaderText(independentNote.explanation,4)}</dd>
          <dt>代表式・用語</dt><dd>${linkedReaderText(independentNote.relation,4)}</dd>
          <dt>具体例</dt><dd>${linkedReaderText(independentNote.example,4)}</dd>
          <dt>適用条件と注意点</dt><dd>${linkedReaderText(independentNote.limits,4)}</dd>
          <dt>理解度チェック</dt><dd>${linkedReaderText(independentNote.selfCheck,4)}</dd>
          <dt>考え方・答え</dt><dd><details><summary>答えを確認する</summary><p>${linkedReaderText(independentNote.answer,4)}</p></details></dd>
        </dl>
        <div class="button-row">${independentQuestion?`<button type="button" class="button secondary" data-start-question="${escapeHTML(independentQuestion.id)}">この節の確認問題を解く →</button>`:''}${independentApplications.map(q=>`<button type="button" class="button secondary" data-start-question="${escapeHTML(q.id)}">この節の応用計算を解く →</button>`).join('')}<a class="text-link" href="#guide/${escapeHTML(independentChapterGuide?.id||'start')}">章別の独立補助講座を読む →</a></div>
        </section>` : ''}
        ${deepLesson ? renderDeepLesson(deepLesson) : ''}
        ${renderLessonDiagram(section.id)}
        ${dynamicExperiment?`<aside class="notice-card" aria-label="関連する動的実験"><div><strong>数値計算で現象を観察</strong><p>アプリ作成の代表条件を使う別の実験です。原本の翻訳や例題の数値を再現するものではありません。</p><a class="text-link" href="${escapeHTML(dynamicExperiment.href)}" target="_blank" rel="noopener">${escapeHTML(dynamicExperiment.label)}（別タブ）→</a></div></aside>`:''}
        ${independentChapterGuide ? `<aside class="notice-card" aria-label="独立作成の章別補助講座"><span class="notice-icon" aria-hidden="true">i</span><div><strong>この章の日本語補助講座</strong><p>原本の翻訳・節本文ではありません。伝熱・物質移動の考え方を独立した例と式で説明します。</p><a class="text-link" href="#guide/${escapeHTML(independentChapterGuide.id)}"> ${escapeHTML(independentChapterGuide.title)} を開く →</a></div></aside>` : ''}
        ${available ? `<div class="book-content" lang="${contentLanguage}">${blocks}</div>` : blocks}
          <p class="small-note">原本PDFを読んだ後の読了・しおり・メモは自分で記録してください。PDFビューアー内の位置は自動取得できません。</p>
          <div class="reader-actions"><button type="button" class="button ${state.readSections[section.id] ? 'secondary' : 'primary'}" data-action="toggle-read">${state.readSections[section.id] ? '✓ 読了に記録済み' : 'この節を読了にする'}</button><form class="bookmark-form" id="bookmark-form"><label for="bookmark-note">しおりのメモ（任意）</label><div class="inline-form"><input id="bookmark-note" name="note" type="text" maxlength="180" placeholder="あとで見返したい点"/><button class="button secondary" type="submit">しおりを付ける</button></div></form></div>
          <form class="reader-personal-note" id="reader-note-form"><p class="eyebrow">自分の学習メモ</p><div class="form-two"><label>見出し<input name="title" type="text" maxlength="100" value="${escapeHTML(editingNote?.title||'')}" placeholder="例：大事な考え方"/></label><label>メモ<textarea name="text" rows="2" maxlength="1000" placeholder="自分の言葉で整理しておく">${escapeHTML(editingNote?.text||'')}</textarea></label></div><button class="button ghost" type="submit">${editingNote?'メモの変更を保存':'この節にメモを保存'}</button>${editingNote?'<button type="button" class="text-button" data-action="cancel-note-edit">編集を取り消す</button>':''}</form>
          ${state.notes.filter(note => note.sectionId === section.id).map(note => `<div class="reader-note-entry"><strong>${escapeHTML(note.title || '学習メモ')}</strong><p>${escapeHTML(note.text)}</p><small>${formatDate(localDay(note.createdAt))}</small><button type="button" class="text-button" data-edit-note="${escapeHTML(note.id)}">編集</button><button type="button" class="text-button" data-delete-note="${escapeHTML(note.id)}">削除</button></div>`).join('')}
          ${sectionBookmarks.length ? `<div class="bookmark-list"><h3>この節のしおり</h3>${sectionBookmarks.map(bookmark => `<div class="bookmark-row"><label>しおりのメモ<input type="text" maxlength="180" data-bookmark-note="${escapeHTML(bookmark.id)}" value="${escapeHTML(bookmark.note)}"/><small>${formatDate(localDay(bookmark.createdAt))} · 書籍 p.${bookmark.bookPage || '未記録'}${bookmark.blockId?'':'（節の開始）'}</small></label><button type="button" class="text-button" data-bookmark="${escapeHTML(bookmark.id)}">${bookmark.blockId?'この位置へ':'この節へ'}</button><button type="button" class="text-button" data-delete-bookmark="${escapeHTML(bookmark.id)}">削除</button></div>`).join('')}</div>` : ''}
        <div class="reader-pager"><button class="button ghost" type="button" ${prev ? `data-section="${prev.id}"` : 'disabled'}>← 前の節${prev ? ` · ${escapeHTML(prev.title)}` : ''}</button><button class="button ghost" type="button" ${next ? `data-section="${next.id}"` : 'disabled'}>次の節${next ? ` · ${escapeHTML(next.title)}` : ''} →</button></div>
      </article>
    </div>`;
}

function renderBookBlock(block, language = 'ja') {
  const text = linkedReaderText(block.text||'',5).replaceAll('\n', '<br>');
  if (block.type === 'heading') return `<h3 class="book-subheading">${text}</h3>`;
  if (block.type === 'subheading') return `<h4 class="book-subheading book-subheading-minor">${text}</h4>`;
  if (block.type === 'example') return `<section class="book-example"><h4>${escapeHTML(block.title || (language === 'en' ? 'Example' : '例題'))}</h4><p>${text}</p></section>`;
  if (block.type === 'quote') return `<blockquote class="book-quote"><p>${text}</p><cite>${escapeHTML(block.attribution || '')}</cite></blockquote>`;
  if (block.type === 'experiment') return `<section class="experiment"><div class="experiment-label">${language === 'en' ? 'Experiment' : '実験'}</div><h3>${escapeHTML(block.title)}</h3><p>${text}</p></section>`;
  if (block.type === 'footnote') return `<aside class="footnote"><sup>${escapeHTML(block.marker)}</sup><p>${text}</p></aside>`;
  if (block.type === 'formula') return `<figure class="formula-block" aria-label="${escapeHTML(block.alt || block.expression)}"><div class="formula">${renderMathText(block.expression,ui.readerQuery||'').replaceAll('\n', '<br>')}</div>${block.number ? `<figcaption>${language === 'en' ? 'Eq. (' + escapeHTML(block.number) + ')' : '式（' + escapeHTML(block.number) + '）'}</figcaption>` : ''}${block.explanation || block.text ? `<p>${highlight(block.explanation || block.text, ui.readerQuery || '')}</p>` : ''}</figure>`;
  if (block.type === 'supplement') return `<aside class="book-supplement"><div class="book-supplement-label">${language === 'en' ? 'App-created explanation' : '補足説明'}</div><h4>${escapeHTML(block.title || (language === 'en' ? 'Supplement' : '補足説明'))}</h4><p>${text}</p>${block.reference ? `<small>${language === 'en' ? 'Basis and scope: ' : '根拠・位置付け：'}${escapeHTML(block.reference)}</small>` : ''}</aside>`;
  if (block.type === 'sourceNote') return `<aside class="book-source-note"><div class="book-source-note-label">${language === 'en' ? 'Source notation to verify' : '原本表記の確認事項'}</div><p>${text}</p>${block.bookPage ? `<small>${language === 'en' ? 'Source: book p.' : '出典：書籍 p.'}${escapeHTML(block.bookPage)} · PDF p.${escapeHTML(block.pdfPage ?? '')}</small>` : ''}</aside>`;
  if (block.type === 'figure') return `<figure class="book-figure">${block.src ? `<img src="${escapeHTML(block.src)}" alt="${escapeHTML(block.alt || (language === 'en' ? 'Figure description' : '図の代替説明'))}" loading="lazy" ${figureSizeAttributes(block)}/>` : `<div class="figure-placeholder">${escapeHTML(block.alt || (language === 'en' ? 'Figure description' : '図の代替説明'))}</div>`}<figcaption>${figureZoomLink(block.src)}<strong>${escapeHTML(block.caption || '')}</strong>${block.description || block.text ? `<span>${highlight(block.description || block.text, ui.readerQuery || '')}</span>` : ''}<small>${language === 'en' ? 'Source: book' : '出典：本書'} Fig. ${escapeHTML(block.figureNumber || '')} · ${language === 'en' ? 'book p.' : '書籍 p.'}${escapeHTML(block.bookPage ?? 'unrecorded')} · PDF p.${escapeHTML(block.pdfPage ?? 'unrecorded')}</small></figcaption></figure>`;
  if (block.type === 'table') {
    const note = language === 'en' ? (block.noteEn || block.note) : (block.noteJa || block.note);
    return `<div class="table-wrap"><table><caption>${escapeHTML(block.caption || '')}</caption><thead><tr>${block.headers.map(item => `<th scope="col">${escapeHTML(item)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(item => `<td>${escapeHTML(item)}</td>`).join('')}</tr>`).join('')}</tbody></table>${note ? `<p class="table-note">${escapeHTML(note)}</p>` : ''}</div>`;
  }
  if (block.type === 'list') return `${block.title ? `<h4 class="book-list-heading">${escapeHTML(block.title)}</h4>` : ''}<ul class="book-list">${block.items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
  if (block.type === 'problem') {
    const label = language === 'en' ? 'Problem' : '問題';
    const source = block.bookPage ? `${block.endBookPage ? `${language === 'en' ? 'book pp.' : '書籍 pp.'}${block.bookPage}–${block.endBookPage}` : `${language === 'en' ? 'book p.' : '書籍 p.'}${block.bookPage}`} · ${block.endPdfPage ? `PDF pp.${block.pdfPage}–${block.endPdfPage}` : `PDF p.${block.pdfPage ?? (language === 'en' ? 'unrecorded' : '未記録')}`}` : '';
    const givenFormulas = block.formulaBlocks?.map(formula => `<figure class="formula-block problem-given-formula"><div class="formula">${escapeHTML(formula.expression || '').replaceAll('\n', '<br>')}</div>${formula.part ? `<figcaption>${language === 'en' ? 'Relation given in part (' + escapeHTML(formula.part) + ')' : '設問（' + escapeHTML(formula.part) + '）に与えられた式'}</figcaption>` : ''}</figure>`).join('') || '';
    const problemFigure = block.figure ? renderBookBlock({ ...block.figure, type: 'figure' }, language) : '';
    const sourceNote = block.sourceNote ? `<aside class="book-source-note"><div class="book-source-note-label">${language === 'en' ? 'Source wording to verify' : '原本表記の確認事項'}</div><p>${escapeHTML(block.sourceNote[language] || block.sourceNote.ja || '')}</p></aside>` : '';
    return `<article class="book-problem"><div class="book-problem-heading"><span class="book-problem-number">${escapeHTML(label)} ${escapeHTML(block.number || '')}</span>${block.figureRefs?.length ? `<span>${language === 'en' ? 'See Fig.' : '参照図'} ${block.figureRefs.map(escapeHTML).join(', ')}</span>` : ''}</div>${text ? `<p>${text}</p>` : ''}${problemFigure}${block.items?.length ? `<ul class="book-problem-list">${block.items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>` : ''}${givenFormulas}${block.continuation ? `<p>${escapeHTML(block.continuation)}</p>` : ''}${block.hint ? `<details class="book-problem-details"><summary>${language === 'en' ? 'Hint' : 'ヒント'}</summary><p>${escapeHTML(block.hint)}</p></details>` : ''}${block.answerHint ? `<details class="book-problem-details"><summary>${language === 'en' ? 'Partial answer printed in the book' : '本書に記載された一部解答'}</summary><p>${escapeHTML(block.answerHint)}</p></details>` : ''}${sourceNote}${source ? `<small class="book-problem-source">${escapeHTML(source)}</small>` : ''}</article>`;
  }
  if (block.type === 'reference') {
    const title = language === 'en' ? (block.originalTitle || block.title) : (block.titleJa || block.title);
    const original = block.originalTitle || block.title;
    const originalTitle = language === 'ja' && (block.titleJa || block.originalTitle) && block.titleJa !== original ? `<p class="reference-original">原題：<em>${escapeHTML(original)}</em></p>` : '';
    const note = language === 'en' ? block.noteEn : block.noteJa;
    const source = block.bookPage ? `${language === 'en' ? 'book p.' : '書籍 p.'}${block.bookPage} · PDF p.${block.pdfPage ?? (language === 'en' ? 'unrecorded' : '未記録')}` : '';
    const url = /^https?:\/\//i.test(block.url || '') ? `<a href="${escapeHTML(block.url)}" rel="noreferrer noopener" target="_blank" aria-label="${escapeHTML(block.url)} ↗（別タブで開く）">${escapeHTML(block.url)} ↗</a>` : '';
    const doi = block.doi ? `<a href="https://doi.org/${escapeHTML(block.doi)}" rel="noreferrer noopener" target="_blank" aria-label="doi:${escapeHTML(block.doi)} ↗（別タブで開く）">doi:${escapeHTML(block.doi)} ↗</a>` : '';
    return `<article class="book-reference"><h4>[${escapeHTML(block.number || '')}] ${escapeHTML(block.authors || '')}</h4><p class="reference-title"><em>${escapeHTML(title || '')}</em></p>${originalTitle}${block.publication ? `<p>${escapeHTML(block.publication)}</p>` : ''}${note ? `<p>${escapeHTML(note)}</p>` : ''}${url || doi ? `<p class="reference-links">${[url, doi].filter(Boolean).join(' · ')}</p>` : ''}${source ? `<small>${escapeHTML(source)}</small>` : ''}</article>`;
  }
  if (block.type === 'paragraph') return `<p class="book-paragraph">${text}</p>`;
  return '';
}

function readerPosition() {
  const blocks=[...document.querySelectorAll('#reader-article .source-block')];
  const block=blocks.filter(b=>b.getBoundingClientRect().top<=150).at(-1)||blocks[0];
  return {scrollY:Math.max(0,window.scrollY),blockId:block?.dataset.blockId||'',offset:block?-block.getBoundingClientRect().top:0,bookPage:Number(block?.dataset.bookPage)||Number(getSection(ui.readerSection)?.bookStart)||null,language:state.settings.contentLanguage,updatedAt:new Date().toISOString()};
}
function saveReaderPosition() {
  if(ui.route!=='reader'||!ui.readerSection)return;
  clearTimeout(saveReaderPosition.timer);
  const section=ui.readerSection,position=readerPosition();
  saveReaderPosition.timer=setTimeout(()=>{state.readerPositions[section]=position;state.lastSection=section;saveState();},300);
}
function captureReaderPosition(){
  if(ui.route!=='reader'||!ui.readerSection||!document.querySelector('#reader-article'))return;
  clearTimeout(saveReaderPosition.timer);state.readerPositions[ui.readerSection]=readerPosition();state.lastSection=ui.readerSection;saveState();
}
function restoreReaderPosition(position) {
  if(!position)return;
  const value=typeof position==='number'?{scrollY:position}:position;
  const block=value.blockId?document.getElementById(`reader-block-${value.blockId}`):null;
  window.scrollTo({top:Math.max(0,block?window.scrollY+block.getBoundingClientRect().top+(value.offset??-100):value.scrollY||0),behavior:'instant'});
}
function openReader(section, options={}) {
  if(!getSection(section))return;
  flushLearningTime();persistQuiz();captureReaderPosition();
  clearTimeout(saveReaderPosition.timer);
  ui.readerSection=section;state.lastSection=section;ui.readerQuery=options.query||'';
  if(['ja','en'].includes(options.language))state.settings.contentLanguage=options.language;
  saveState();ui.quiz=null;ui.quizResult=null;setRoute('reader');
  const position=options.blockId?{blockId:options.blockId,offset:options.offset??-100}:options.position!==undefined?options.position:state.readerPositions[section];
  setTimeout(()=>{
    // Search navigation should reveal the first matching phrase in the actual lesson,
    // rather than opening the chapter at a stale bookmark or at the top.
    // Original-note hits highlight inside the note (the note renders through
    // the same term-link + <mark> path as the deep lesson), so a note hit
    // prefers a mark inside the note over one in the lesson below it.
    const marked=options.query?(options.note?document.querySelector('#reader-original-note mark'):null)||document.querySelector('#reader-deep-lesson mark, #reader-article .book-content mark'):null;
    if(marked){
      window.scrollTo({top:Math.max(0,window.scrollY+marked.getBoundingClientRect().top-110),behavior:'instant'});
      return;
    }
    // If the note matched only through text that is not rendered with a
    // highlight (or highlighting is unavailable), reveal the note section
    // itself instead of restoring a saved position that can hide it.
    if(options.query&&options.note){
      const noteElement=document.querySelector('#reader-original-note');
      if(noteElement){
        window.scrollTo({top:Math.max(0,window.scrollY+noteElement.getBoundingClientRect().top-110),behavior:'instant'});
        return;
      }
    }
    restoreReaderPosition(position);
  },100);
}

function buildSearchIndex() {
  const entries=[];
  for(const section of allSections()) {
    const source=`書籍 p.${section.bookStart}–${section.bookEnd??'未確認'} · PDF p.${section.pdfStart}–${section.pdfEnd??'未確認'}`;
    entries.push({kind:'book',kindLabel:'節の見出し',chapter:section.chapterId,field:section.chapterTitle,title:`${section.id} ${section.title}`,text:section.sourceTitle||'',source,target:{route:'reader',section:section.id,language:'ja'}});
    for(const [language,blocks] of [['ja',section.blocks],['en',section.blocksEn]]) {
      if(!Array.isArray(blocks))continue;
      blocks.forEach((b,i)=>{
        const content=[b.title,b.titleJa,b.authors,b.publication,b.originalCitation,b.noteJa,b.hint,b.answerHint,b.text,b.expression,b.explanation,b.caption,b.alt,b.description,...(b.items||[]),...(b.headers||[]),...(b.rows||[]).flat()].filter(v=>typeof v==='string').join(' ');
        if(content)entries.push({kind:'book',kindLabel:section.localDraft?`本文下書き · ${language==='ja'?'日本語':'英語'}`:language==='ja'?'本文 · 日本語':'本文 · 英語',chapter:section.chapterId,field:section.chapterTitle,chapterTitle:section.chapterTitle,title:`${section.id} ${language==='ja'?section.title:section.sourceTitle||section.title}`,text:content,source:(b.bookPage?`書籍 p.${b.bookPage} · PDF p.${b.pdfPage}`:source)+(section.localDraft?' · 未照合':''),target:{route:'reader',section:section.id,language,blockId:b.id||`${section.id}-b${i}`}});
      });
    }
  }
  // Every section has a short independently authored learning note; not a book translation.
  for(const note of originalNotes?.notes||[]){
    entries.push({kind:'original-note',kindLabel:'独立作成の日本語節別ノート',chapter:note.chapterId,
      field:'節別の独立日本語学習ノート',
      title:note.sectionId+' '+note.title+' · '+note.objective,
      text:[note.explanation,note.relation,note.example,note.limits,note.selfCheck,note.answer].join(' '),
      source:'節別の独立執筆教材 · 原本PDF p.'+note.pdfStart+'から関連事項を確認可能（原本の訳文ではない）',
      target:{route:'reader',section:note.sectionId,language:'ja',note:true}});
  }
  // Independent advanced lectures are searchable only when actually shipped.
  // Do not index untranslated source-book text or non-published local drafts.
  for(const lesson of deepLessons?.lessons||[]){
    const sourceSection=getSection(lesson.sectionId);
    if(!sourceSection)continue;
    const base={kind:'deep-lesson',kindLabel:'独立執筆の発展日本語講義',chapter:chapterKey(lesson.sectionId),field:'独立発展日本語講義',
      source:'原本の日本語訳ではありません · 外部専門家校閲前'};
    const target=blockId=>({route:'reader',section:lesson.sectionId,language:'ja',blockId});
    entries.push({...base,title:'§'+lesson.sectionId+' '+lesson.title,text:lesson.objective,target:target(lesson.sectionId+'-deep-overview')});
    lesson.blocks.forEach((block,i)=>entries.push({...base,title:'§'+lesson.sectionId+' '+block.heading,text:block.text,target:target(lesson.sectionId+'-deep-'+i)}));
    lesson.equations.forEach((equation,i)=>entries.push({...base,title:'§'+lesson.sectionId+' '+equation.label,text:equation.expression+' '+equation.meaning,target:target(lesson.sectionId+'-equation-'+i)}));
    const worked=lesson.workedExample;
    entries.push({...base,title:'§'+lesson.sectionId+' '+worked.title,text:[worked.problem,...worked.steps,worked.answer,worked.limitations].join(' '),target:target(lesson.sectionId+'-deep-example')});
    entries.push({...base,title:'§'+lesson.sectionId+' 誤用しやすいポイント',text:lesson.pitfalls.join(' '),target:target(lesson.sectionId+'-deep-pitfalls')});
  }
  // Search independent original explanations without claiming they are translated book chapters.
  for(const guide of GUIDE_SECTIONS) {
    entries.push({kind:'guide',kindLabel:guide.bookChapter?'独立作成の章別講座':'学習ガイド',
      chapter:guide.bookChapter||'supplement',field:'独立学習ガイド',
      title:guide.title,text:guide.summary+' '+guide.html.replace(/<[^>]*>/g,' '),
      source:guide.bookChapter?'アプリ独自講座・第'+guide.bookChapter.slice(2)+'章':'アプリ独自ガイド',
      target:{route:'guide',guideId:guide.id}});
  }
  for(const term of glossary) {
    entries.push({kind:'glossary',kindLabel:'用語集',chapter:chapterKey(term.source.section),field:'用語集',title:`${term.ja} ${term.en||''}`,text:[term.meaning,term.meaningEn,term.brief,term.beginner,term.detail,term.example,term.unit,term.formula,...(term.aliases||[]),...(term.related||[])].filter(Boolean).join(' '),source:sourceLabel(term.source),target:{route:'glossary',term:term.id,language:'ja'}});
  }
  for(const q of questionBank) {
    const base={chapter:questionChapter(q,GUIDE_SECTIONS)||'supplement',field:q.field,source:sourceLabel(q.source),target:{route:'quiz',question:q.id}};
    entries.push({...base,kind:'question',kindLabel:'問題・解説',title:q.prompt,text:[q.explanation,...q.choices,...(q.distractors||[]),...(q.solutionSteps||[])].join(' ')});
    const n=state.mistakeNotes[q.id];
    if(n)entries.push({...base,kind:'memo',kindLabel:'間違いノート',title:`問題メモ：${q.prompt}`,text:`${n.reason||''} ${n.memory||''} ${n.nextTime||''}`});
  }
  for(const n of state.notes)if(getSection(n.sectionId))entries.push({kind:'memo',kindLabel:'学習メモ',chapter:chapterKey(n.sectionId),field:'メモ',title:n.title||'学習メモ',text:n.text,source:`第${n.sectionId}節`,target:{route:'reader',section:n.sectionId,blockId:n.blockId}});
  for(const b of state.bookmarks)if(getSection(b.sectionId))entries.push({kind:'memo',kindLabel:'本文のしおり',chapter:chapterKey(b.sectionId),field:'しおり',title:`しおり：第${b.sectionId}節`,text:b.note,source:'利用者のしおり',target:{route:'reader',section:b.sectionId,blockId:b.blockId,position:b.position,language:b.language}});
  for(const id of state.questionBookmarks){const q=getQuestion(id);if(q)entries.push({kind:'memo',kindLabel:'問題ブックマーク',chapter:questionChapter(q,GUIDE_SECTIONS)||'supplement',field:q.field,title:q.prompt,text:q.explanation,source:sourceLabel(q.source),target:{route:'quiz',question:id}});}
  return entries;
}
function renderSearch() {
  const results = ui.searchResults || [];
  const shownResults = results.slice(0, ui.searchLimit || 100);
  return `${pageHeading('横断検索', '探したい言葉から、学びへ。', '収録済みの目次見出し、独自の日本語節別ノート76項目、収録済みの独立発展講義、学習ガイド、用語、問題、メモを検索します。未収録の原本訳文は検索できません。')}
    <form id="search-form" class="search-form surface-card"><label for="search-query">検索語</label><div class="search-input-row"><div class="search-input-wrap"><span aria-hidden="true">⌕</span><input id="search-query" name="query" type="search" value="${escapeHTML(ui.search.query)}" placeholder="例：温度勾配、対流、熱抵抗" autocomplete="off"/><button type="button" class="clear-search" data-action="clear-search" aria-label="検索語を消去">×</button></div><button class="button primary" type="submit">検索</button></div>
      <div class="filter-row"><label>対象<select name="kind"><option value="all" ${ui.search.kind === 'all' ? 'selected' : ''}>すべて</option><option value="book" ${ui.search.kind === 'book' ? 'selected' : ''}>本文・見出し</option><option value="glossary" ${ui.search.kind === 'glossary' ? 'selected' : ''}>用語集</option><option value="guide" ${ui.search.kind === 'guide' ? 'selected' : ''}>学習ガイド</option><option value="original-note" ${ui.search.kind === 'original-note' ? 'selected' : ''}>独自の日本語節別ノート</option><option value="deep-lesson" ${ui.search.kind === 'deep-lesson' ? 'selected' : ''}>独立発展日本語講義</option><option value="question" ${ui.search.kind === 'question' ? 'selected' : ''}>問題・解説</option><option value="memo" ${ui.search.kind === 'memo' ? 'selected' : ''}>メモ・しおり</option></select></label><label>章<select name="chapter"><option value="all">すべての章</option>${book.chapters.map(ch => `<option value="${ch.id}" ${ui.search.chapter === ch.id ? 'selected' : ''}>第${ch.id.slice(2)}章 ${escapeHTML(ch.title)}</option>`).join('')}<option value="supplement" ${ui.search.chapter === 'supplement' ? 'selected' : ''}>補足説明</option></select></label><label>分野<select name="field"><option value="all">すべての分野</option>${[...new Set(buildSearchIndex().map(e=>e.field).filter(Boolean))].map(field=>`<option value="${escapeHTML(field)}" ${ui.search.field===field?'selected':''}>${escapeHTML(field)}</option>`).join('')}</select></label><span class="search-hint">日本語の一部だけでも検索できます</span></div>
    </form>
    <section class="search-results"><div class="results-heading"><h2>${ui.search.query ? `「${escapeHTML(ui.search.query)}」の検索結果` : '検索結果'}</h2>${ui.search.query ? `<span role="status" aria-live="polite">${results.length}件</span>` : ''}</div>
      ${!ui.search.query ? `<div class="empty-state"><span class="empty-mark">⌕</span><h3>見つけたい言葉を入力してください</h3><p>原本の節見出し、独立学習ガイド、用語、問題、保存したメモを検索できます。</p></div>` : !results.length ? `<div class="empty-state"><span class="empty-mark">…</span><h3>一致する内容がありません</h3><p>別の言葉や短い表現で検索してみてください。未翻訳本文は検索対象に含まれません。</p></div>` : `<div class="result-list">${shownResults.map(entry => `<article class="result-card"><div class="result-meta">${statusPill(entry.kindLabel, entry.kind === 'book' ? 'blue' : entry.kind === 'memo' ? 'amber' : 'green')}<span>${escapeHTML(entry.chapterTitle || '')}</span></div><h3><button type="button" class="result-link" data-search-target='${escapeHTML(JSON.stringify(entry.target))}'>${highlight(entry.title, ui.search.query)}</button></h3><p>${highlight(searchSnippet(entry.text, ui.search.query), ui.search.query)}</p><small>${escapeHTML(entry.source)}</small></article>`).join('')}</div>${results.length>shownResults.length?`<div class="search-more"><p aria-live="polite">全${results.length}件中 ${shownResults.length}件を表示しています。</p><button type="button" class="button secondary" data-action="search-more">もっと見る（次の100件）</button></div>`:''}`}
    </section>`;
}

function renderGlossary() {
  const query = ui.glossaryQuery || '';
  const language = state.settings.contentLanguage === 'en' ? 'en' : 'ja';
  const filtered = glossary.filter(item => !query || normalizedText([item.ja,item.en,item.meaning,item.detail,item.brief,item.beginner,item.example,item.unit,item.formula,...(item.aliases||[])].filter(Boolean).join(' ')).includes(normalizedText(query)));
  const termCards = filtered.map(term => {
    const primary = language === 'en' ? (term.en || term.ja) : term.ja;
    const secondary = language === 'en' ? term.ja : term.en;
    const meaning = language === 'en' ? (term.meaningEn || term.meaning) : term.meaning;
    const primaryLanguage=language==='en'&&term.en?'en':'ja';
    const meaningLanguage=language==='en'&&term.meaningEn?'en':'ja';
    const section=getSection(term.source.section);
    const guideId=term.source.guideId;
    const sourceLink = term.source.type === 'supplement' ? `<div class="term-links">${statusPill('補足説明', 'violet')}${GUIDE_SECTIONS.some(item=>item.id===guideId)?`<a class="text-link" href="#guide/${escapeHTML(guideId)}">詳しい説明を読む →</a>`:''}</div>` : `<div class="term-links">${sectionIsTranslated(section)&&term.availableInApp!==false?`<button type="button" class="text-link" data-section="${escapeHTML(term.source.section)}">アプリ内の本文を開く →</button>`:`<small>アプリ内の日本語訳は未収録です。</small>${independentNoteForSection(originalNotes,term.source.section)?`<button type="button" class="text-link" data-section="${escapeHTML(term.source.section)}">関連する独自日本語節別ノートを読む →</button>`:''}`}${sourcePdfLink(term.source,section)}</div>`;
    const relatedQuestions=(Array.isArray(term.relatedQuestions)?term.relatedQuestions:[]).filter(item=>item&&typeof item.id==='string'&&typeof item.label==='string'&&getQuestion(item.id));
    const questionLinks=relatedQuestions.length?`<div class="term-related"><strong>関連する問題</strong>${relatedQuestions.map(item=>`<button type="button" class="text-link" data-start-question="${escapeHTML(item.id)}">${escapeHTML(item.label)} →</button>`).join('')}</div>`:'';
    const reviewTag = term.reviewStatus === 'needs_review' ? statusPill('校閲前', 'amber') : '';
    return `<article class="term-card surface-card" id="term-${escapeHTML(term.id)}" lang="ja"><div class="term-heading"><h2 lang="${primaryLanguage}">${escapeHTML(primary)}</h2>${secondary?`<span lang="${primaryLanguage==='en'?'ja':'en'}">${escapeHTML(secondary)}</span>`:''}</div><p lang="${meaningLanguage}">${escapeHTML(meaning)}</p>${term.beginner&&term.beginner!==term.meaning&&term.beginner!==term.detail?`<p class="term-beginner">${escapeHTML(term.beginner)}</p>`:''}${term.detail&&term.detail!==term.meaning?`<details class="term-full"><summary>詳しい意味と使い方</summary><p>${escapeHTML(term.detail)}</p></details>`:''}${term.unit?`<p class="term-unit"><strong>単位：</strong>${escapeHTML(term.unit)}</p>`:''}${term.formula?`<p class="term-formula"><strong>式：</strong>${escapeHTML(term.formula)}</p>`:''}${term.aliases?.length?`<small>別名・表記：${escapeHTML(term.aliases.join('・'))}</small>`:''}${renderTermExample(term)}<div class="term-source">${sourceLabel(term.source)}</div>${reviewTag}${sourceLink}${renderTermLearningLinks(term)}${questionLinks}</article>`;
  }).join('') || '<div class="empty-state"><p>一致する用語がありません。</p></div>';
  return `${pageHeading('用語集', '専門用語を、自分の言葉に。', '日本語の意味と英語の原語を確認できます。補足説明と本書に由来する内容を分けて表示します。')}
    <div class="reader-toolbar glossary-language-toolbar"><div class="language-toggle" role="group" aria-label="用語の表示言語"><button type="button" class="${language === 'ja' ? 'selected' : ''}" data-language="ja" aria-pressed="${language === 'ja'}">日本語</button><button type="button" class="${language === 'en' ? 'selected' : ''}" data-language="en" aria-pressed="${language === 'en'}">英語</button></div><span class="language-note">${language === 'ja' ? '日本語の用語名' : '英語名を優先・説明は収録言語で表示'}</span></div>
    <div class="glossary-search surface-card"><label for="glossary-query">用語を探す</label><input id="glossary-query" type="search" value="${escapeHTML(query)}" placeholder="用語や英語名を入力"/></div>
    <div class="glossary-grid">${termCards}</div>
    <div class="notice-card"><span class="notice-icon">i</span><p>用語集は全${allSections().length}節の収録教材（独自日本語ノート・発展教材）をもとに作成しています。原書の翻訳本文は未収録です。</p></div>`;
}

function searchNow(form) {
  const data=new FormData(form);
  ui.search={query:String(data.get('query')||'').trim(),kind:String(data.get('kind')||'all'),chapter:String(data.get('chapter')||'all'),field:String(data.get('field')||'all')};
  ui.searchResults=searchEntries(buildSearchIndex(),ui.search);
  ui.searchLimit=100;
  render();
}
function renderSettings() {
  const sections=allSections(), readable=sections.filter(sectionIsTranslated);
  const percent=Math.round(readable.length/sections.length*100);
  const drafted=sections.filter(s=>['translated','draft_complete'].includes(s.translationStatus)).length;
  return `${pageHeading('設定とデータ', '学び方を、自分に合わせる。', '表示の調整、端末への保存、学習データの入出力を行います。')}
    <div class="settings-grid">
      <section class="surface-card settings-card"><p class="eyebrow">利用者</p><h2>学習記録を分ける</h2><p>現在の利用者：<strong>${escapeHTML(profiles.find(p=>p.id===activeProfileId)?.name||'既存の記録')}</strong></p>${profileIssue?`<p class="inline-error" role="alert">${escapeHTML(profileIssue)}</p>`:''}<form id="profile-switch-form" class="stack-form"><label>利用者を選ぶ<select name="profileId">${profiles.map(p=>`<option value="${escapeHTML(p.id)}" ${p.id===activeProfileId?'selected':''}>${escapeHTML(p.name)}</option>`).join('')}</select></label><button class="button secondary" type="submit" ${profileIssue?'disabled':''}>この利用者に切り替える</button></form><form id="profile-create-form" class="stack-form"><label>新しい利用者名<input name="profileName" maxlength="40" autocomplete="off" required/></label><button class="button secondary" type="submit" ${profileIssue?'disabled':''}>新しい利用者を作る</button></form><p class="small-note">以前の学習記録は「既存の記録」に残します。利用者ごとに回答・メモ・しおり・設定と復元前の控えを保存します。パスワードによる保護はなく、このブラウザーを使う人は利用者を切り替えられます。端末間の自動同期はありません。</p></section>
      <section class="surface-card settings-card"><p class="eyebrow">表示</p><h2>画面の見やすさ</h2><fieldset class="choice-field"><legend>表示モード</legend><div class="segmented-control"><label><input type="radio" name="theme" value="system" ${state.settings.theme === 'system' ? 'checked' : ''}/><span>端末に合わせる</span></label><label><input type="radio" name="theme" value="light" ${state.settings.theme === 'light' ? 'checked' : ''}/><span>ライト</span></label><label><input type="radio" name="theme" value="dark" ${state.settings.theme === 'dark' ? 'checked' : ''}/><span>ダーク</span></label></div></fieldset>
        <label class="range-setting">本文の文字サイズ <strong>${Math.round(state.settings.fontScale * 100)}%</strong><input type="range" min="0.9" max="1.4" step="0.05" name="fontScale" value="${state.settings.fontScale}"/><span class="range-ends"><small>小さめ</small><small>大きめ</small></span></label>
        <label class="range-setting">本文の行間 <strong>${Number(state.settings.lineHeight).toFixed(1)}</strong><input type="range" min="1.5" max="2.2" step="0.1" name="lineHeight" value="${state.settings.lineHeight}"/><span class="range-ends"><small>標準</small><small>広め</small></span></label><div class="preview-text">熱は高温側から低温側へ移ります。読みやすい大きさと行間に調整してください。</div>
      </section>
      <section class="surface-card settings-card"><p class="eyebrow">学習データ</p><h2>保存と持ち運び</h2><p>現在の利用者の学習履歴、回答、自信度、メモ、しおり、計画、設定をJSONで書き出します。書籍本文は含みません。回答時の選択肢の文言は履歴として含まれます。</p><div class="button-stack"><button class="button primary" type="button" data-action="export-data">JSONを書き出す</button><label class="button secondary file-button">JSONを取り込む<input type="file" id="import-file" accept="application/json,.json"/></label></div>${renderExportPreview()}${renderBackupControls()}<div id="import-feedback" class="import-feedback">${renderImportDraft()}</div><div class="notice-card compact-notice"><span class="notice-icon">i</span><p>ファイル形式が正しい場合も、取り込み前に内容を確認できます。壊れたファイルでは現在の記録を変更しません。</p></div></section>
      <section class="surface-card settings-card"><p class="eyebrow">教材</p><h2>翻訳と確認の状況</h2><div class="content-progress"><div><strong>この端末で読める日本語訳・下書き</strong>${statusPill('専門家校閲は未実施', 'amber')}</div><div class="progress-line"><span style="width:${percent}%"></span></div><p>${readable.length}節 / ${sections.length}節を収録。下書きの進捗と、この端末で読める範囲は別に管理しています。全文の翻訳・確認は完了していません。</p><ul>${readable.map(s=>`<li>第${escapeHTML(s.id)}節「${escapeHTML(s.title)}」<br><small>書籍 pp.${s.bookStart}–${s.bookEnd} · PDF pp.${s.pdfStart}–${s.pdfEnd}${s.localDraft?' · 下書き・原本再照合待ち':s.localSourceChecked?' · 原本照合済み（作業者）・ローカル教材':''}</small></li>`).join('')}</ul><p>目次台帳では${drafted}節に本文または翻訳下書きの記録があります。下書きのある節も、図表・式・脚注の網羅性と内容の確認を継続しています。詳細は目次と教材台帳を参照してください。</p></div><a class="text-link" href="#reader">翻訳進捗を目次で見る →</a><p class="small-note">英語原本PDFは全810ページを公開しています。節の目次から対応ページを開けます。日本語訳・原図のアプリ内再利用は別に管理します。</p></section>
      <section class="surface-card settings-card"><p class="eyebrow">対応状況</p><h2>オフライン・読み上げ・操作</h2><ul class="capability-list"><li><span>${navigator.onLine ? '●' : '○'}</span> ${navigator.onLine ? 'オンライン接続中' : 'オフライン中'}。初回の教材読み込み後は、アプリと収録済み教材を利用できます。</li><li><span>▶</span> 読み上げは端末の音声合成機能を使用します。未対応のブラウザーでは利用できません。</li><li><span>⌨</span> 問題演習中は数字キー1〜4で選択、Enterで回答できます。入力欄にフォーカスがある間は操作を奪いません。</li><li><span>▣</span> 読書位置、読了、問題回答、復習予定はこのブラウザーに保存します。</li></ul></section>
    </div>`;
}
function renderImportDraft() {
  if (!ui.importDraft) return '';
  if (ui.importDraft.error) return `<div class="inline-error" role="alert">${escapeHTML(ui.importDraft.error)}</div>`;
  const parsed = ui.importDraft.data;
  return `<div class="import-preview"><strong>取り込み可能なデータです</strong><p>${parsed.attempts.length}件の回答 · ${parsed.bookmarks.length}件のしおり · ${Object.keys(parsed.mistakeNotes).length}件の間違いノート</p><div class="button-row"><button type="button" class="button primary" data-action="import-merge">今の記録に追加・更新</button><button type="button" class="text-button danger-text" data-action="import-replace">すべて置き換える</button></div></div>`;
}

function storedBackup(kind){try{return localStorage.getItem(`${STORAGE_KEY}:${kind}`)||'';}catch{return '';}}
function renderBackupControls(){
  const before=storedBackup('before-import'),recovery=storedBackup('recovery');
  if(!before&&!recovery)return '';
  return `<details class="backup-controls"><summary>保管したデータの控え</summary><p class="small-note">控えはこのブラウザー内に保存されています。取り込み直す前に内容を確認できます。取り込み前の控えは一つだけで、次の取り込みに成功すると更新されます。必要なら先に書き出してください。端末やブラウザーを変えても自動同期されません。</p><div class="button-row">${before?'<button type="button" class="button secondary" data-action="export-before-import">取り込み前の控えを書き出す</button><button type="button" class="text-button" data-action="preview-backup">控えの復元内容を確認</button>':''}${recovery?'<button type="button" class="button secondary" data-action="export-stored-recovery">読み取れなかった元データを書き出す</button>':''}</div></details>`;
}
function exportBackup(kind){
  const raw=storedBackup(kind);if(!raw){showStatus('書き出せる控えがありません。');return;}
  let text=raw;
  if(kind==='before-import'){
    // The stored copy is the app's internal state, which carries no export
    // envelope, so writing it verbatim produced a file the importer itself
    // rejected as a foreign format (phase D finding D-01). Wrap it in the
    // same envelope as a normal export so the copy the settings screen
    // recommends saving can be imported back on any device. If the copy
    // cannot be parsed (it is snapshotted from live state, so this should
    // not happen), keep the verbatim bytes rather than lose the only copy.
    try{const data=JSON.parse(raw);if(data&&typeof data==='object'&&!Array.isArray(data))text=JSON.stringify({...data,schemaVersion:1,exportedAt:new Date().toISOString(),format:'heat-study-ja-learning-data'},null,2);}catch{/* keep the raw copy */}
  }
  // kind==='recovery' stays byte-for-byte verbatim on purpose: it preserves
  // data the app could not read, and rewriting it could destroy the only
  // evidence available for manual repair. It is an inspection copy, not a
  // restorable backup, and its button label (元データを書き出す) says so.
  if(downloadJSON(text,`heat-study-${kind}-${todayISO()}.json`))showStatus('控えの書き出しを開始しました。ダウンロードを確認してください。');
  else offerManualExport(text);
}
function previewBackup(){
  try{const data=JSON.parse(storedBackup('before-import')),issue=validateLearningData(data,{stored:true});if(issue)throw new Error(issue);ui.importDraft={data:{...data,format:'heat-study-ja-learning-data'}};}
  catch{ui.importDraft={error:'この控えの形式を読み取れません。控えを書き出して確認してください。現在の記録は変更していません。'};}
  render();
}
function renderDayActivity(day){
  const entries=state.activities.filter(a=>a.date===day),total=entries.reduce((n,a)=>n+a.seconds,0),labels={reading:'読書',practice:'問題演習',review:'復習',simulation:'シミュレーター',glossary:'用語集'};
  const kinds=Object.entries(labels).map(([key,label])=>[label,entries.filter(a=>a.kind===key).reduce((n,a)=>n+a.seconds,0)]).filter(([,seconds])=>seconds>0);
  const readings=[...new Set(entries.filter(a=>a.kind==='reading'&&a.sectionId).map(a=>a.sectionId))],due=Object.entries(state.reviews).filter(([,r])=>r.dueDate===day);
  return `<section class="day-learning-time"><strong>記録した学習時間：${studyDuration(total)}</strong><ul>${kinds.map(([label,seconds])=>`<li>${label}：${studyDuration(seconds)}</li>`).join('')||'<li>この日の時間記録はありません。過去の記録から時間を推定していません。</li>'}</ul>${readings.map(id=>`<button class="text-link" type="button" data-section="${escapeHTML(id)}">第${escapeHTML(id)}節「${escapeHTML(getSection(id)?.title||'記録した本文')}」を開く</button>`).join('')}<p class="small-note">前面の学習画面を表示している時間の目安です。90秒操作がないと計測を停止し、非表示・PC休止中は加算しません。理解度を示す値ではありません。</p>${due.length?`<details><summary>この日の復習予定：${due.length}問</summary>${due.map(([id])=>{const q=getQuestion(id);return q?`<button class="text-link" type="button" data-start-question="${escapeHTML(id)}">${escapeHTML(q.prompt)}</button>`:'<p>未収録教材の復習予定があります。</p>';}).join('')}</details>`:''}</section>`;
}

function showStatus(message) {
  if(storageIssue && /保存しました|記録しました|変更しました|ブックマークしました|外しました|削除しました|破棄しました|停止しました/.test(message)) message=storageIssue;
  const existing = document.querySelector('.toast');
  existing?.remove();
  const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.textContent = message;
  document.body.append(toast); setTimeout(() => toast.remove(), 4200);
}

function renderPlan() {
  const plan = state.plan;
  const remaining = plan.targetDate ? Math.max(0, Math.ceil((new Date(`${plan.targetDate}T00:00:00`) - new Date(`${todayISO()}T00:00:00`)) / 86400000)) : null;
  const todayDue = dueReviewCount();
  const readingSections = allSections();
  const readingSuggestion = readingSections.find(section => !state.readSections[section.id]) || readingSections[0];
  return `${pageHeading('学習計画', '続けられる予定をつくる。', '目標日と1日の時間から、読書・演習・復習を組み合わせて提案します。内容はいつでも変えたり、停止したりできます。')}
    <div class="plan-layout">
      <section class="surface-card plan-form-card"><p class="eyebrow">あなたの目標</p><h2>何をいつまでに学びたい？</h2><form id="plan-form" class="stack-form">
        <label>学習目標<input name="goal" type="text" maxlength="120" value="${escapeHTML(plan.goal)}" placeholder="例：熱移動の基礎を説明できるようになる"/></label>
        <div class="form-two"><label>目標日<input name="targetDate" type="date" min="${todayISO()}" value="${escapeHTML(plan.targetDate)}"/></label><label>1日に使える時間<select name="minutesPerDay">${[5,10,15,20,30,45,60].map(value => `<option value="${value}" ${Number(plan.minutesPerDay) === value ? 'selected' : ''}>${value}分</option>`).join('')}</select></label></div>
        <div class="button-row"><button class="button primary" type="submit">計画を保存</button>${plan.active ? '<button class="button secondary" type="button" data-action="stop-plan">計画を停止</button>' : ''}</div>
      </form></section>
      <section class="surface-card suggestion-card"><p class="eyebrow">今日の提案</p><h2>${plan.active ? 'この順番で進めましょう' : 'まずは学習を始めましょう'}</h2>
        <ol class="suggested-steps"><li><span>1</span><div><strong>${readingSuggestion ? `${state.readSections[readingSuggestion.id] ? '読み返す' : '読む'}：第${readingSuggestion.chapterId.slice(2)}章${readingSuggestion.id}節「${escapeHTML(readingSuggestion.title)}」` : '節の目次を確認してください'}</strong><small>目安 ${planMinutes(plan.minutesPerDay)[0]} 分 · ${readingSuggestion&&sectionIsTranslated(readingSuggestion)?'日本語訳または英語原本':'英語原本PDF'}</small></div><a href="#reader" ${readingSuggestion ? `data-section="${readingSuggestion.id}"` : 'aria-disabled="true"'}>開く</a></li><li><span>2</span><div><strong>関連する問題に挑戦する</strong><small>目安 ${planMinutes(plan.minutesPerDay)[1]} 分 · 回答履歴を記録</small></div><a href="#quiz">始める</a></li><li><span>3</span><div><strong>${todayDue ? `${todayDue}問の復習候補を確認する` : '復習の準備をする'}</strong><small>目安 ${planMinutes(plan.minutesPerDay)[2]} 分 · 自信度も考慮</small></div><a href="#review">確認</a></li></ol>
        <p class="small-note">提案は収録済み教材と回答履歴に基づきます。全文の学習所要時間や、未翻訳範囲の完了日は推定していません。</p>
      </section>
      <section class="surface-card plan-summary-card"><p class="eyebrow">計画の見通し</p>${plan.active ? `<div class="summary-highlight"><strong>${remaining === null ? '—' : remaining}</strong><span>${remaining === 1 ? '日後まで' : '日間の予定'}</span></div><p>目標日：${formatDate(plan.targetDate)}　·　1日 ${Number(plan.minutesPerDay) || 15} 分</p><p class="muted">目標：${escapeHTML(plan.goal || '未入力')}</p>` : '<div class="empty-state compact"><span class="empty-mark">▦</span><p>計画を保存すると、目標と1日の学習時間がここに表示されます。</p></div>'}</section>
    </div>`;
}

function renderCalendar() {
  const anchor = new Date(`${ui.calendarDate}T00:00:00`);
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const firstCell = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index));
  const monthName = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(anchor);
  const selected = ui.calendarDate;
  const activityDates = new Set([...state.attempts.map(item => localDay(item.at)), ...state.sessions.map(item => item.date),...state.activities.map(a=>a.date)]);
  const dueDates = new Set(Object.values(state.reviews).map(item => item.dueDate).filter(Boolean));
  const selectedAttempts = state.attempts.filter(item => localDay(item.at) === selected);
  const selectedSessions = state.sessions.filter(item => item.date === selected);
  const fields = new Map();
  for (const attempt of selectedAttempts) { const q = getQuestion(attempt.questionId); if (q) fields.set(q.field, (fields.get(q.field) || 0) + 1); }
  return `${pageHeading('学習カレンダー', '続けた日も、復習する日も。', '学習日、回答数、分野、復習予定を日付ごとに振り返れます。')}
    <div class="calendar-layout"><section class="surface-card calendar-card"><div class="calendar-toolbar"><button class="icon-button" type="button" data-action="calendar-prev" aria-label="前の月">←</button><h2>${monthName}</h2><button class="icon-button" type="button" data-action="calendar-next" aria-label="次の月">→</button></div>
      <div class="calendar-grid calendar-weekdays">${['日','月','火','水','木','金','土'].map(day => `<span>${day}</span>`).join('')}</div>
      <div class="calendar-grid">${days.map(date => { const iso = todayISO(date); const inMonth = date.getMonth() === anchor.getMonth(); return `<button type="button" class="calendar-day ${inMonth ? '' : 'outside'} ${iso === todayISO() ? 'today' : ''} ${iso === selected ? 'selected' : ''}" data-date="${iso}" aria-label="${formatDate(iso)}${activityDates.has(iso) ? ' 学習記録あり' : ''}${dueDates.has(iso) ? ' 復習予定あり' : ''}"><span>${date.getDate()}</span><i class="day-markers">${activityDates.has(iso) ? '<b class="activity-dot" title="学習記録"></b>' : ''}${dueDates.has(iso) ? '<b class="due-dot" title="復習予定"></b>' : ''}</i></button>`; }).join('')}</div>
      <div class="calendar-legend"><span><i class="activity-dot"></i>学習記録</span><span><i class="due-dot"></i>復習予定</span></div></section>
      <aside class="surface-card day-detail"><p class="eyebrow">選択した日</p><h2>${formatDate(selected)}</h2>${renderDayActivity(selected)}${selectedAttempts.length || selectedSessions.length ? `<div class="day-stats"><div><strong>${selectedAttempts.length}</strong><span>回答数</span></div><div><strong>${selectedAttempts.filter(a => a.correct).length}</strong><span>正解</span></div></div><h3>取り組んだ分野</h3><ul class="field-breakdown">${[...fields.entries()].map(([field, count]) => `<li><span>${escapeHTML(field)}</span><strong>${count}問</strong></li>`).join('') || '<li><span>この日の演習記録はありません</span></li>'}</ul>${selectedSessions.map(session => `<div class="session-entry"><strong>${formatTime(session.startedAt)}　学習セッション</strong><span>${session.total}問 · 正解 ${session.correct}問</span></div>`).join('')}` : `<div class="empty-state compact"><span class="empty-mark">▣</span><p>この日の学習記録はありません。復習予定は日付の印で確認できます。</p></div>`}<a class="text-link" href="#quiz">短い問題セットを始める →</a></aside></div>`;
}

function renderMap() {
  const fields = [...questionsByField().entries()];
  return `${pageHeading('分野マップ', 'わかるところと、次の一歩。', '理解度は問題への回答から算出します。回答数が少ない分野は、理解度を決めつけず「記録不足」と表示します。')}
    <div class="map-grid">${fields.map(([field, total]) => { const qs = questionBank.filter(q => q.field === field); const attempts = state.attempts.filter(a => qs.some(q => q.id === a.questionId)); const progress=fieldProgress(qs,attempts),{correct,enough,ratio}=progress; const label = enough ? `${Math.round(ratio * 100)}%` : '記録不足'; const tone = enough ? ratio >= 0.75 ? 'strong' : ratio >= 0.5 ? 'middle' : 'needs-work' : 'not-enough'; return `<article class="map-card surface-card"><div class="map-card-heading"><span class="map-symbol ${tone}" aria-hidden="true">${enough ? ratio >= 0.75 ? '●' : ratio >= 0.5 ? '◐' : '○' : '—'}</span><div><h2>${escapeHTML(field)}</h2><small>${progress.answered}問に回答（現行版） / 収録${total}問${progress.outdated ? ` · 改訂前の回答${progress.outdated}問` : ''}</small></div></div><div class="map-meter"><span class="${tone}" style="width:${enough ? Math.max(3, ratio * 100) : 0}%"></span></div><div class="map-card-foot"><strong>${label}</strong><span>${enough ? `${correct}問正解` : '判定には異なる3問以上が目安'}</span></div><a class="text-link" href="#quiz" data-map-field="${escapeHTML(field)}">${enough && ratio < 0.6 ? 'この分野を復習する' : 'この分野の問題を解く'} →</a></article>`; }).join('')}</div>
    <section aria-labelledby="chapter-roadmap-title" class="chapter-curriculum">
      <h2 id="chapter-roadmap-title">章別学習ロードマップ（独自補助講座）</h2>
      <p class="small-note">以下の数値は<strong>収録済み演習への回答</strong>と、本人が付けた<strong>原本節の読了記録</strong>です。未配布の日本語訳や原本全内容の達成率ではありません。</p>
      <div class="map-grid">${chapterLearningOverview(book,questionBank,GUIDE_SECTIONS,state.attempts,state.readSections).map(item=>`<article class="map-card surface-card" data-chapter-card="${escapeHTML(item.chapter)}"><div class="map-card-heading"><div><p class="eyebrow">第${escapeHTML(item.chapter.slice(2))}章</p><h3>${escapeHTML(item.title)}</h3></div></div>
        <p>収録問題：${item.practiceQuestionCount}問（書籍の節出典あり：${item.bookCitedQuestionCount}問）</p>
        <p>回答済み（現行版）：${item.attemptedQuestions}/${item.practiceQuestionCount}問 · 各問の最新回答で正解：${item.latestCorrect}問</p>
        <p>未回答：${item.unansweredQuestions}問 · 最新の誤答：${item.latestIncorrect}問${item.outdatedQuestions ? ` · 改訂前の回答：${item.outdatedQuestions}問（現行版は再回答が必要）` : ''}</p>
        <p>原本の節を読了に記録：${item.sectionsMarkedRead}/${item.sectionCount}節</p>
        <div class="button-row">${item.guideId?`<a class="text-link" href="#guide/${escapeHTML(item.guideId)}">独立した日本語補助講座を読む →</a>`:''}
        ${item.recommendedQuestionIds.length ? `<button type="button" class="button primary" data-chapter-practice="${escapeHTML(item.chapter)}" data-chapter-practice-mode="priority">未正解・未回答を優先（${item.recommendedQuestionIds.length}問）</button>`:''}
        <button type="button" class="button secondary" data-chapter-practice="${escapeHTML(item.chapter)}">この章の全問題を解く</button></div>
      </article>`).join('')}</div>
    </section>
    <section class="notice-card map-method"><span class="notice-icon">i</span><div><strong>理解度の計算方法</strong><p>この分野の各問題について、現行の問題版での最新回答を一つだけ使います。その正解数 ÷ 回答した異なる問題数で表示します。異なる3問未満では割合を出さず「記録不足」とします。問題が改訂された場合、旧版の回答は残しますが現行版の正解に数えず、再回答の候補にします。同じ問題を反復した回数で割合は増えません。自信度と復習予定は別に管理します。</p></div></section>`;
}

const SIM_META = {
  resistance:{title:'熱抵抗の組み合わせ',description:'二つの平板と両側の対流を、直列の熱抵抗として計算します。',formula:'Q̇ = (Tₕ − T𝑐) / (Rₕ + R₁ + R₂ + R𝑐)',note:'均質な二層の平板、等しい面積、一次元・定常、各物性と熱伝達率一定。界面の接触抵抗・内部発熱・放射・側面の熱漏れは含みません。'},
  conduction: { title: '熱伝導', description: '固体の内部などで、温度差により熱が移動するモデルです。', formula: 'Q̇ = k A (Tₕ − T𝑐) / L', note: '均質な平板、一次元、定常状態、熱伝導率一定、側面からの熱漏れなし。接触熱抵抗や端部効果は含みません。' },
  convection: { title: '対流', description: '固体表面と、その近くを動く流体との間の熱移動を扱います。', formula: 'Q̇ = h A (Tₛ − T∞)', note: 'ニュートンの冷却法則を使う集中モデルです。h は流れや形状に依存する入力値で、ここでは一定とします。流れ場や温度依存性は解いていません。' },
  transient:{title:'非定常冷却（集中熱容量法）',
    description:'物体温度が時間とともに変わる様子を、内部温度が一様と仮定して学びます。',
    formula:'T(t) = T∞ + (T₀ − T∞) exp(−t/τ), τ = ρVcₚ/(hA)',
    note:'物体内部の温度がほぼ均一、周囲流体の温度とh・物性は一定、放射・内部発熱・相変化なし。Bi=h(V/A)/k＜0.1は近似検討の目安です。'},
  radiation: { title: '熱放射', description: '表面間で電磁波として移る熱を、単純化した灰色面モデルで見ます。', formula: 'Q̇ = ε σ A (Tₛ,K⁴ − Tsur,K⁴)', note: '大きな黒い周囲を見込む不透明な灰色面、形態係数1、周囲からの一様な照射を仮定。吸収率と放射率を等しいとします。対流、複数面間の反射の連成、波長による特性の変化は解いていません。温度は必ずKへ換算します。' },
  fin:{title:'フィン効率（断熱先端）',description:'根元から流体へ熱を逃がす円柱フィンの効率と温度分布を計算します。',formula:'ηf = tanh(mL)/(mL)、m = √(hP/(kAc))、Q̇ = ηf h As (Tb − T∞)',note:'一定断面の直線円柱フィン、軸方向一次元・定常、先端は断熱。側面積のみで効率を定義し、先端の対流・放射・接触抵抗・温度依存物性は含みません。関連：§4.5。'},
  exchanger:{title:'熱交換器（ε–NTU）',description:'向流・並流の有効度と出口温度、対数平均温度差を計算します。',formula:'Q̇ = ε Cmin (Th,in − Tc,in)、NTU = UA/Cmin',note:'定常・単相・外部熱損失なし・比熱とUは一定。向流と並流のみで、多パス・交差流・相変化・圧力損失は含みません。関連：§3.2・§3.3。'},
  slab:{title:'非定常平板（両面対流）',description:'両面から冷やされる／温められる平板の内部温度分布を級数解で計算します。',formula:'θ = Σ Cn cos(μn x/L) exp(−μn² Fo)、μn tan μn = Bi',note:'初期温度は一様、両面とも同じ流体温度とh、物性は一定。数値精度のため Fo≧10⁻⁴（または t=0）かつ Bi≦100 に限ります。関連：§5.3。'},
  enclosure:{title:'二面間の放射熱交換',description:'取り囲む2つの灰色面の間の正味放射熱交換を、放射抵抗の直列として計算します。',formula:'Q̇ = σ (T1⁴ − T2⁴) / Rtotal',note:'面1は自己照射なし（F12=1）で面2が面1を取り囲む理想化。形態係数は面積比からのみ決まり、自由入力はしません。既存の「熱放射」（黒い周囲を見込むモデル）とは別モデルです。関連：第10章。'},
  cylinder:{title:'円筒断熱と臨界半径',description:'円筒に断熱材を巻いたときの熱移動率と、臨界半径の効果を計算します。',formula:'Q̇ = (Tb − T∞) / Rtotal、rcrit = k/h',note:'定常・半径方向一次元、hは一定。臨界半径は固定hを仮定した理論上の極値であり、保温設計の推奨厚さではありません。関連：§2.4。'},
  halfspace:{title:'半無限固体の応答',description:'表面温度をステップ状に変えた半無限固体の温度応答と表面熱流束を計算します。',formula:'(T − Ti)/(Ts − Ti) = erfc(x / (2√(αt)))',note:'表面温度を指定する境界条件です。表面温度そのものを予測するモデルではなく、裏側の影響が届かない時間と深さの範囲でのみ使えます。関連：§5.6。'},
  flatplate:{title:'平板の層流強制対流',description:'等温平板上の層流境界層について、平均と局所のヌセルト数を計算します。',formula:'NūL = 0.664 ReL^(1/2) Pr^(1/3)',note:'等温平板・層流の範囲に限ります。遷移・乱流、温度依存物性、圧力勾配は含みません。関連：§6.2〜§6.5。'},
  pipe:{title:'円管内の乱流強制対流',description:'Gnielinski相関で円管内乱流の平均ヌセルト数、出口温度、圧力損失を計算します。',formula:'Nu = (f/8)(Re − 1000)Pr / (1 + 12.7 (f/8)^(1/2) (Pr^(2/3) − 1))',note:'十分発達した乱流と平滑管を対象とし、適用範囲外のRe・Prは受け付けません。関連：§7.3。'},
  crossflow:{title:'円柱まわりの横流れ',description:'Churchill–Bernstein相関で、単独円柱を横切る流れの熱伝達を計算します。',formula:'NuD = Churchill–Bernstein相関（ReD と Pr の関数）',note:'単独で滑らかな円柱、物性は膜温度。管群・フィン付き円柱・相変化は含みません。関連：§7.6。'},
  natural:{title:'鉛直平板の自然対流',description:'Churchill–Chu相関で、鉛直平板の平均ヌセルト数を計算します。',formula:'NuL = [0.825 + 0.387 RaL^(1/6) / (1 + (0.492/Pr)^(9/16))^(8/27)]²',note:'等温の鉛直平板、物性は膜温度。壁温と流体温が等しいときは相関を適用しません。関連：§8.3。'},
  laminarpipe:{title:'円管内の層流強制対流',description:'Hausen相関で、入口の速度分布が発達した円管内層流の平均ヌセルト数を計算します。',formula:'Nū = 3.66 + 0.0668 Gz / (1 + 0.04 Gz^(2/3))、Gz = Re Pr D/L',note:'等温壁で、加熱区間の入口では速度分布が発達済みであることが前提。径方向の温度分布ではなく混合平均温度を扱います。関連：§7.2。'},
  condensation:{title:'鉛直平板の膜状凝縮',description:'Nusseltの平滑層流液膜解で、平均熱伝達率と液膜の厚さを計算します。',formula:'h̄ = 0.943 [g ρl (ρl − ρv) hfg kl³ / (μl L ΔT)]^(1/4)',note:'静止した純粋な飽和蒸気と、波立たない層流液膜を仮定。液膜Re≦30とJa≦0.1を適用の目安とし、範囲外は計算を拒否します。潜熱は入力値をそのまま使い、補正潜熱への換算は含みません。関連：§8.5。'},
  diffusion:{title:'二成分気体の拡散',description:'静止した気体膜の中の等モル相互拡散と、Bが静止する条件の拡散を計算します。',formula:'NA = C DAB/L × (yA,1 − yA,2)（等モル相互拡散）',note:'理想二成分気体、等温・等圧・定常の一次元拡散。気液平衡・化学反応・多成分のStefan–Maxwell拡散は含みません。関連：§11.3・§11.5。'},
  nucleate:{title:'プール核沸騰（Rohsenow）',description:'Rohsenow相関で核沸騰の熱流束を推算し、限界熱流束との比も確認します。',formula:'q″ = μl hfg √[g(ρl − ρv)/σ] × [cpl ΔTe / (Csf hfg Prl^n)]³',note:'係数Csfと指数nは流体と加熱面の組合せに依存します。予測がZuberの限界熱流束の推定以上になる条件は、外挿として計算を拒否します。関連：§9.2。'},
  chf:{title:'限界熱流束（Zuber）',description:'大きな上向き水平面のプール沸騰について、限界熱流束をZuberの式で推算します。',formula:'q″CHF = 0.131 hfg √ρv [σg(ρl − ρv)]^(1/4)',note:'係数0.131はZuber–Kutateladzeの値です。レッスン側で推奨する0.149（Lienhard–Dhir）とは別系統であり、安全設計の許容値ではありません。関連：§9.3。'}
};
const SIM_ICONS = {transient:'◷',conduction:'▥',convection:'↝',radiation:'☼',resistance:'▤',fin:'⊥',exchanger:'⇄',slab:'▭',enclosure:'◎',cylinder:'○',halfspace:'◒',flatplate:'⇉',pipe:'⇒',crossflow:'⊕',natural:'↑',laminarpipe:'→',condensation:'≋',diffusion:'⇌',nucleate:'∴',chf:'△'};
function renderSimTabs(mode) {
  return `<p><a class="text-link" href="./dynamic/index.html">動的実験室：温度分布を再生・比較する →</a></p><div class="sim-tabs" role="tablist" aria-label="熱移動の種類">${Object.entries(SIM_META).map(([key,item])=>`<button type="button" role="tab" id="sim-tab-${key}" aria-controls="sim-panel" aria-selected="${mode===key}" tabindex="${mode===key?0:-1}" class="sim-tab ${mode===key?'selected':''}" data-sim-mode="${key}"><span aria-hidden="true">${SIM_ICONS[key]||'●'}</span>${item.title}</button>`).join('')}</div>`;
}
// WAI-ARIA tabs pattern: arrow keys move between simulator tabs (with
// automatic activation, matching the click behaviour), Home/End jump.
function onSimTabKeyDown(event) {
  const tab = event.target.closest?.('[role="tab"][data-sim-mode]');
  if (!tab) return;
  const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"][data-sim-mode]')];
  const index = tabs.indexOf(tab);
  if (index < 0) return;
  let next = null;
  if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
  else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
  else if (event.key === 'Home') next = tabs[0];
  else if (event.key === 'End') next = tabs[tabs.length - 1];
  else return;
  event.preventDefault();
  ui.simMode = next.dataset.simMode;
  render();
  root.querySelector(`[role="tab"][data-sim-mode="${ui.simMode}"]`)?.focus();
}
const simNum = value => value===null||value===undefined||!Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('ja-JP',{maximumSignificantDigits:7});
// Registry for the simulator models added after the original five. Each model
// module owns its fields, steps, diagram and graphs; the app only wires them
// into the shared simulator screen, comparison storage and guide links. The
// registry is built lazily, on first use, so that simply evaluating this file
// does not depend on the model modules' bindings.
let extendedSimsCache = null;
function extendedSims() {
  if (extendedSimsCache) return extendedSimsCache;
  extendedSimsCache = {
  fin:{fieldNames:finFieldNames,renderFields:renderFinFields,renderSteps:renderFinSteps,renderDiagram:renderFinDiagram,section:'4.5',
    headline:r=>({label:'フィンの熱移動率 Q̇',value:formatHeatRate(r.watts),unit:'W',sub:`効率 ηf = ${simNum(r.efficiency)}、先端温度 ${simNum(r.tipTemperature)} ℃、根元の伝導熱流でも同じ値になります。`}),
    graphs:[{title:'フィン内の温度分布',note:'横軸：根元からの相対位置 x/L ／ 縦軸：温度 ℃。',render:(r,c)=>finTemperatureGraph(r,c)}]},
  exchanger:{fieldNames:exchangerFieldNames,extraFields:['flow'],renderFields:renderExchangerFields,renderSteps:renderExchangerSteps,renderDiagram:renderExchangerDiagram,section:'3.2',
    headline:r=>({label:'熱交換器の熱移動率 Q̇',value:formatHeatRate(r.watts),unit:'W',sub:`有効度 ε = ${simNum(r.effectiveness)}、出口温度 高温側 ${simNum(r.hotOut)} ℃・低温側 ${simNum(r.coldOut)} ℃、対数平均温度差 ${simNum(r.logMean)} K。`}),
    graphs:[{title:'有効度とNTU',note:'横軸：NTU ／ 縦軸：有効度 ε。現在の熱容量比での曲線です。',render:(r,c)=>exchangerEffectivenessGraph(r,c)}]},
  slab:{fieldNames:slabFieldNames,renderFields:renderSlabFields,renderSteps:renderSlabSteps,renderDiagram:renderSlabDiagram,section:'5.3',
    headline:r=>({label:'中心温度（指定した時刻）',value:simNum(r.centerTemperature),unit:'℃',sub:`表面 ${simNum(r.surfaceTemperature)} ℃、板厚平均 ${simNum(r.averageTemperature)} ℃、Fo = ${simNum(r.fo)}、Bi = ${simNum(r.bi)}。集中熱容量近似では ${simNum(r.lumpedTemperature)} ℃。`}),
    graphs:[{title:'平板内の温度分布',note:'横軸：中心からの相対位置 ／ 縦軸：温度 ℃。',render:(r,c)=>slabProfileGraph(r,c)},{title:'中心・表面温度の履歴',note:'横軸：フーリエ数 Fo ／ 縦軸：温度 ℃。',render:r=>slabHistoryGraph(r)}]},
  enclosure:{fieldNames:radiationEnclosureFieldNames,renderFields:renderRadiationEnclosureFields,renderSteps:renderRadiationEnclosureSteps,renderDiagram:renderRadiationEnclosureDiagram,section:'10.3',
    headline:r=>({label:'面1からの正味熱移動率',value:formatHeatRate(r.netFrom1),unit:'W',sub:`実効放射率 ${simNum(r.effectiveEmissivity)}、熱流束（面1基準） ${simNum(r.flux1)} W/m²。面2の正味は逆向きに同じ大きさです。`}),
    graphs:[{title:'面1の温度と熱移動率',note:'横軸：面1の温度 ／ 縦軸：正味熱移動率 W。',render:(r,c)=>radiationEnclosureHeatGraph(r,c)}]},
  cylinder:{fieldNames:cylinderFieldNames,renderFields:renderCylinderFields,renderSteps:renderCylinderSteps,renderDiagram:renderCylinderDiagram,section:'2.4',
    headline:r=>({label:'熱移動率 Q̇（単位長さあたり）',value:formatHeatRate(r.watts),unit:'W',sub:`臨界半径 ${simNum(r.criticalRadius)} m、熱抵抗合計 ${simNum(r.resistance)} K/W、外面温度 ${simNum(r.outerTemperature)} ℃。`}),
    graphs:[{title:'断熱材内の温度分布',note:'横軸：相対半径位置 ／ 縦軸：温度 ℃。',render:(r,c)=>cylinderTemperatureGraph(r,c)},{title:'断熱厚さと熱移動率',note:'横軸：断熱厚さ ／ 縦軸：|Q̇|。臨界厚さの位置も示します。',render:(r,c)=>cylinderThicknessGraph(r,c)}]},
  halfspace:{fieldNames:semiInfiniteFieldNames,renderFields:renderSemiInfiniteFields,renderSteps:renderSemiInfiniteSteps,renderDiagram:renderSemiInfiniteDiagram,section:'5.6',
    headline:r=>({label:'指定した深さ・時刻の温度',value:simNum(r.temperature),unit:'℃',sub:`表面熱流束 ${simNum(r.surfaceFluxIn)} W/m²（固体内部向きを正）、拡散長さ √(αt) = ${simNum(r.diffusionLength)} m。`}),
    graphs:[{title:'深さ方向の温度分布',note:'横軸：深さ ／ 縦軸：温度 ℃。',render:(r,c)=>semiInfiniteProfileGraph(r,c)},{title:'指定深さの温度履歴',note:'横軸：経過時間 ／ 縦軸：温度 ℃。',render:r=>semiInfiniteHistoryGraph(r)}]},
  flatplate:{fieldNames:flatPlateFieldNames,renderFields:renderFlatPlateFields,renderSteps:renderFlatPlateSteps,renderDiagram:renderFlatPlateDiagram,section:'6.2',
    headline:r=>({label:'熱移動率 Q̇',value:formatHeatRate(r.watts),unit:'W',sub:`平均 h̄ = ${simNum(r.hAverage)} W/(m²·K)、平均 Nu = ${simNum(r.nuAverage)}、ReL = ${simNum(r.re)}、Pr = ${simNum(r.pr)}。`}),
    graphs:[{title:'局所熱伝達率 h(x)',note:'横軸：先端からの距離 x ／ 縦軸：局所 h W/(m²·K)。',render:(r,c)=>flatPlateLocalGraph(r,c)},{title:'流速に対する平均熱伝達率',note:'横軸：流速の範囲（最小〜最大）／ 縦軸：平均 h W/(m²·K)。',render:r=>flatPlateVelocityGraph(r)}]},
  pipe:{fieldNames:pipeFieldNames,renderFields:renderPipeFields,renderSteps:renderPipeSteps,renderDiagram:renderPipeDiagram,section:'7.3',
    headline:r=>({label:'熱移動率 Q̇',value:formatHeatRate(r.watts),unit:'W',sub:`出口温度 ${simNum(r.outlet)} ℃、h = ${simNum(r.h)} W/(m²·K)、圧力損失 ${simNum(r.pressureDrop)} Pa、水力動力 ${simNum(r.hydraulicWatts)} W。`}),
    graphs:[{title:'混合平均温度の軸方向変化',note:'横軸：相対位置 x/L ／ 縦軸：混合平均温度 ℃。',render:(r,c)=>pipeBulkGraph(r,c)},{title:'流速に対する熱伝達率',note:'横軸：流速の範囲（最小〜最大）／ 縦軸：h W/(m²·K)。',render:(r,c)=>pipeVelocityGraph(r,c)}]},
  crossflow:{fieldNames:crossflowFieldNames,renderFields:renderCrossflowFields,renderSteps:renderCrossflowSteps,renderDiagram:renderCrossflowDiagram,section:'7.6',
    headline:r=>({label:'熱移動率 Q̇',value:formatHeatRate(r.watts),unit:'W',sub:`h = ${simNum(r.h)} W/(m²·K)、NuD = ${simNum(r.nusselt)}、ReD = ${simNum(r.reynolds)}、Pr = ${simNum(r.prandtl)}。${r.warning?` ${r.warning}`:''}`}),
    graphs:[{title:'流速に対する熱伝達率',note:'横軸：流速の範囲（最小〜最大）／ 縦軸：h W/(m²·K)。',render:(r,c)=>crossflowVelocityGraph(r,c)},{title:'直径に対する熱伝達率',note:'横軸：直径の範囲（最小〜最大）／ 縦軸：h W/(m²·K)。',render:(r,c)=>crossflowDiameterGraph(r,c)}]},
  natural:{fieldNames:naturalFieldNames,renderFields:renderNaturalFields,renderSteps:renderNaturalSteps,renderDiagram:renderNaturalDiagram,section:'8.3',
    headline:r=>({label:'熱移動率 Q̇',value:formatHeatRate(r.watts),unit:'W',sub:r.h===null||r.h===undefined?'壁温と流体温が等しいため、相関は適用していません。':`平均 h = ${simNum(r.h)} W/(m²·K)、Nu = ${simNum(r.nusselt)}、Ra = ${simNum(r.rayleigh)}、熱流束 ${simNum(r.heatFlux)} W/m²。`}),
    graphs:[{title:'温度差と熱移動率',note:'横軸：温度差 ／ 縦軸：熱移動率 W。',render:(r,c)=>naturalTemperatureGraph(r,c)},{title:'高さと平均熱伝達率',note:'横軸：平板の高さの範囲 ／ 縦軸：平均 h W/(m²·K)。',render:(r,c)=>naturalHeightGraph(r,c)}]},
  laminarpipe:{fieldNames:laminarPipeFieldNames,renderFields:renderLaminarPipeFields,renderSteps:renderLaminarPipeSteps,renderDiagram:renderLaminarPipeDiagram,section:'7.2',
    headline:r=>({label:'熱移動率 Q̇',value:formatHeatRate(r.watts),unit:'W',sub:`出口温度 ${simNum(r.outlet)} ℃、区間平均 Nu = ${simNum(r.nu)}、平均 h = ${simNum(r.h)} W/(m²·K)、圧力損失 ${simNum(r.pressureDrop)} Pa。`}),
    graphs:[{title:'混合平均温度の軸方向変化',note:'横軸：相対位置 x/L ／ 縦軸：混合平均温度 ℃。',render:(r,c)=>laminarPipeBulkGraph(r,c)},{title:'区間平均ヌセルト数',note:'横軸：相対位置 x/L ／ 縦軸：加熱開始からの区間平均 Nu。',render:(r,c)=>laminarPipeNusseltGraph(r,c)}]},
  condensation:{fieldNames:condensationFieldNames,renderFields:renderCondensationFields,renderSteps:renderCondensationSteps,renderDiagram:renderCondensationDiagram,section:'8.5',
    headline:r=>({label:'平均熱伝達率 h̄',value:simNum(r.h),unit:'W/(m²·K)',sub:`熱移動率 ${formatHeatRate(r.watts)} W、下端の膜厚 ${simNum(r.filmThickness*1000)} mm、液膜 Re = ${simNum(r.filmRe)}、Ja = ${simNum(r.jakob)}、凝縮量 ${simNum(r.massFlowPerHour)} kg/h。`}),
    graphs:[{title:'液膜の厚さ δ(x)',note:'横軸：相対位置 x/L ／ 縦軸：膜厚。',render:(r,c)=>condensationThicknessGraph(r,c)},{title:'局所熱伝達率 h(x)',note:'横軸：相対位置 x/L（0.01〜1）／ 縦軸：局所 h W/(m²·K)。x=0 の発散は表示しません。',render:(r,c)=>condensationLocalGraph(r,c)}]},
  diffusion:{fieldNames:binaryDiffusionFieldNames,extraFields:['regime'],renderFields:renderBinaryDiffusionFields,renderSteps:renderBinaryDiffusionSteps,renderDiagram:renderBinaryDiffusionDiagram,section:'11.3',
    headline:r=>({label:'成分Aのモル流束 NA',value:simNum(r.fluxA),unit:'mol/(m²·s)',sub:`全モル濃度 ${simNum(r.totalConcentration)} mol/m³、モル移動速度 ${simNum(r.molarRateA)} mol/s、質量移動速度 ${simNum(r.massRateA)} kg/s。等モル条件では ${simNum(r.equimolarFlux)}、B静止条件では ${simNum(r.stagnantFlux)} mol/(m²·s)。`}),
    graphs:[{title:'モル分率の分布',note:'横軸：相対位置 z/L ／ 縦軸：成分Aのモル分率。等モルとB静止を重ねます。',render:r=>binaryDiffusionProfileGraph(r)},{title:'入口分率と成分Aの流束',note:'横軸：入口のモル分率 yA,1 ／ 縦軸：流束 mol/(m²·s)。',render:r=>binaryDiffusionBoundaryGraph(r)}]},
  nucleate:{fieldNames:nucleateFieldNames,renderFields:renderNucleateFields,renderSteps:renderNucleateSteps,renderDiagram:renderNucleateDiagram,section:'9.2',
    headline:r=>({label:'核沸騰の熱流束 q″',value:simNum(r.flux),unit:'W/m²',sub:`h = ${simNum(r.h)} W/(m²·K)、熱移動率 ${formatHeatRate(r.watts)} W、Zuber推定CHFに対する比 ${simNum(r.chfRatio*100)} %。${r.warning?` ${r.warning}`:''}`}),
    graphs:[{title:'過熱度と熱流束',note:'横軸：壁面過熱度 ΔTe ／ 縦軸：熱流束 W/m²。CHFを超える部分は描きません。',render:(r,c)=>nucleateHeatFluxGraph(r,c)},{title:'表面係数 Csf に対する熱流束',note:'横軸：Csf の倍率 ／ 縦軸：熱流束 W/m²。',render:r=>nucleateSurfaceSensitivityGraph(r)}]},
  chf:{fieldNames:chfFieldNames,renderFields:renderCriticalHeatFluxFields,renderSteps:renderCriticalHeatFluxSteps,renderDiagram:renderCriticalHeatFluxDiagram,section:'9.3',
    headline:r=>({label:'限界熱流束 q″CHF',value:simNum(r.criticalFlux),unit:'W/m²',sub:`比較する熱流束との比 ${simNum(r.ratio)}、限界の熱移動率 ${formatHeatRate(r.criticalWatts)} W、毛管長さ ${simNum(r.capillaryLength)} m。係数0.131はZuber–Kutateladzeの値で、推奨の0.149とは別系統です。${r.warning?` ${r.warning}`:''}`}),
    graphs:[{title:'表面張力に対する限界熱流束',note:'横軸：表面張力の倍率 ／ 縦軸：限界熱流束 W/m²。',render:(r,c)=>criticalHeatFluxSensitivityGraph(r,c)}]}
  };
  return extendedSimsCache;
}
function renderExtendedSimulator(mode) {
  const ext = extendedSims()[mode]; const meta = SIM_META[mode]; const values = simRead(mode);
  const result = calculateSimulation(mode, values); const baseline = state.simComparisons[mode];
  const comparison = baseline && !result.error ? calculateSimulation(mode, baseline) : null;
  const compare = comparison && !comparison.error ? comparison : null;
  const related = ext.section ? getSection(ext.section) : null;
  const head = result.error ? null : ext.headline(result);
  const resultView = result.error
    ? `<div class="sim-error" role="alert"><strong>計算できませんでした</strong><p>${escapeHTML(result.error)}</p></div>`
    : `<div class="result-number"><span>${head.label}（理想化モデル）</span><strong>${head.value}<i>${head.unit}</i></strong><small>${head.sub}</small></div>`;
  const savedView = compare ? ext.headline(compare) : null;
  return `${pageHeading('簡易シミュレーター', '条件を変えて、熱の動きを見る。', '入力値を変えると計算結果とグラフが更新されます。設計値を決めるためのものではなく、基本式の動きを試す学習用モデルです。')}
    ${renderSimTabs(mode)}
    <div class="sim-layout" role="tabpanel" id="sim-panel" aria-labelledby="sim-tab-${mode}"><section class="surface-card sim-input-card"><div class="sim-intro"><p class="eyebrow">${meta.title}</p><h2>${linkedQuizText(meta.description,4)}</h2>${ext.renderDiagram(result)}<a class="text-link" href="#guide/sim-${mode}">このモデルの理論・単位・手計算例 →</a></div><form id="sim-form" class="sim-form"><div class="sim-fields">${ext.renderFields(values)}</div></form><div class="formula-card"><span>使用する式</span><strong>${meta.formula}</strong><p>正の値は、各モデルで定義した基準方向への移動を表します。負の値なら向きが逆です。</p></div><div class="assumption-card"><strong>前提と適用範囲</strong><p>${linkedQuizText(meta.note,5)}</p></div></section>
      <section class="surface-card sim-output-card"><div class="card-heading"><div><p class="eyebrow">現在の条件</p><h2>計算結果</h2></div>${statusPill('追加モデル', 'blue')}</div>${resultView}${!result.error ? ext.renderSteps(result) : ''}
        ${!result.error ? ext.graphs.map(graph => { const svg = graph.render(result, compare); return svg ? `<div class="chart-heading"><h3>${graph.title}</h3><span>${graph.note}</span></div>${svg}${compare ? '<div class="chart-legend"><span><i class="legend-current"></i>現在の条件</span><span><i class="legend-baseline"></i>保存した比較条件</span></div>' : ''}` : ''; }).join('') : ''}
        <div class="comparison-controls"><button type="button" class="button secondary" data-action="save-comparison">この条件を比較用に保存</button>${baseline ? '<button type="button" class="text-button" data-action="clear-comparison">比較条件を削除</button>' : ''}${savedView ? `<small>保存条件の結果：${savedView.label} ${savedView.value} ${savedView.unit}</small>` : ''}</div>
      <div class="related-reading"><strong>関連する本書の範囲</strong>${related ? `<a href="#reader" data-section="${escapeHTML(related.id)}">第${escapeHTML(related.id)}節：${escapeHTML(related.title)}</a>${sourcePdfLink({}, related)}` : ''}<small>日本語の計算説明はアプリ独自の補足モデルです。原本の翻訳ではありません。</small></div>
      </section></div>`;
}
const STEFAN_BOLTZMANN = 5.670374419e-8;
function figureZoomLink(src) {
  if(!safeLocalFigurePath(src))return '';
  return `<a class="figure-zoom text-link" href="${escapeHTML(src)}" target="_blank" rel="noopener noreferrer">図を別のタブで拡大する ↗</a>`;
}
function figureSizeAttributes(figure) {
  const width=Number(figure.width),height=Number(figure.height);
  return Number.isInteger(width)&&width>0&&width<=10000&&Number.isInteger(height)&&height>0&&height<=10000 ? `width="${width}" height="${height}"` : '';
}
function renderLessonDiagram(sectionId) {
  const src=lessonDiagramPath(sectionId);
  if(!src)return '';
  return `<figure class="lesson-diagram"><img src="${escapeHTML(src)}" alt="第${escapeHTML(sectionId)}節のアプリ作成の独自図解" loading="lazy"/><figcaption><a class="figure-zoom text-link" href="${escapeHTML(src)}" target="_blank" rel="noopener noreferrer">図を別のタブで拡大する ↗</a><span>アプリ作成の独自図解です。原本の図版の転載・トレースではありません。図の適用条件と数値は図の中に明記しています。</span></figcaption></figure>`;
}
function renderSimulationSteps(mode,result) {
  const v=result.values,n=value=>Number(value).toLocaleString('ja-JP',{maximumSignificantDigits:7});
  const formulas={conduction:`${n(v.k)} W/(m·K) × ${n(v.area)} m² × (${n(v.hot)} − ${n(v.cold)}) K ÷ ${n(v.thickness)} m`,convection:`${n(v.h)} W/(m²·K) × ${n(v.area)} m² × (${n(v.surface)} − ${n(v.fluid)}) K`,radiation:`${n(v.emissivity)} × 5.670374419 × 10⁻⁸ W/(m²·K⁴) × ${n(v.area)} m² × [${n(result.surfaceK)}⁴ − ${n(result.surroundingK)}⁴] K⁴`};
  const principles={conduction:'熱は平板を厚さ方向に通ります。面積と温度差が大きいほど熱移動率は大きく、厚いほど小さくなります。',convection:'表面と流体の温度差に、熱伝達率と面積を掛けます。熱伝達率は温度差だけでは決まらず、流れや形状にも依存します。',radiation:'四乗する前に、摂氏温度に273.15を加えて絶対温度Kに換算します。温度差だけを四乗する計算にはなりません。',resistance:'各層と両側の対流を直列につなぎます。定常状態では同じ熱移動率が全要素を通り、各要素の温度降下は Q̇R です。'};
  let calculation=formulas[mode]||'',extra='';
  if(mode==='resistance'){
    const names=['高温側の対流','第1層の熱伝導','第2層の熱伝導','低温側の対流'];
    calculation=`R合計 = 1/(hₕA) + L₁/(k₁A) + L₂/(k₂A) + 1/(h𝑐A) = ${result.resistances.map(n).join(' + ')} = ${n(result.totalResistance)} K/W。Q̇ = (${n(v.hot)} − ${n(v.cold)}) K ÷ ${n(result.totalResistance)} K/W`;
    extra=`<div class="table-scroll"><table><caption>熱抵抗と各要素の両端温度（入力した順序）</caption><thead><tr><th scope="col">要素</th><th scope="col">熱抵抗 K/W</th><th scope="col">入口側 ℃</th><th scope="col">出口側 ℃</th></tr></thead><tbody>${names.map((name,i)=>`<tr><th scope="row">${name}</th><td>${n(result.resistances[i])}</td><td>${n(result.temperatures[i])}</td><td>${n(result.temperatures[i+1])}</td></tr>`).join('')}</tbody></table></div><p>共通面積基準の熱通過率 U = 1/(R合計 A) = ${n(result.overallU)} W/(m²·K)。接触抵抗はこの計算に含めていません。</p>`;
  }
  return `<div class="simulation-steps"><p><strong>補足説明：式と計算の手順</strong></p><details><summary>1. 現象と式の選び方</summary><p>${principles[mode]}</p></details><details><summary>2. 数値と単位を代入する</summary><p class="calculation-line">${calculation}</p><p>温度差1 ℃は温度差1 Kと同じ大きさです。放射の四乗には温度差ではなく絶対温度を使います。</p></details><details><summary>3. 答えと途中の値を確認する</summary><p>Q̇ = ${n(result.watts)} W。1 Wは1秒あたり1 Jの熱エネルギー移動を表します。内部計算は丸めず、途中の表示は有効数字7桁、主結果は小数第3位までです。</p>${extra}</details><small>アプリ作成の補足説明。根拠：フーリエの法則、ニュートンの冷却法則、ステファン・ボルツマンの法則と定常エネルギー収支。本書の翻訳とは区別しています。</small></div>`;
}
function simRead(mode) { return ui.simValues[mode]; }
function calculateSimulation(mode, values) { return calculateSimulationModel(mode, values); }
function renderSimInputs(mode, values) {
  const field = (name, label, unit, min = '', step = 'any', help = '') => `<label class="sim-field">${label}<span class="input-unit"><input type="number" name="${name}" value="${escapeHTML(values[name])}" min="${min}" step="${step}" inputmode="decimal" required/><i>${unit}</i></span>${help ? `<small>${help}</small>` : ''}</label>`;
  if(mode==='resistance')return `${field('area','共通の面積 A','m²','0.000001')}${field('hot','高温側の流体 Tₕ','℃')}${field('cold','低温側の流体 T𝑐','℃')}${field('hHot','高温側の熱伝達率 hₕ','W/(m²·K)','0.000001')}${field('hCold','低温側の熱伝達率 h𝑐','W/(m²·K)','0.000001')}${field('k1','第1層の熱伝導率 k₁','W/(m·K)','0.000001')}${field('L1','第1層の厚さ L₁','m','0.000001')}${field('k2','第2層の熱伝導率 k₂','W/(m·K)','0.000001')}${field('L2','第2層の厚さ L₂','m','0.000001')}`;
  if (mode === 'conduction') return `${field('k','熱伝導率 k','W/(m·K)','0.000001','any','材料の熱の伝わりやすさ')}${field('area','面積 A','m²','0.000001','any')}${field('thickness','厚さ L','m','0.000001','any','熱が通る距離')}${field('hot','高温側 Tₕ','℃','','any')}${field('cold','低温側 T𝑐','℃','','any')}`;
  if (mode === 'convection') return `${field('h','対流熱伝達率 h','W/(m²·K)','0.000001','any','流れの影響をまとめた係数')}${field('area','面積 A','m²','0.000001','any')}${field('surface','表面温度 Tₛ','℃','','any')}${field('fluid','流体温度 T∞','℃','','any')}`;
  return `${field('emissivity','放射率 ε','無次元','0','0.01','0〜1の範囲')}${field('area','面積 A','m²','0.000001','any')}${field('surface','表面温度 Tₛ','℃','','any')}${field('surrounding','周囲温度 Tsur','℃','','any','内部で絶対温度に変換します')}`;
}
function simValueAt(mode, values, delta) {
  if(mode==='resistance')return delta/(1/(values.hHot*values.area)+values.L1/(values.k1*values.area)+values.L2/(values.k2*values.area)+1/(values.hCold*values.area));
  if (mode === 'conduction') return values.k * values.area * delta / values.thickness;
  if (mode === 'convection') return values.h * values.area * delta;
  const surroundings = Number(values.surrounding) + 273.15;
  const surface=surroundings+delta;
  return values.emissivity * STEFAN_BOLTZMANN * values.area * delta * (surface+surroundings) * (surface**2+surroundings**2);
}
function simGraph(mode,current,baseline) {
  const prior=baseline?calculateSimulation(mode,baseline):null,base=prior&&!prior.error?prior:null;
  let minDelta=Math.min(0,current.delta*2,base?base.delta*2:0),maxDelta=Math.max(0,current.delta*2,base?base.delta*2:0);
  if(maxDelta===minDelta)maxDelta=minDelta+10;
  const samples=values=>{
    const start=mode==='radiation'?Math.max(minDelta,-values.surrounding-273.15+1e-6):minDelta;
    return Array.from({length:41},(_,i)=>{const d=start+(maxDelta-start)*i/40;return [d,simValueAt(mode,values,d)];}).filter(p=>Number.isFinite(p[1]));
  };
  const points=samples(current.values),basePoints=base?samples(base.values):[];
  let low=Math.min(0,current.watts,...points.map(p=>p[1]),...basePoints.map(p=>p[1])),high=Math.max(0,current.watts,...points.map(p=>p[1]),...basePoints.map(p=>p[1]));
  if(low===high)high=low+1;
  const width=560,height=250,left=66,right=20,top=18,bottom=48,w=width-left-right,h=height-top-bottom;
  const x=d=>left+(d-minDelta)/(maxDelta-minDelta)*w,y=q=>top+(high-q)/(high-low)*h;
  const path=p=>p.map(([d,q],i)=>`${i?'L':'M'}${x(d)},${y(q)}`).join(' ');
  const ticks=[0,.5,1].map(f=>{const q=low+(high-low)*f;return `<line x1="${left}" y1="${y(q)}" x2="${width-right}" y2="${y(q)}" class="chart-grid"/><text x="${left-8}" y="${y(q)+4}" text-anchor="end" class="chart-label">${q.toPrecision(2)}</text>`;}).join('');
  return `<svg class="sim-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="温度差と熱移動率の関係。現在の点は温度差${current.delta.toPrecision(3)} K、熱移動率${current.watts.toPrecision(3)} W。負の値は基準方向と逆向き。"><title>温度差と熱移動率</title>${ticks}<line x1="${left}" y1="${y(0)}" x2="${width-right}" y2="${y(0)}" class="chart-axis"/><path d="${path(points)}" class="chart-current"/>${base?`<path d="${path(basePoints)}" class="chart-baseline"/>`:''}<circle cx="${x(current.delta)}" cy="${y(current.watts)}" r="5" class="chart-current-point"/><text x="${left}" y="${height-29}" class="chart-label">${minDelta.toPrecision(2)}</text><text x="${width-right}" y="${height-29}" text-anchor="end" class="chart-label">${maxDelta.toPrecision(2)}</text><text x="${left+w/2}" y="${height-7}" text-anchor="middle" class="chart-label">温度差 ΔT（K または ℃差）</text><text x="14" y="${top+h/2}" transform="rotate(-90 14 ${top+h/2})" text-anchor="middle" class="chart-label">熱移動率 Q̇（W）</text></svg>`;
}
function renderTransientSimulator(){
  const v=ui.simValues.transient,x=calculateLumpedCooling(v),old=state.simComparisons.transient,
    prior=old?calculateLumpedCooling(old):null,
    compare=prior&&!prior.error?prior:null,
    mode='transient',meta=SIM_META.transient,related=getSection('5.1');
  const result=x.error
    ? `<div class="sim-error" role="alert"><strong>計算できませんでした</strong><p>${escapeHTML(x.error)}</p></div>`
    : `<div class="result-number"><span>経過 ${Number(x.values.time).toLocaleString('ja-JP')} 秒後の物体温度</span>
       <strong>${formatHeatRate(x.temperature)}<i>℃</i></strong>
       <small>外向き熱移動率：${formatHeatRate(x.watts)} W。累積放熱量：${formatHeatRate(x.energyJ)} J。負の値なら吸熱します。</small></div>
       <div class="assumption-card" role="status"><strong>適用性：ビオ数 Bi = ${x.biot.toPrecision(4)}</strong><p>${escapeHTML(x.applicability)}</p></div>`;
  return `${pageHeading('簡易シミュレーター','時間とともに変わる物体温度','物体・周囲の条件を変えて、非定常の冷却と加熱を比較します。')}
    ${renderSimTabs(mode)}
    <div class="sim-layout" role="tabpanel" id="sim-panel" aria-labelledby="sim-tab-${mode}"><section class="surface-card sim-input-card">
      <div class="sim-intro"><p class="eyebrow">${meta.title}</p><h2>${linkedQuizText(meta.description,4)}</h2>${renderSimulationDiagram(mode,v,x)}
      <a class="text-link" href="#guide/sim-transient">物理的背景・単位・手計算例 →</a></div>
      <form id="sim-form" class="sim-form"><div class="sim-fields">${renderTransientFields(v)}</div></form>
      <div class="formula-card"><span>使用する式</span><strong>${meta.formula}</strong>
        <p>物体温度の正負と熱移動方向は別です。放熱を正とします。</p></div>
      <div class="assumption-card"><strong>モデルの前提と限界</strong><p>${linkedQuizText(meta.note,5)}</p></div>
    </section><section class="surface-card sim-output-card">
      <div class="card-heading"><div><p class="eyebrow">現在の条件</p><h2>物体温度</h2></div>
        ${statusPill('非定常・Biを確認','amber')}</div>
      ${result}
      ${x.error?'':renderTransientSteps(x)}
      ${x.error?'':`<div class="chart-heading"><h3>時間に対する物体温度</h3><span>横軸：秒 ／ 縦軸：℃。内部温度を一様とした近似です。</span></div>
        ${transientGraph(x,compare)}
        <div class="chart-legend"><span><i class="legend-current"></i>現在の条件</span>
          ${compare?'<span><i class="legend-baseline"></i>保存した比較条件</span>':''}</div>`}
      <div class="comparison-controls"><button type="button" class="button secondary" data-action="save-comparison">この条件を比較用に保存</button>
        ${old?'<button type="button" class="text-button" data-action="clear-comparison">比較条件を削除</button>':''}
        ${compare?`<small>保存条件の結果：${formatHeatRate(compare.temperature)} ℃</small>`:''}</div>
      <div class="related-reading"><strong>関連する本書の範囲</strong>
        ${related?`<a href="#reader" data-section="${escapeHTML(related.id)}">第${escapeHTML(related.id)}節：${escapeHTML(related.title)}</a>${sourcePdfLink({},related)}`:''}
        <small>日本語の計算説明はアプリ独自の補足モデルです。原本の翻訳ではありません。</small>
        <button type="button" class="text-button" data-sim-practice="熱伝導">熱伝導の練習問題に挑戦 →</button></div>
      </section></div>`;
}
function renderSimulator() {
  if(ui.simMode==='transient')return renderTransientSimulator();
  if(extendedSims()[ui.simMode])return renderExtendedSimulator(ui.simMode);
  const mode = ui.simMode; const values = simRead(mode); const result = calculateSimulation(mode, values); const baseline = state.simComparisons[mode]; const meta = SIM_META[mode];
  const resultView = result.error ? `<div class="sim-error" role="alert"><strong>計算できませんでした</strong><p>${escapeHTML(result.error)}</p></div>` : `<div class="result-number"><span>計算結果（理想化モデル）</span><strong>${formatHeatRate(result.watts)}<i>W</i></strong><small>${result.delta===0 ? '温度差がないため、このモデルでは熱移動率は0 Wです。' : result.watts===0 ? 'この条件でのモデル計算結果は0 Wです。' : result.watts > 0 ? '高温側・表面から低温側・周囲へ熱が移動します。' : '入力した温度関係に従い、逆向きに熱が移動します。'}${mode === 'radiation' && !result.error ? ` 温度換算：${result.surfaceK.toFixed(2)} K と ${result.surroundingK.toFixed(2)} K` : ''}</small></div>`;
  const comparison = baseline && !result.error ? calculateSimulation(mode, baseline) : null;
  const related=getSection(['conduction','resistance'].includes(mode)?'2.2':mode==='convection'?'6.1':'10.1');
  return `${pageHeading('簡易シミュレーター', '条件を変えて、熱の動きを見る。', '入力値を変えると計算結果とグラフが更新されます。設計値を決めるためのものではなく、基本式の動きを試す学習用モデルです。')}
    ${renderSimTabs(mode)}
    <div class="sim-layout" role="tabpanel" id="sim-panel" aria-labelledby="sim-tab-${mode}"><section class="surface-card sim-input-card"><div class="sim-intro"><p class="eyebrow">${meta.title}</p><h2>${linkedQuizText(meta.description,4)}</h2>${renderSimulationDiagram(mode,values,result)}<a class="text-link" href="#guide/sim-${mode}">このモデルの理論・単位・手計算例 →</a></div><form id="sim-form" class="sim-form"><div class="sim-fields">${renderSimInputs(mode, values)}</div></form><div class="formula-card"><span>使用する式</span><strong>${meta.formula}</strong><p>正の値は、入力欄の「高温側」または「表面」から反対側へ移る向きを表します。負の値なら向きが逆です。</p></div><div class="assumption-card"><strong>前提と適用範囲</strong><p>${linkedQuizText(meta.note,5)}</p></div></section>
      <section class="surface-card sim-output-card"><div class="card-heading"><div><p class="eyebrow">現在の条件</p><h2>熱移動率</h2></div>${statusPill(mode === 'radiation' ? '℃からKへ換算' : '定常モデル', 'blue')}</div>${resultView}${!result.error?renderSimulationSteps(mode,result):''}
        ${!result.error ? `<div class="chart-heading"><h3>温度差を変えたとき</h3><span>現在・保存条件の温度差を含む範囲${mode==='radiation'?'。各曲線は表面温度が0 Kより高い範囲のみ表示':''}</span></div>${simGraph(mode, result, baseline)}<div class="chart-legend"><span><i class="legend-current"></i>現在の条件</span>${baseline ? '<span><i class="legend-baseline"></i>保存した比較条件</span>' : ''}</div>` : ''}
        <div class="comparison-controls"><button type="button" class="button secondary" data-action="save-comparison">この条件を比較用に保存</button>${baseline ? '<button type="button" class="text-button" data-action="clear-comparison">比較条件を削除</button>' : ''}${comparison && !comparison.error ? `<small>保存条件の結果：${comparison.watts.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} W</small>` : ''}</div>
      <div class="related-reading"><strong>関連する本書の範囲</strong><a href="#reader" data-section="${related.id}">第${escapeHTML(related.id)}節：${escapeHTML(related.title)} <span>${statusPill(sectionProgressLabel(related),sectionIsTranslated(related)?'blue':'amber')}</span></a>${sourcePdfLink({},related)}<small>${sectionIsTranslated(related)?'本文と計算の前提をあわせて確認できます。':'アプリ内訳文は未収録です。英語原本PDFで確認できます。'}</small><button type="button" class="text-button" data-sim-practice="${mode==='radiation'?'熱放射':mode==='convection'?'対流':'熱伝導'}">関連する分野の問題を選ぶ →</button></div>
      </section></div>`;
}

function linkedQuizText(value,limit=4){
  const text=String(value??''),hits=matchTerms(text,glossary||[],limit);
  let output='',cursor=0;
  for(const match of hits){
    output+=renderMathText(text.slice(cursor,match.start));
    output+=`<span role="button" tabindex="0" class="inline-term" data-term-id="${escapeHTML(match.id)}" aria-haspopup="dialog" aria-label="${escapeHTML(match.label)}の意味を開く">${escapeHTML(match.label)}</span>`;
    cursor=match.end;
  }
  return output+renderMathText(text.slice(cursor));
}
function openTermSheet(id,trigger){
  const term=glossary?.find(item=>item.id===id);if(!term)return;
  const returnFocus=ui.termId?ui.termReturnFocus:trigger||null;
  document.getElementById('term-overlay')?.remove();
  const overlay=document.createElement('div');overlay.id='term-overlay';
  overlay.innerHTML=renderTermSheet(term,glossary||[]);
  root.append(overlay);
  ui.termId=id;
  ui.termReturnFocus=returnFocus;
  // Keep background content out of the tab order and the accessibility tree
  // while the modal sheet is open; the Tab trap alone leaves it reachable
  // for switch-style navigation and some screen readers (audit A2-UXS-11).
  root.querySelector('.app-shell')?.setAttribute('inert','');
  overlay.querySelector('[data-close-term]')?.focus();
}
function closeTermSheet(){
  if(!ui.termId)return;
  const returnTo=ui.termReturnFocus;
  document.getElementById('term-overlay')?.remove();
  root.querySelector('.app-shell')?.removeAttribute('inert');
  ui.termId=null;ui.termReturnFocus=null;
  if(returnTo?.isConnected)returnTo.focus();
  else document.querySelector('#main-content')?.focus();
}
function renderQuiz() {
  if (ui.quizResult) return renderQuizResult();
  if (!ui.quiz) return renderQuizSetup();
  const session = ui.quiz; const question = getQuestion(session.ids[session.index]);
  if (!question) { ui.quiz = null; return renderQuizSetup(); }
  const choiceOrder=quizChoiceOrder(session.id,question.id);
  const answer = session.answers[session.index];
  const note = state.mistakeNotes[question.id] || {};
  const hints = question.solutionSteps || question.hints || [];
  const progress = Math.round((session.index + (answer ? 1 : 0)) / session.ids.length * 100);
  const figure = question.figure ? renderQuestionFigure(question.figure) : '';
  return `${pageHeading('問題演習', `${session.index + 1} / ${session.ids.length} 問`, 'まず自分で考え、必要ならヒントを少しずつ見てから回答しましょう。', '<button type="button" class="text-button" data-action="exit-quiz">演習を中断</button>')}
    <div class="quiz-progress"><div class="progress-line"><span style="width:${progress}%"></span></div><div class="quiz-progress-label"><span>${escapeHTML(question.field)} · ${escapeHTML(question.difficulty)}</span><span>${session.mode === 'quick' ? `${session.quickMinutes}分セット` : modeLabel(session.mode)}</span></div></div>
    <article class="question-card surface-card"><div class="question-meta"><div>${statusPill(`問題 ${session.index + 1}`, 'blue')} ${statusPill(reviewStatusLabel(question.reviewStatus), 'amber')}</div><div class="question-actions"><button type="button" class="icon-button ${state.questionBookmarks.includes(question.id) ? 'is-bookmarked' : ''}" data-question-bookmark="${escapeHTML(question.id)}" aria-label="問題をブックマーク">${state.questionBookmarks.includes(question.id) ? '★' : '☆'}</button><button type="button" class="text-button" data-action="open-report" data-report-id="${escapeHTML(question.id)}">問題を報告</button></div></div>
      <h2>${linkedQuizText(question.prompt,5)}</h2>
      ${figure}
      <p class="think-prompt"><span aria-hidden="true">✦</span> まずは自分で考えてみましょう。迷ったら、ヒントを一つずつ開けます。</p>
      ${session.hintCount ? `<div class="hint-box"><strong>${question.solutionSteps ? '考え方のステップ' : 'ヒント'}</strong><ol>${hints.slice(0, session.hintCount).map(hint => `<li>${linkedQuizText(hint,4)}</li>`).join('')}</ol></div>` : ''}
      ${!answer ? `<button type="button" class="text-button hint-trigger" data-action="reveal-hint" ${session.hintCount >= hints.length ? 'disabled' : ''}>${session.hintCount < hints.length ? `ヒントを${session.hintCount ? 'もう一つ' : '見る'}（${session.hintCount + 1}/${hints.length}）` : 'すべてのヒントを表示しました'}</button>` : ''}
      <form id="quiz-answer-form"><fieldset class="answer-options" ${answer ? 'disabled' : ''}><legend>最も適切な答えを一つ選んでください</legend>${choiceOrder.map((index,position) => `<label class="answer-choice ${session.selected === index ? 'selected' : ''} ${answer && index === question.answer ? 'correct-choice' : ''} ${answer && session.selected === index && !answer.correct ? 'wrong-choice' : ''}"><input type="radio" name="choice" value="${index}" ${session.selected === index ? 'checked' : ''} ${answer ? 'disabled' : ''}/><span class="choice-letter">${String.fromCharCode(65 + position)}</span><span>${linkedQuizText(question.choices[index],3)}</span>${answer && index === question.answer ? '<b class="choice-mark">正解</b>' : answer && session.selected === index ? '<b class="choice-mark">選択</b>' : ''}</label>`).join('')}</fieldset>
      <fieldset class="confidence-field" ${answer ? 'disabled' : ''}><legend>今の自信は？</legend><div class="confidence-options">${[['high','自信あり'],['medium','少し迷う'],['low','自信が低い'],['unsure','迷った']].map(([value,label]) => `<label><input type="radio" name="confidence" value="${value}" ${session.confidence === value ? 'checked' : ''} ${answer ? 'disabled' : ''}/><span>${label}</span></label>`).join('')}</div></fieldset>
      ${!answer ? `<button class="button primary answer-submit" type="submit" ${session.selected === null ? 'disabled' : ''}>回答する <span aria-hidden="true">↵</span></button>` : '<button type="button" class="button primary answer-submit" data-action="next-question">次の問題へ →</button>'}</form>
      ${answer ? renderAnswerFeedback(question, answer, note, choiceOrder) : ''}
    </article>
    ${ui.reportId === question.id ? renderReportForm(question) : ''}`;
}

function modeLabel(mode) { return ({ all: 'すべて', unanswered: '未回答', wrong: '誤答', bookmarked: 'ブックマーク', due: '復習候補', weak: '苦手候補', single: '選択した問題', quick: '短時間学習' })[mode] || '問題演習'; }
function renderQuizSetup() {
  const due = reviewCandidates();
  return `${renderQuizResume()}${pageHeading('問題演習', '一問ずつ、考え方を確かめる。', '回答、自信度、正誤を記録し、間違えた理由や次の復習につなげます。')}
    <div class="quiz-setup-layout"><section class="surface-card quiz-setup-card"><p class="eyebrow">出題内容を選ぶ</p><h2>今日の練習を決めましょう</h2><form id="quiz-start-form" class="stack-form">
      <label>出題対象<select name="mode"><option value="all">すべての問題</option><option value="unanswered">未回答</option><option value="wrong">一度でも間違えた問題</option><option value="bookmarked">ブックマークした問題</option><option value="due">復習候補</option><option value="weak">苦手候補</option></select></label>
      <label>章（独立補助講座に関連する問題）<select name="chapter"><option value="all">すべての章と共通補足問題</option>${book.chapters.map(ch=>`<option value="${ch.id}">第${ch.id.slice(2)}章 ${escapeHTML(ch.title)}（${questionsForChapter(questionBank,ch.id,GUIDE_SECTIONS).length}問）</option>`).join('')}</select></label>
       <div class="form-two"><label>分野<select name="field"><option value="all">すべて</option>${[...questionsByField().keys()].map(field => `<option>${escapeHTML(field)}</option>`).join('')}</select></label><label>難易度<select name="difficulty"><option value="all">すべて</option>${[...new Set(questionBank.map(q => q.difficulty))].map(value => `<option>${escapeHTML(value)}</option>`).join('')}</select></label></div>
      <label>問題数<select name="count"><option value="3">3問</option><option value="5" selected>5問</option><option value="${questionBank.length}">すべて（${questionBank.length}問）</option></select></label>
      <button class="button primary" type="submit">この条件で始める →</button>
      <p class="small-note">候補が少ないときは、条件を広げて問題を選びます。回答数の少なさだけで苦手と判定しません。</p>
    </form></section>
    <aside class="surface-card quick-session-card"><p class="eyebrow">短時間学習</p><h2>5分・10分だけ取り組む</h2><p>未回答や復習候補から、短い問題セットを作ります。回答のたびに履歴が保存されます。</p><div class="quick-buttons"><button type="button" class="button secondary" data-short-session="5">5分 · 3問まで</button><button type="button" class="button secondary" data-short-session="10">10分 · 6問まで</button></div><div class="quick-divider"></div><p class="eyebrow">今の復習候補</p><div class="quick-stat"><strong>${due.length}</strong><span>問</span><small>${due.length ? '直近の誤答・自信度・予定日をもとに抽出' : '回答後に候補が表示されます'}</small></div><a class="text-link" href="#review">抽出理由を見る →</a></aside></div>
    <section class="surface-card question-bank-card"><div class="card-heading"><div><p class="eyebrow">収録中の問題</p><h2>${questionBank.length}問</h2></div>${statusPill('専門家校閲なし', 'amber')}</div><div class="question-bank-list">${questionBank.map((q, bankIndex) => `<button type="button" class="bank-item" data-start-question="${escapeHTML(q.id)}"><span class="bank-item-index">${bankIndex + 1}</span><span><strong>${escapeHTML(q.prompt)}</strong><small>${escapeHTML(q.field)} · ${escapeHTML(q.difficulty)} · ${sourceLabel(q.source)}</small></span><b>→</b></button>`).join('')}</div><p class="small-note">独自の補足問題と書籍を出典に持つ問題は、各問題の出典欄で区別します。英語原本PDFは読書画面から閲覧できます。アプリ内に再構成した日本語訳や原図は公開版に未収録です。</p></section>`;
}

function renderQuestionFigure(figure) {
  if (figure.kind === 'book') {
    const hasLocalImage=safeLocalFigurePath(figure.src);
    const visual=hasLocalImage?`<img src="${escapeHTML(figure.src)}" alt="${escapeHTML(figure.alt)}" loading="lazy" ${figureSizeAttributes(figure)}/>`:`<div class="figure-placeholder original-only" role="img" aria-label="${escapeHTML(figure.alt)}">原図は英語原本PDFで確認できます。下に図の説明と出典ページを示します。</div>`;
    const original=sourcePdfLink({pdfPages:figure.pdfPage});
    return `<figure class="question-figure">${visual}<figcaption>${hasLocalImage?figureZoomLink(figure.src):''}<strong>${escapeHTML(figure.caption)}</strong><span>${escapeHTML(figure.description || figure.alt)}</span><small>出典：本書 図${escapeHTML(figure.figureNumber)} · 書籍 p.${escapeHTML(figure.bookPage)} · PDF p.${escapeHTML(figure.pdfPage)}</small>${original}</figcaption></figure>`;
  }
  if (figure.kind === 'app-created') return `<figure class="question-figure"><div class="wall-diagram" role="img" aria-label="${escapeHTML(figure.alt)}"><div class="wall-temp hot"><span>Tₕ</span><small>高温</small></div><div class="wall-body"><span class="heat-arrow">Q̇　→</span><span class="wall-label">平板</span><span class="wall-thickness">L</span><span class="wall-gradient">Tₕ　····→　T𝑐</span></div><div class="wall-temp cold"><span>T𝑐</span><small>低温</small></div><div class="wall-delta">ΔT = Tₕ − T𝑐</div></div><figcaption>${escapeHTML(figure.caption)}<span>${escapeHTML(figure.alt)}</span></figcaption></figure>`;
  return `<figure class="question-figure"><div class="figure-placeholder" role="img" aria-label="${escapeHTML(figure.alt)}">図の説明を表示しています</div><figcaption>${escapeHTML(figure.caption)}<span>${escapeHTML(figure.alt)}</span></figcaption></figure>`;
}

function renderAnswerFeedback(question, answer, existingNote, choiceOrder) {
  const dynamicExperiment=dynamicLinkForQuestion(question,questionFingerprint(question));
  const correct = answer.correct;
  const sourceSection=getSection(question.source.section);
  const guideId=question.source.guideId;
  const sourceAction = question.source.type === 'book' ? `<div class="source-ref">出典：${sourceLabel(question.source)}。${sectionIsTranslated(sourceSection)?`<button type="button" class="text-link" data-section="${escapeHTML(question.source.section)}">アプリ内の本文を開く →</button>`:`アプリ内の日本語訳は未収録です。${independentNoteForSection(originalNotes,question.source.section)?`<button type="button" class="text-link" data-section="${escapeHTML(question.source.section)}">関連する独自日本語節別ノートを読む →</button>`:''}`}</div>${sourcePdfLink(question.source,sourceSection)}` : `<div class="source-ref">${sourceLabel(question.source)}。書籍本文ではなくアプリ作成の説明です。${GUIDE_SECTIONS.some(section=>section.id===guideId)?`<a class="text-link" href="#guide/${guideId}">関連する学習ガイドへ →</a>`:''}${(question.source.sectionNoteId||question.source.focusSectionId) && independentNoteForSection(originalNotes,question.source.sectionNoteId||question.source.focusSectionId)?`<button type="button" class="text-link" data-section="${escapeHTML(question.source.sectionNoteId||question.source.focusSectionId)}">関連する独自日本語節別ノートを読む →</button>`:''}</div>`;
  const reasons = choiceOrder.map((index,position) => `<li class="${index === question.answer ? 'is-correct' : ''}"><strong>${String.fromCharCode(65 + position)} ${index === question.answer ? '正解' : '誤答'}</strong><p>${linkedQuizText(question.distractors[index],4)}</p></li>`).join('');
  return `<section class="answer-feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}" id="answer-feedback" tabindex="-1" aria-live="polite"><div class="feedback-title"><span class="feedback-symbol">${correct ? '✓' : '!'}</span><div><strong>${correct ? '正解です' : '今回は不正解です'}</strong><small>自信度：${confidenceLabel(answer.confidence)} · ${formatTime(answer.at)}</small></div></div>
    <div class="explanation-block"><h3>何を問う問題だった？</h3><p>${linkedQuizText(question.prompt,5)}</p><h3>正解へ至る考え方</h3><p>${linkedQuizText(question.explanation,6)}</p></div>
    ${question.beginnerPitfall ? `<aside class="notice-card"><p><strong>間違えやすい点：</strong> ${linkedQuizText(question.beginnerPitfall,4)}</p></aside>` : ''}${question.solutionSteps?.length?`<details class="solution-steps" open><summary>式と計算を順に確認する</summary><ol>${question.solutionSteps.map(step=>`<li>${linkedQuizText(step,4)}</li>`).join('')}</ol></details>`:''}<details class="distractor-details" open><summary>4つの選択肢を確認する</summary><ol>${reasons}</ol></details><div class="answer-source"><strong>関連する出典</strong>${sourceAction}</div>${dynamicExperiment?`<p><a class="text-link" href="${escapeHTML(dynamicExperiment.href)}" target="_blank" rel="noopener">${escapeHTML(dynamicExperiment.label)}（別タブ）→</a></p>`:''}
    <form class="mistake-note-form" id="mistake-note-form"><p class="eyebrow">間違いノート</p><h3>次に同じ問題を解くときのために</h3><div class="form-two"><label>間違えた理由（任意）<textarea name="reason" rows="2" maxlength="500" placeholder="例：分母にある量を見落とした">${escapeHTML(existingNote.reason || '')}</textarea></label><label>自分向けの覚え方（任意）<textarea name="memory" rows="2" maxlength="500" placeholder="例：厚さが増えると熱の通り道が長くなる">${escapeHTML(existingNote.memory || '')}</textarea></label></div><label>次に注意すること（任意）<textarea name="nextTime" rows="2" maxlength="500" placeholder="例：式を書いてから選択肢を見る">${escapeHTML(existingNote.nextTime || '')}</textarea></label><button type="submit" class="button secondary">間違いノートを保存</button>${existingNote.updatedAt ? `<small>保存済み · ${formatDate(existingNote.updatedAt.slice(0,10))}</small>` : ''}</form></section>`;
}
function confidenceLabel(value) { return ({ high: '自信あり', medium: '少し迷う', low: '自信が低い', unsure: '迷った' })[value] || '未記録'; }
function renderQuizStartConfirm() {
  const draft = state.quizDraft;
  const progress = draft && Array.isArray(draft.ids) ? `（${draft.index + 1} / ${draft.ids.length}問目）` : '';
  return `<div class="modal-backdrop" role="presentation"><section class="report-modal quiz-start-modal surface-card" role="dialog" aria-modal="true" aria-labelledby="quiz-start-confirm-title"><p class="eyebrow">演習の開始確認</p><h2 id="quiz-start-confirm-title">中断している演習があります</h2><p>新しい問題セットを始めると、中断中の演習${progress}は置き換えられます。すでに保存された回答履歴は保持します。</p><div class="button-row"><button type="button" class="button primary" data-action="confirm-quiz-start">中断を置き換えて始める</button><button type="button" class="button secondary" data-action="cancel-quiz-start">やめる</button></div></section></div>`;
}
function renderReportForm(question) {
  const history = state.questionReports[question.id] || [];
  return `<div class="modal-backdrop" role="presentation"><section class="report-modal surface-card" role="dialog" aria-modal="true" aria-labelledby="report-title"><button class="modal-close" type="button" data-action="close-report" aria-label="閉じる">×</button><p class="eyebrow">問題の品質報告</p><h2 id="report-title">気になるところを教えてください</h2><p class="report-question-preview">${escapeHTML(question.prompt)}</p><form id="report-form"><label>報告内容<select name="category"><option value="ambiguous">条件が不足・曖昧</option><option value="answer">正解や解説に誤りがある</option><option value="source">出典やページが違う</option><option value="figure">図・代替説明に問題がある</option><option value="other">その他</option></select></label><label>具体的な内容<textarea name="message" rows="4" maxlength="1000" placeholder="どの箇所が、なぜ問題かを書いてください" required></textarea></label><button class="button primary" type="submit">この端末に報告を保存</button></form>${history.length ? `<div class="report-history"><strong>この端末での報告履歴：${history.length}件</strong>${history.slice(-3).reverse().map(item => `<small>${formatDate(localDay(item.at))} · ${escapeHTML(({ambiguous:'条件が不足・曖昧',answer:'正解・解説',source:'出典・ページ',figure:'図・代替説明',other:'その他'})[item.category]||'その他')} · ${escapeHTML(item.message)}</small>`).join('')}</div>` : '<p class="small-note">報告はこの端末にだけ保存され、外部へ送信されません。</p>'}</section></div>`;
}

function renderQuizResult() {
  const result = ui.quizResult;
  const percent = result.total ? Math.round(result.correct / result.total * 100) : 0;
  const wrong = result.answers.filter(answer => !answer.correct);
  const fields = new Map();
  for (const answer of result.answers) { const q = getQuestion(answer.questionId); if (!q) continue; const current = fields.get(q.field) || { total: 0, correct: 0 }; current.total++; current.correct += answer.correct ? 1 : 0; fields.set(q.field, current); }
  return `${pageHeading('学習のふり返り', '一回分の記録を確認する。', `${formatDate(result.date)}　·　学習時間 ${studyDuration(result.activeSeconds??(result.finishedAt-result.startedAt)/1000)}`) }
    <section class="surface-card session-result"><div class="result-score"><div class="score-circle" style="--score:${percent}%"><strong>${percent}%</strong><span>正答率</span></div><div><p class="eyebrow">今回の演習</p><h2>${result.total}問に回答しました</h2><p>${result.correct}問正解 · ${result.total - result.correct}問不正解 · 自信が低い回答 ${result.answers.filter(item => ['low','unsure'].includes(item.confidence)).length}問</p></div></div>
      <div class="session-field-list"><h3>分野別の結果</h3>${[...fields.entries()].map(([field,value]) => `<div class="field-result-row"><span>${escapeHTML(field)}</span><div class="mini-bar"><i style="width:${Math.round(value.correct/value.total*100)}%"></i></div><strong>${value.correct}/${value.total}</strong></div>`).join('')}</div>
      <div class="next-review-callout"><span class="action-icon amber">↻</span><div><strong>次の復習予定</strong><p>正誤と自信度に応じて、問題ごとに復習日を提案しています。予定は復習画面で変更できます。</p></div><a class="button secondary" href="#review">復習を確認</a></div>
      ${wrong.length ? `<div class="wrong-retry-list"><h3>間違えた問題</h3>${wrong.map(item => { const q=getQuestion(item.questionId); return `<button type="button" data-start-question="${escapeHTML(q.id)}"><span>${escapeHTML(q.prompt)}</span><b>再挑戦 →</b></button>`; }).join('')}<button type="button" class="button primary" data-start-ids='${escapeHTML(JSON.stringify(wrong.map(item=>item.questionId)))}'>間違い問題にまとめて再挑戦</button></div>` : '<div class="success-callout"><strong>今回の問題はすべて正解です。</strong><span>自信が低い問題は復習候補に入る場合があります。</span></div>'}
      <div class="button-row result-actions"><button class="button primary" type="button" data-action="again-quiz">別の問題を解く</button><a class="button secondary" href="#home">学習ホームへ</a></div></section>`;
}

function renderReview() {
  const items = reviewCandidates(); const due = items.filter(item => item.due <= todayISO()).length;
  return `${pageHeading('復習と間違いノート', '覚え直すタイミングを逃さない。', '直近の誤答、繰り返しの誤答、低い正答率、自信度、復習予定から候補を抽出します。', items.length ? '<button type="button" class="button primary" data-action="start-review">復習セットを始める →</button>' : '')}
    <div class="review-summary-grid"><div class="surface-card review-stat"><span>復習予定日を過ぎた問題</span><strong>${due}</strong><small>今日 ${todayISO()}</small></div><div class="surface-card review-stat"><span>復習候補</span><strong>${items.length}</strong><small>抽出理由を各問題に表示</small></div><div class="surface-card review-stat"><span>間違いノート</span><strong>${Object.keys(state.mistakeNotes).length}</strong><small>自分向けの覚え方も記録</small></div></div>
    <section class="surface-card review-method"><p><strong>候補の目安：</strong>直近の誤答、2回以上の誤答、3回以上の回答で正答率60%未満、または直近の自信が低い・迷った回答を候補にします。復習日を過ぎた問題も表示します。回答数が少ないことだけを理由に苦手とは判定しません。</p></section>
    ${items.length ? `<div class="review-list">${items.map(item => `<article class="review-item surface-card"><div class="review-item-heading"><div><p class="eyebrow">${escapeHTML(item.question.field)} · ${escapeHTML(item.question.difficulty)}</p><h2>${escapeHTML(item.question.prompt)}</h2></div>${statusPill(item.due <= todayISO() ? '復習時期' : `予定 ${formatDate(item.due)}`, item.due <= todayISO() ? 'amber' : 'blue')}</div><div class="reason-tags">${item.reasons.map(reason => statusPill(escapeHTML(reason), 'neutral')).join('')}</div><div class="review-data"><span>${item.attempts}回回答</span><span>${item.accuracy === null ? '正答率 —' : `正答率 ${Math.round(item.accuracy * 100)}%`}</span><span>出典：${sourceLabel(item.question.source)}</span></div>${state.mistakeNotes[item.question.id] ? `<div class="saved-mistake"><strong>自分のメモ</strong><p>${escapeHTML(state.mistakeNotes[item.question.id].reason || '理由の記録なし')}</p>${state.mistakeNotes[item.question.id].memory ? `<p>覚え方：${escapeHTML(state.mistakeNotes[item.question.id].memory)}</p>` : ''}</div>` : '<p class="small-note">間違いノートは問題に回答した後に記録できます。</p>'}<div class="review-item-actions"><button type="button" class="button primary" data-start-question="${escapeHTML(item.question.id)}">この問題を解き直す</button><label class="reschedule-label">復習日を変更<input type="date" data-review-date="${escapeHTML(item.question.id)}" value="${escapeHTML(item.due === '9999-12-31' ? todayISO() : item.due)}" min="${todayISO()}"/></label><button type="button" class="text-button" data-complete-review="${escapeHTML(item.question.id)}">復習を完了</button></div></article>`).join('')}</div>` : `<div class="empty-state surface-card"><span class="empty-mark">↻</span><h2>復習候補はまだありません</h2><p>問題を解くと、誤答や自信度をもとに復習候補ができます。正解しても自信が低いときは、復習候補になります。</p><a class="button primary" href="#quiz">問題演習を始める</a></div>`}
    <section class="surface-card session-history"><div class="card-heading"><div><p class="eyebrow">間違いノート</p><h2>記録した理由と覚え方</h2></div></div>${Object.keys(state.mistakeNotes).length ? Object.entries(state.mistakeNotes).map(([id,note]) => { const q=getQuestion(id); return q ? `<div class="mistake-summary"><strong>${escapeHTML(q.prompt)}</strong><p>${escapeHTML(note.reason || '理由は未記入')} ${note.memory ? ` · 覚え方：${escapeHTML(note.memory)}` : ''}</p><button type="button" class="text-link" data-start-question="${escapeHTML(id)}">再挑戦 →</button></div>` : ''; }).join('') : '<p class="muted">回答後に、間違えた理由や次に注意することをここで確認できます。</p>'}</section>`;
}

function startQuiz(options = {}) {
  const mode = options.mode || 'all';
  let candidates = [...questionBank];
  if (options.questionIds) candidates = candidates.filter(q => options.questionIds.includes(q.id));
  else if (mode === 'unanswered') candidates = candidates.filter(q => getAttemptStats(q.id).attempts.length === 0);
  else if (mode === 'wrong') candidates = candidates.filter(q => getAttemptStats(q.id).attempts.some(attempt => !attempt.correct));
  else if (mode === 'bookmarked') candidates = candidates.filter(q => state.questionBookmarks.includes(q.id));
  else if (mode === 'due' || mode === 'weak' || mode === 'review') {
    const ids = new Set(reviewCandidates().filter(item => mode !== 'due' || item.due <= todayISO()).map(item => item.question.id));
    candidates = candidates.filter(q => ids.has(q.id));
  }
  if (options.chapter && options.chapter !== 'all') candidates = candidates.filter(q => questionChapter(q,GUIDE_SECTIONS)===options.chapter);
  if (options.field && options.field !== 'all') candidates = candidates.filter(q => q.field === options.field);
  if (options.difficulty && options.difficulty !== 'all') candidates = candidates.filter(q => q.difficulty === options.difficulty);
  if (options.questionId) candidates = candidates.filter(q => q.id === options.questionId);
  if (mode === 'due' || mode === 'weak' || mode === 'review') {
    const rank = new Map(reviewCandidates().map((item,index) => [item.question.id,index]));
    candidates.sort((a,b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  } else if(options.preserveOrder && Array.isArray(options.questionIds)) {
    const priority=new Map(options.questionIds.map((id,index)=>[id,index]));
    candidates.sort((a,b)=>(priority.get(a.id)??Infinity)-(priority.get(b.id)??Infinity));
  } else candidates = shuffle(candidates);
  const count = Math.max(1, Math.min(Number(options.count || candidates.length || 1), candidates.length));
  const selected = candidates.slice(0, count).map(q => q.id);
  if (!selected.length) { showStatus('この条件に合う問題はありません。対象や分野を広げてください。'); return; }
  if(state.quizDraft&&!options.replaceDraft){ui.pendingQuizStart={...options};render();return;}
  flushLearningTime();ui.quizResult = null;
  ui.quiz = { id:makeId(),ids: selected, index: 0, mode, field: options.field || 'all', difficulty: options.difficulty || 'all', startedAt: Date.now(), answers: [], selected: null, confidence: 'medium', hintCount: 0, quickMinutes: options.quickMinutes || null };
  persistQuiz();saveState();setRoute('quiz');
}
function shuffle(values) { const result = [...values]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function startQuickSession(minutes) {
  const limit = minutes === 5 ? 3 : 6;
  let ids = reviewCandidates().filter(item => item.due <= todayISO()).map(item => item.question.id);
  const unseen = questionBank.filter(q => getAttemptStats(q.id).attempts.length === 0).map(q => q.id);
  ids = [...new Set([...ids, ...unseen])];
  if (ids.length < limit) ids = [...new Set([...ids, ...shuffle(questionBank.map(q => q.id))])];
  startQuiz({ mode: 'quick', questionIds: shuffle(ids).slice(0, limit), count: limit, quickMinutes: minutes });
}
function submitQuizAnswer(form) {
  if (!ui.quiz) return;
  const session = ui.quiz;
  if (session.answers[session.index]) return;
  const question = getQuestion(session.ids[session.index]);
  if (!question || !Number.isInteger(session.selected) || session.selected < 0 || session.selected > 3) { showStatus('選択肢を一つ選んでから回答してください。'); return; }
  const answer = { questionId: question.id, selected: session.selected, selectedText: question.choices[session.selected], correctText: question.choices[question.answer], questionRevision: question.revision || 'initial', correct: session.selected === question.answer, confidence: session.confidence || 'medium', at: new Date().toISOString(), mode: session.mode };
  const interval = nextReviewDays(state.attempts.filter(a=>a.questionId===question.id&&isCurrentQuestionAnswer(question,a)),answer);
  session.answers[session.index] = answer;
  state.attempts.push({ ...answer, id: makeId() });
  state.reviews[question.id] = { ...(state.reviews[question.id] || {}), dueDate: addDaysISO(todayISO(), interval), suggestedDays: interval, lastAnsweredAt: answer.at };
  persistQuiz();saveState(); ui.reportMessage = ''; render(); document.querySelector('#answer-feedback')?.focus({ preventScroll: true });
}
function moveToNextQuestion() {
  if (!ui.quiz || !ui.quiz.answers[ui.quiz.index]) return;
  if (ui.quiz.index < ui.quiz.ids.length - 1) {
    ui.quiz.index++;
    ui.quiz.selected = null; ui.quiz.confidence = 'medium'; ui.quiz.hintCount = 0;
    persistQuiz();saveState();render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  flushLearningTime();const session = ui.quiz;
  const answers = session.answers.filter(Boolean);
  const result = { date: todayISO(), startedAt: session.startedAt, finishedAt: Date.now(), total: answers.length, correct: answers.filter(item => item.correct).length, answers };
  result.activeSeconds=state.activities.filter(a=>a.sessionId===session.id).reduce((n,a)=>n+a.seconds,0);
  if(!state.sessions.some(s=>s.id===session.id))state.sessions.push({ ...result, id: session.id||makeId() });state.quizDraft=null;saveState();
  ui.quiz = null; ui.quizResult = result; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function makeId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,9)}`; }
function addDaysISO(day, count) { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + count); return todayISO(date); }

function onClick(event) {
  const termTrigger=event.target.closest('[data-term-id]');
  if(termTrigger){event.preventDefault();event.stopPropagation();openTermSheet(termTrigger.dataset.termId,termTrigger);return;}
  const termClose=event.target.closest('[data-close-term]');
  if(termClose){event.preventDefault();closeTermSheet();return;}
  const detail=event.target.closest('[data-term-detail]');
  if(detail){event.preventDefault();const id=detail.dataset.termDetail;closeTermSheet();ui.glossaryQuery='';setRoute('glossary');setTimeout(()=>document.getElementById('term-'+id)?.scrollIntoView({block:'center'}),90);return;}
  if(ui.termId&&event.target.closest('[data-term-backdrop]')&&!event.target.closest('.term-sheet')){event.preventDefault();closeTermSheet();return;}
  const languageButton = event.target.closest('[data-language]');
  if (languageButton) {
    if (languageButton.disabled || !['ja', 'en'].includes(languageButton.dataset.language)) return;
    stopSpeech(false);
    state.settings.contentLanguage = languageButton.dataset.language;
    saveState();
    const scrollY = window.scrollY;
    render();
    window.scrollTo({ top: scrollY, behavior: 'instant' });
    document.querySelector(`[data-language="${languageButton.dataset.language}"]`)?.focus();
    return;
  }
  const sectionTrigger = event.target.closest('[data-section]');
  if (sectionTrigger) {
    event.preventDefault();
    openReader(sectionTrigger.dataset.section);
    return;
  }
  const chapterTrigger=event.target.closest('[data-chapter-practice]');
  if(chapterTrigger){event.preventDefault();
    const chapter=chapterTrigger.dataset.chapterPractice;
    const matching=questionsForChapter(questionBank,chapter,GUIDE_SECTIONS);
    if(!matching.length){showStatus('この章に収録された問題はありません。');return;}
    if(chapterTrigger.dataset.chapterPracticeMode==='priority'){
      const item=chapterLearningOverview(book,questionBank,GUIDE_SECTIONS,state.attempts,state.readSections).find(c=>c.chapter===chapter);
      const ids=item?.recommendedQuestionIds||[];
      if(!ids.length){showStatus('この章に未正解・未回答の問題はありません。');return;}
      startQuiz({mode:'all',chapter,questionIds:ids,preserveOrder:true,count:Math.min(10,ids.length)});return;
    }
    startQuiz({mode:'all',chapter,count:matching.length});return;
  }
  const mapTrigger = event.target.closest('[data-map-field]');
  if (mapTrigger) { event.preventDefault(); startQuiz({ mode: 'all', field: mapTrigger.dataset.mapField, count: 8 }); return; }
  const simPractice=event.target.closest('[data-sim-practice]');
  if(simPractice){event.preventDefault();flushLearningTime();persistQuiz();ui.quiz=null;ui.quizResult=null;setRoute('quiz');const select=document.querySelector('#quiz-start-form [name="field"]');if(select){const option=[...select.options].find(o=>o.value!=='all'&&o.textContent.includes(simPractice.dataset.simPractice));if(option)select.value=option.value;}showStatus('分野と問題数を確認して演習を始めてください。');return;}
  const openBookmark=event.target.closest('[data-bookmark]');
  if(openBookmark){event.preventDefault();const b=state.bookmarks.find(item=>item.id===openBookmark.dataset.bookmark);if(b)openReader(b.sectionId,{blockId:b.blockId,position:b.position,language:b.language,offset:b.offset});return;}
  const openSection = event.target.closest('[data-open-section]');
  if (openSection) { event.preventDefault(); openReader(openSection.dataset.openSection); return; }
  const short = event.target.closest('[data-short-session]'); if (short) { event.preventDefault(); startQuickSession(Number(short.dataset.shortSession)); return; }
  const startQuestion = event.target.closest('[data-start-question]'); if (startQuestion) { event.preventDefault(); startQuiz({ mode: 'single', questionId: startQuestion.dataset.startQuestion, count: 1 }); return; }
  const startIds = event.target.closest('[data-start-ids]'); if (startIds) { event.preventDefault(); try { startQuiz({ mode: 'wrong', questionIds: JSON.parse(startIds.dataset.startIds), count: 8 }); } catch { showStatus('問題セットを読み込めませんでした。'); } return; }
  const target = event.target.closest('[data-search-target]'); if (target) { event.preventDefault(); try { const item=JSON.parse(target.dataset.searchTarget); if (item.section) ui.readerSection=item.section; if (item.language && ['ja','en'].includes(item.language)) { state.settings.contentLanguage=item.language; saveState(); } if (item.question) { startQuiz({ mode:'single', questionId:item.question, count:1 }); return; } if(item.guideId&&GUIDE_SECTIONS.some(g=>g.id===item.guideId)){location.hash='#guide/'+item.guideId;return;} if (item.term) { ui.glossaryQuery=''; setRoute('glossary'); setTimeout(()=>document.getElementById(`term-${item.term}`)?.scrollIntoView({behavior:'smooth',block:'center'}),80); return; } if(item.route==='reader'&&item.section){openReader(item.section,{...item,query:ui.search.query});return;} if (item.route) setRoute(item.route); } catch { showStatus('検索先を開けませんでした。'); } return; }
  const bookmarkToggle = event.target.closest('[data-question-bookmark]'); if (bookmarkToggle) { const id=bookmarkToggle.dataset.questionBookmark; state.questionBookmarks = state.questionBookmarks.includes(id) ? state.questionBookmarks.filter(item=>item!==id) : [...state.questionBookmarks,id]; const saved=saveState(); render(); showStatus(saved?(state.questionBookmarks.includes(id) ? '問題をブックマークしました。' : '問題ブックマークを外しました。'):'問題ブックマークを端末に保存できませんでした。JSONを書き出してください。'); return; }
  const deleteBookmark = event.target.closest('[data-delete-bookmark]'); if (deleteBookmark) { state.bookmarks=state.bookmarks.filter(item=>item.id!==deleteBookmark.dataset.deleteBookmark); saveState(); render(); return; }
  const editNote=event.target.closest('[data-edit-note]');if(editNote){ui.noteEditId=editNote.dataset.editNote;render();document.querySelector('#reader-note-form textarea')?.focus();return;}
  const deleteNote = event.target.closest('[data-delete-note]'); if (deleteNote) { state.notes=state.notes.filter(item=>item.id!==deleteNote.dataset.deleteNote); const saved=saveState(); render(); showStatus(saved?'学習メモを削除しました。':'学習メモの削除を端末に保存できませんでした。JSONを書き出してください。'); return; }
  const calendarDay = event.target.closest('[data-date]'); if (calendarDay) { ui.calendarDate=calendarDay.dataset.date; render(); return; }
  const completeReview = event.target.closest('[data-complete-review]'); if (completeReview) { const id=completeReview.dataset.completeReview; state.completedReviews[id]=new Date().toISOString(); state.reviews[id]={...(state.reviews[id]||{}), lastReviewedAt:state.completedReviews[id], dueDate:addDaysISO(todayISO(),3), suggestedDays:3}; const saved=saveState(); render(); showStatus(saved?'復習を記録しました。次の予定は3日後です。':'復習を端末に保存できませんでした。JSONを書き出してください。'); return; }
  const simMode = event.target.closest('[data-sim-mode]'); if (simMode) { ui.simMode=simMode.dataset.simMode; render(); return; }
  const actionButton = event.target.closest('[data-action]'); if (!actionButton) return;
  const action = actionButton.dataset.action;
  if(action==='skip-content'){event.preventDefault();const main=document.querySelector('#main-content');if(main){main.focus({preventScroll:true});main.scrollIntoView();}return;}
  if(action==='prepare-bookmark'){ui.bookmarkPosition=readerPosition();document.querySelector('#bookmark-note')?.focus();showStatus(sectionIsTranslated(getSection(ui.readerSection))?'この位置をしおりにします。メモを入力して「しおりを付ける」を押してください。':'この節の開始ページをしおりにします。必要ならメモを入力してください。');return;}
  if (action === 'toggle-theme') { const effective = state.settings.theme === 'system' ? (systemDark?.matches?'dark':'light') : state.settings.theme; state.settings.theme=effective==='dark'?'light':'dark'; saveState(); render(); }
  else if (action === 'reader-font-up') { state.settings.fontScale=Math.min(1.4,Number((state.settings.fontScale+0.05).toFixed(2))); saveState(); render(); }
  else if (action === 'reader-font-down') { state.settings.fontScale=Math.max(0.9,Number((state.settings.fontScale-0.05).toFixed(2))); saveState(); render(); }
  else if (action === 'reader-width') { state.settings.width=state.settings.width==='reading'?'wide':'reading'; saveState(); render(); }
  else if (action === 'reader-line') { const values=[1.6,1.8,2,2.2]; const index=values.findIndex(value=>Math.abs(value-state.settings.lineHeight)<0.06); state.settings.lineHeight=values[(index+1)%values.length]; saveState(); render(); }
  else if (action === 'toggle-read') { state.readSections[ui.readerSection]=!state.readSections[ui.readerSection]; saveState(); render(); }
  else if (action === 'speak') speakSection();
  else if (action === 'stop-speech') stopSpeech();
  else if (action === 'clear-search') { ui.search.query=''; ui.searchResults=[]; ui.searchLimit=100; render(); document.querySelector('#search-query')?.focus(); }
  else if (action === 'search-more') { ui.searchLimit=(ui.searchLimit||100)+100; render(); }
  else if (action === 'reveal-hint') { if (ui.quiz) { const q=getQuestion(ui.quiz.ids[ui.quiz.index]); const max=(q.solutionSteps||q.hints||[]).length; ui.quiz.hintCount=Math.min(max,ui.quiz.hintCount+1);persistQuiz();saveState();render(); } }
  else if (action === 'next-question') moveToNextQuestion();
  else if (action === 'open-report') { ui.reportId=actionButton.dataset.reportId || getQuestion(ui.quiz?.ids[ui.quiz.index])?.id; render(); }
  else if (action === 'close-report') closeReport();
  else if (action === 'confirm-quiz-start') confirmQuizStart();
  else if (action === 'cancel-quiz-start') cancelQuizStart();
  else if (action === 'force-save') forceSave();
  else if (action === 'exit-quiz') { flushLearningTime();persistQuiz();const saved=saveState();ui.quiz=null;ui.quizResult=null;setRoute('quiz');showStatus(saved?'中断した演習を保存しました。再読み込み後も再開できます。':'中断した演習を端末に保存できませんでした。JSONを書き出してください。'); }
  else if(action==='resume-quiz')resumeQuiz();
  else if(action==='discard-quiz'){state.quizDraft=null;const saved=saveState();render();showStatus(saved?'中断セットを破棄しました。回答履歴は保持しています。':'中断セットの破棄を端末に保存できませんでした。JSONを書き出してください。');}
  else if (action === 'start-review') startQuiz({ mode:'review', count:8 });
  else if (action === 'again-quiz') { ui.quizResult=null; setRoute('quiz'); }
  else if (action === 'stop-plan') { state.plan.active=false; const saved=saveState(); render(); showStatus(saved?'学習計画を停止しました。':'学習計画の停止を端末に保存できませんでした。JSONを書き出してください。'); }
  else if (action === 'calendar-prev' || action === 'calendar-next') { const date=new Date(`${ui.calendarDate}T12:00:00`); ui.calendarDate=shiftMonth(ui.calendarDate,action==='calendar-prev'?-1:1); render(); }
  else if (action === 'save-comparison') { const result=calculateSimulation(ui.simMode,simRead(ui.simMode)); if(result.error){showStatus(result.error);return;} state.simComparisons[ui.simMode]={...simRead(ui.simMode)}; const saved=saveState(); render(); showStatus(saved?'比較用の条件を保存しました。':'比較用の条件を端末に保存できませんでした。JSONを書き出してください。'); }
  else if (action === 'clear-comparison') { delete state.simComparisons[ui.simMode]; saveState(); render(); }
  else if(action==='cache-pdf'){
    if(!('serviceWorker' in navigator)){setPdfCacheStatus('unsupported');showStatus('このブラウザーではアプリ内のオフライン保存を利用できません。PDFのダウンロードを利用してください。');return;}
    setPdfCacheStatus('saving');
    showStatus('原本PDF（約31MB）の保存を開始します。完了の通知までネット接続を保ってください。');
    navigator.serviceWorker.ready.then(registration=>{if(!registration.active)throw Error('no-active-worker');registration.active.postMessage({type:'CACHE_PDF'});}).catch(()=>{setPdfCacheStatus('unknown');showStatus('オフライン保存を開始できませんでした。ネット接続とブラウザー設定を確認してください。');});
  }
  else if(action==='cancel-note-edit'){ui.noteEditId=null;render();}
  else if(action==='export-before-import')exportBackup('before-import');
  else if(action==='export-stored-recovery')exportBackup('recovery');
  else if(action==='preview-backup')previewBackup();
  else if (action === 'export-data') exportData();
  else if (action === 'export-preview') { ui.exportJSON=JSON.stringify(exportPayload(),null,2);render();document.querySelector('#export-json')?.focus(); }
  else if (action === 'select-export') document.querySelector('#export-json')?.select();
  else if (action === 'export-recovery') {
    if(downloadJSON(recoveryRaw,'heat-study-original-recovery.json'))showStatus('保管した元データの書き出しを開始しました。ブラウザーのダウンロードを確認してください。');
    else offerManualExport(recoveryRaw);
  }
  else if (action === 'import-merge') importData(false);
  else if (action === 'import-replace') importData(true);
}

function onSubmit(event) {
  const form=event.target;
  if (!form.id) return;
  if (form.id === 'profile-switch-form') { event.preventDefault(); switchProfile(String(new FormData(form).get('profileId')||'')); }
  else if (form.id === 'guide-search-form') { event.preventDefault(); ui.guideQuery=String(new FormData(form).get('query')||'').trim();ui.guideTarget='';render();document.getElementById('guide-query')?.focus(); }
  else if (form.id === 'profile-create-form') { event.preventDefault(); createProfile(form); }
  else if (form.id === 'search-form') { event.preventDefault(); searchNow(form); }
  else if (form.id === 'quiz-start-form') { event.preventDefault(); const data=new FormData(form); startQuiz({mode:String(data.get('mode')),chapter:String(data.get('chapter')||'all'),field:String(data.get('field')),difficulty:String(data.get('difficulty')),count:Number(data.get('count'))}); }
  else if (form.id === 'quiz-answer-form') { event.preventDefault(); submitQuizAnswer(form); }
  else if (form.id === 'mistake-note-form') { event.preventDefault(); saveMistakeNote(form); }
  else if (form.id === 'report-form') { event.preventDefault(); saveQuestionReport(form); }
  else if (form.id === 'bookmark-form') { event.preventDefault(); saveBookmark(form); }
  else if (form.id === 'reader-note-form') { event.preventDefault(); saveReaderNote(form); }
  else if (form.id === 'plan-form') { event.preventDefault(); savePlan(form); }
  else if (form.id === 'sim-form') { event.preventDefault(); }
}

function onChange(event) {
  const target=event.target;
  if(target.dataset.bookmarkNote){const b=state.bookmarks.find(b=>b.id===target.dataset.bookmarkNote);if(b){b.note=target.value;b.updatedAt=new Date().toISOString();const saved=saveState();showStatus(saved?'しおりのメモを保存しました。':'しおりのメモを端末に保存できませんでした。JSONを書き出してください。');}return;}
  if (target.name === 'choice' && ui.quiz) { ui.quiz.selected=Number(target.value);persistQuiz();saveState();render();document.querySelector(`input[name="choice"][value="${target.value}"]`)?.focus(); }
  else if (target.name === 'confidence' && ui.quiz) { ui.quiz.confidence=target.value;persistQuiz();saveState();render();document.querySelector(`input[name="confidence"][value="${target.value}"]`)?.focus(); }
  else if (target.name === 'theme') { state.settings.theme=target.value; saveState(); render(); }
  else if (target.name === 'fontScale') { state.settings.fontScale=Number(target.value); saveState(); document.documentElement.style.setProperty('--reader-scale',String(state.settings.fontScale)); const label=target.parentElement.querySelector('strong'); if(label)label.textContent=`${Math.round(state.settings.fontScale*100)}%`; }
  else if (target.name === 'lineHeight') { state.settings.lineHeight=Number(target.value); saveState(); document.documentElement.style.setProperty('--reader-line-height',String(state.settings.lineHeight)); const label=target.parentElement.querySelector('strong'); if(label)label.textContent=Number(state.settings.lineHeight).toFixed(1); }
  else if (target.dataset.reviewDate) setReviewDate(target.dataset.reviewDate,target.value);
  else if (target.dataset.date) { ui.calendarDate=target.dataset.date; render(); }
  else if (target.id === 'import-file' && target.files?.[0]) readImportFile(target.files[0]);
  else if (isCurrentSimField(target.name)) { ui.simValues[ui.simMode][target.name]=target.value; renderSimulatorOutputsOnly(); }
}
function onInput(event) {
  const target=event.target;
  if (target.id === 'glossary-query') { ui.glossaryQuery=target.value; const at=target.selectionStart; render(); const field=document.getElementById('glossary-query'); field?.focus(); field?.setSelectionRange(at,at); }
  else if (isCurrentSimField(target.name)) { ui.simValues[ui.simMode][target.name]=target.value; renderSimulatorOutputsOnly(); }
}
function isCurrentSimField(name) {
  if (!name) return false;
  if ([...transientFieldNames,'thickness','hot','cold','surface','fluid','emissivity','surrounding','hHot','hCold','k1','k2','L1','L2'].includes(name)) return true;
  const ext = extendedSims()[ui.simMode];
  // Select inputs such as the exchanger's flow arrangement are rendered by the
  // model modules outside their numeric field lists, so they are named here.
  return Boolean(ext && (ext.fieldNames.includes(name) || (ext.extraFields || []).includes(name)));
}
function renderSimulatorOutputsOnly() {
  if (ui.route !== 'simulator') return;
  const temporary=document.createElement('div'); temporary.innerHTML=renderSimulator();
  for(const block of temporary.querySelectorAll('.simulation-steps'))linkTermTextNodes(block,glossary||[]);
  const output=temporary.querySelector('.sim-output-card'); const current=document.querySelector('.sim-output-card');
  if(output&&current) current.replaceWith(output);
  const liveFigure=document.querySelector('.sim-input-card .simulation-figure');
  const newFigure=temporary.querySelector('.sim-input-card .simulation-figure');
  if(liveFigure&&newFigure)liveFigure.replaceWith(newFigure);
}

function formatHeatRate(watts) {
  if(watts===0)return '0';
  if(Math.abs(watts)<0.001||Math.abs(watts)>=1e9) {
    const [coefficient,exponent]=watts.toExponential(3).split('e');
    const superscript=Object.fromEntries([...'0123456789+-'].map((char,index)=>[char,[...'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻'][index]]));
    return `${coefficient}×10${[...String(Number(exponent))].map(char=>superscript[char]).join('')}`;
  }
  return watts.toLocaleString('ja-JP',{maximumFractionDigits:3,minimumFractionDigits:0});
}

function setReviewDate(id,day){
  if(!validDay(day)){showStatus('復習日は日付を選んでください。これまでの予定は保持しています。');return;}
  state.reviews[id]={...(state.reviews[id]||{}),dueDate:day,suggestedDays:null,updatedAt:new Date().toISOString()};
  const saved=saveState();render();showStatus(saved?`復習日を${formatDate(day)}に変更しました。`:'復習日を端末に保存できませんでした。JSONを書き出してください。');
}

function stopSpeech(announce = true) {
  speechRun++; window.speechSynthesis?.cancel();
  if(announce)showStatus('読み上げを停止しました。');
}
function speakSection() {
  const section=getSection(ui.readerSection);
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) { showStatus('このブラウザーは読み上げに対応していません。文字サイズと行間を設定から調整できます。'); return; }
  const language = state.settings.contentLanguage === 'en' && Array.isArray(section?.blocksEn) ? 'en' : 'ja';
  const blocks = language === 'en' ? section.blocksEn : section?.blocks;
  if (!blocks) { showStatus('この節にはまだ読み上げ可能な本文がありません。'); return; }
  const chunks=speechChunks(blocks);
  if(!chunks.length){showStatus('読み上げる本文がありません。');return;}
  stopSpeech(false); const run=speechRun; let index=0;
  const next=()=>{
    if(run!==speechRun)return;
    if(index>=chunks.length){showStatus('この節の読み上げが終わりました。');return;}
    const utterance=new window.SpeechSynthesisUtterance(chunks[index++]);
    utterance.lang=language==='en'?'en-US':'ja-JP';utterance.rate=0.92;
    utterance.onend=next;
    utterance.onerror=()=>{if(run===speechRun){speechRun++;showStatus('読み上げを続けられませんでした。端末の音声機能を確認してください。');}};
    try { window.speechSynthesis.speak(utterance); }
    catch { speechRun++;showStatus('読み上げを開始できませんでした。端末の音声機能を確認してください。'); }
  };
  next(); if(run===speechRun)showStatus('読み上げを開始しました。図と式は代替説明を使います。');
}

function saveBookmark(form) {
  const note=String(new FormData(form).get('note')||'').trim(),position=ui.bookmarkPosition||readerPosition();
  state.bookmarks.push({id:makeId(),sectionId:ui.readerSection,note,createdAt:new Date().toISOString(),position:position.scrollY,blockId:position.blockId,offset:position.offset,bookPage:position.bookPage,language:position.language});
  ui.bookmarkPosition=null;const saved=saveState();render();showStatus(saved?(sectionIsTranslated(getSection(ui.readerSection))?'本文の位置としおりのメモを保存しました。':'原本PDFの節としおりのメモを保存しました。'):'端末に保存できませんでした。JSONを書き出してください。');
}
function saveReaderNote(form) {
  const data=new FormData(form); const text=String(data.get('text')||'').trim();
  if(!text){showStatus('メモの本文を入力してください。');return;}
  const old=state.notes.find(n=>n.id===ui.noteEditId&&n.sectionId===ui.readerSection),title=String(data.get('title')||'').trim(),now=new Date().toISOString();
  if(old)Object.assign(old,{title,text,updatedAt:now});else state.notes.push({id:makeId(),title,text,sectionId:ui.readerSection,chapter:ui.readerSection.split('.')[0],createdAt:now,updatedAt:now});
  ui.noteEditId=null;
  const saved=saveState(); render(); showStatus(saved?'学習メモを保存しました。':'学習メモを端末に保存できませんでした。JSONを書き出してください。');
}
function saveMistakeNote(form) {
  const questionId=ui.quiz?.ids[ui.quiz.index]; if(!questionId)return;
  const data=new FormData(form);
  state.mistakeNotes[questionId]={reason:String(data.get('reason')||'').trim(),memory:String(data.get('memory')||'').trim(),nextTime:String(data.get('nextTime')||'').trim(),updatedAt:new Date().toISOString()};
  const saved=saveState(); render(); showStatus(saved?'間違いノートを保存しました。':'間違いノートを端末に保存できませんでした。JSONを書き出してください。');
}
function saveQuestionReport(form) {
  const id=ui.reportId; if(!id)return;
  const data=new FormData(form); const report={category:String(data.get('category')),message:String(data.get('message')||'').trim(),at:new Date().toISOString()};
  if(!report.message){showStatus('具体的な内容を入力してください。');return;}
  state.questionReports[id]=[...(state.questionReports[id]||[]),report]; const saved=saveState(); ui.reportId=null; render(); showStatus(saved?'報告をこの端末に保存しました。外部へは送信していません。':'報告を端末に保存できませんでした。外部へは送信していません。JSONを書き出してください。');
}
function savePlan(form) {
  const data=new FormData(form); const goal=String(data.get('goal')||'').trim(); const targetDate=String(data.get('targetDate')||''); const minutesPerDay=Number(data.get('minutesPerDay'));
  if(!goal){showStatus('学習目標を入力してください。');return;}
  if(targetDate && !validDay(targetDate)){showStatus('目標日は実在する日付を選んでください。現在の計画は変更していません。');return;}
  if(targetDate && targetDate<todayISO()){showStatus('目標日は今日以降の日付を選んでください。');return;}
  state.plan={goal,targetDate,minutesPerDay:Math.max(5,Math.min(60,minutesPerDay||15)),active:true,updatedAt:new Date().toISOString()}; const saved=saveState(); render(); showStatus(saved?'学習計画を保存しました。':'学習計画を端末に保存できませんでした。JSONを書き出してください。');
}

function exportData() {
  const payload=exportPayload();
  const raw=JSON.stringify(payload,null,2);
  if(downloadJSON(raw,`heat-study-ja-${todayISO()}.json`))showStatus('JSONの書き出しを開始しました。ブラウザーのダウンロードを確認してください。');
  else offerManualExport(raw);
}
function renderExportPreview() {
  return `<button class="button secondary" type="button" data-action="export-preview">JSON内容を表示する</button>${ui.exportJSON ? `<div class="export-preview"><label for="export-json">書き出すデータ（外部には送信しません）</label><textarea id="export-json" rows="10" readonly>${escapeHTML(ui.exportJSON)}</textarea><button class="text-button" type="button" data-action="select-export">全文を選択</button><p class="small-note">ダウンロードを利用できない場合は、全文をコピーし、テキストエディターでUTF-8の.jsonファイルとして保存できます。読み取れなかった元データはJSON形式として壊れている場合があります。</p></div>` : ''}`;
}
function offerManualExport(raw){ui.exportJSON=raw;render();document.querySelector('#export-json')?.focus();showStatus('ダウンロードを開始できませんでした。画面に表示した内容をコピーして保管してください。');}

function exportPayload() { return {...state,schemaVersion:1,exportedAt:new Date().toISOString(),format:'heat-study-ja-learning-data'}; }
function readImportFile(file) {
  if(file.size>20*1024*1024){ui.importDraft={error:'20 MB以下のJSONファイルを選んでください。現在の記録は変更していません。'};render();return;}
  const reader=new FileReader();
  reader.onload=()=>{
    try { const data=JSON.parse(String(reader.result)); const problem=validateImport(data); ui.importDraft=problem?{error:problem}:{data}; }
    catch { ui.importDraft={error:'JSONを読み取れませんでした。UTF-8形式の学習データを選んでください。'}; }
    render();
  };
  reader.onerror=()=>{ui.importDraft={error:'選択したファイルを読み込めませんでした。'};render();};
  reader.readAsText(file,'UTF-8');
}
function validateImport(data) { return validateLearningData(data); }
function importData(replace) {
  if (!ui.importDraft?.data) return;
  const data=ui.importDraft.data, problem=validateImport(data);
  if(problem) { ui.importDraft={error:problem}; render(); return; }
  if(replace && !window.confirm('この端末の学習記録を、選択したファイルの内容に置き換えます。現在の記録は復元前の控えとして保管します。続けますか？')) return;
  const next=replace ? normalizeLearningData(data) : mergeLearningData(state,data);
  const combinedProblem=validateLearningData({...next,format:'heat-study-ja-learning-data'});
  if(combinedProblem){
    ui.importDraft={error:`取り込み後の記録が保存可能な形式・件数の範囲を超えるため、中止しました。${combinedProblem}必要な記録をJSONで書き出し、別の利用者として分けてください。`};
    render();return;
  }
  const backupKey=`${STORAGE_KEY}:before-import`;
  let priorBackup=null, backupWritten=false, backupRollbackFailed=false;
  try {
    const previous=localStorage.getItem(STORAGE_KEY);
    if(previous!==lastSavedRaw){ui.importDraft={error:'別のタブで学習記録が更新されたため、復元を中止しました。現在の記録は変更していません。再読み込みしてから取り込み直してください。'};render();return;}
    priorBackup=localStorage.getItem(backupKey);
    if(previous){localStorage.setItem(backupKey,previous);backupWritten=true;}
    const raw=JSON.stringify(next);
    localStorage.setItem(STORAGE_KEY,raw);
    lastSavedRaw=raw;
  } catch {
    if(backupWritten)try{if(priorBackup===null)localStorage.removeItem(backupKey);else localStorage.setItem(backupKey,priorBackup);}catch{backupRollbackFailed=true;}
    ui.importDraft={error:`端末に保存できないため復元を中止しました。現在の記録は変更していません。先にJSONを書き出し、空き容量を確認してください。${backupRollbackFailed?'復元前の控えも変更された可能性があります。控えを確認してください。':''}`};
    render(); return;
  }
  state=next; storageIssue=''; storageBlocked=false; storageConflict=false; ui.importDraft=null;ui.quiz=null;ui.quizResult=null;render();
  showStatus(replace?'学習データを復元しました。復元前の控えも端末内に保存しました。':'既存の履歴を保持して学習データを追加しました。');
}
function mergeById(existing,incoming) { const map=new Map(); for(const item of [...existing,...incoming]) map.set(item.id||JSON.stringify(item),item); return [...map.values()]; }

function onKeyDown(event) {
  if(ui.termId){
    if(event.key==='Escape'){event.preventDefault();closeTermSheet();return;}
    if(event.key==='Tab'){
      const items=[...document.querySelectorAll('#term-overlay button,#term-overlay a[href]')].filter(item=>!item.disabled);
      if(items.length){const first=items[0],last=items.at(-1);if((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();(event.shiftKey?last:first).focus();}}
    }
    return;
  }
  const trigger=event.target?.closest?.('[data-term-id]');
  if(trigger&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openTermSheet(trigger.dataset.termId,trigger);return;}
  if(ui.pendingQuizStart){
    if(event.key==='Escape'){event.preventDefault();cancelQuizStart();return;}
    if(event.key==='Tab'){
      const focusable=[...document.querySelectorAll('.quiz-start-modal button')].filter(el=>!el.disabled);
      const first=focusable[0],last=focusable.at(-1);
      if((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
    }
    return;
  }
  if(ui.reportId){
    if(event.key==='Escape'){event.preventDefault();closeReport();return;}
    if(event.key==='Tab'){
      const focusable=[...document.querySelectorAll('.report-modal button,.report-modal input,.report-modal select,.report-modal textarea,.report-modal a[href]')].filter(el=>!el.disabled);
      const first=focusable[0],last=focusable.at(-1);
      if((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
    }
    return;
  }
  if (ui.route !== 'quiz' || !ui.quiz || event.altKey || event.ctrlKey || event.metaKey) return;
  const target=event.target; if(target && ((target.matches('input,textarea,select,[contenteditable="true"]') && !target.matches('input[name="choice"]')) || target.isContentEditable)) return;
  if(event.key==='Enter' && target?.closest?.('button,a'))return;
  const session=ui.quiz; const answered=Boolean(session.answers[session.index]);
  if(!answered && /^[1-4]$/.test(event.key)){event.preventDefault();const position=Number(event.key)-1,question=getQuestion(session.ids[session.index]);session.selected=quizChoiceOrder(session.id,question?.id)[position];persistQuiz();saveState();render();document.querySelectorAll('.answer-choice input')[position]?.focus();}
  else if(event.key==='Enter' && !answered && session.selected!==null){event.preventDefault();document.querySelector('#quiz-answer-form')?.requestSubmit();}
}

function closeReport(){ui.reportId=null;render();document.querySelector('[data-action="open-report"]')?.focus();}

function confirmQuizStart(){const pending=ui.pendingQuizStart;ui.pendingQuizStart=null;if(pending)startQuiz({...pending,replaceDraft:true});}
function cancelQuizStart(){ui.pendingQuizStart=null;render();showStatus('新しいセットの開始をやめました。中断した演習はそのまま残っています。');focusPageHeading();}
function forceSave(){
  if(storageBlocked){showStatus('保存済みデータを読み取れなかったため、上書き保存はできません。元データを書き出して確認してください。');return;}
  try{lastSavedRaw=localStorage.getItem(STORAGE_KEY);}catch{showStatus('保存状態を確認できませんでした。JSONを書き出してください。');return;}
  storageConflict=false;
  const saved=saveState();
  render();
  showStatus(saved?'このタブの内容で上書き保存しました。':'上書き保存できませんでした。JSONを書き出してください。');
}

function reviewStatusLabel(status) {
  return ({source_checked:'原本照合済み（作業者）',needs_review:'確認中',reviewed:'確認済み',draft:'下書き'})[status] || String(status || '確認中');
}
function downloadJSON(text, filename) {
  let url,link;
  try{
    url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();
    setTimeout(()=>{link.remove();URL.revokeObjectURL(url);},30000);
    return true;
  }catch{
    link?.remove();if(url)try{URL.revokeObjectURL(url);}catch{/* The failed download does not depend on revocation. */}
    return false;
  }
}

startApp();
