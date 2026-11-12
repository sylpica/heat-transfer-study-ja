import {readFile,copyFile,mkdir,rm,stat,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {checkPublicContent} from '../public-content-contract.mjs';
import {publicCacheName,pdfCacheName,stampServiceWorker} from './public-cache-version.mjs';
import {GUIDE_SECTIONS} from '../guide.mjs';
import {LESSON_DIAGRAM_PATHS} from '../lesson-diagrams.mjs';
import {buildPublicWorker} from './public-worker-bundle.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'dist');
const marker=join(output,'.public-site-build');
try { await stat(output); await stat(marker); await rm(output,{recursive:true,force:true}); }
catch(error) { if(error.code!=='ENOENT')throw error; try { await stat(output); throw new Error('出力先に既存のファイルがあります。公開ビルドによる上書きを中止しました。'); } catch(inner) { if(inner.code!=='ENOENT')throw inner; } }

const book=JSON.parse(await readFile(join(root,'data/book.json'),'utf8'));
const questions=JSON.parse(await readFile(join(root,'data/questions.json'),'utf8'));
const pdf=await readFile(join(root,'book/AHTTv600.pdf'));
const pdfHash=createHash('sha256').update(pdf).digest('hex');
if(pdf.length!==32472182||pdfHash!=='d318176a9cac997d415ec5ee95b30979dcdaed0392705185393735c7d59a447a')throw new Error('原本PDFのサイズまたはSHA-256が引き継ぎ記録と一致しません。');
if(!Array.isArray(book.chapters)||!Array.isArray(questions))throw new Error('公開用データの形式を確認してください。');
// book.json itself never carries extracted paragraphs or standalone book figures.
// The Japanese translation ships as separate per-section files under data/sections/
// (owner decision of 2026-11-04, recorded in LICENSE-BOOK.md); original figures are omitted.
for(const chapter of book.chapters)for(const section of chapter.sections){
  section.translationStatus='translated';
  delete section.blocks;delete section.blocksEn;delete section.figures;delete section.sourceReview;
}
// Collect the bundled translation files so the reader can load them via the content manifest.
const sectionFileNames=(await readdir(join(root,'data','sections'))).filter(name=>name.endsWith('.json')).sort();
if(sectionFileNames.length!==76)throw new Error('日本語訳の節ファイルが76件そろっていません: '+sectionFileNames.length);
const sectionPaths=sectionFileNames.map(name=>'data/sections/'+name);
for(const name of sectionFileNames){
  const parsed=JSON.parse(await readFile(join(root,'data','sections',name),'utf8'));
  if(!parsed||parsed.language!=='ja'||!Array.isArray(parsed.blocks)||!parsed.blocks.length)throw new Error('日本語訳ファイルの形式を確認してください: '+name);
}
// Chapter-end problems and references are separate data from the sections:
// the reader fetches one chapter file on demand, so they deliberately stay
// out of content-manifest.json (which lists section files only) and the
// 76-file gate above keeps its meaning as a section count.
const chapterProblemFileNames=(await readdir(join(root,'data','chapter-problems'))).filter(name=>/^chapter-\d{2}\.json$/.test(name)).sort();
if(chapterProblemFileNames.length!==11)throw new Error('章末問題・参考文献のファイルが11件そろっていません: '+chapterProblemFileNames.length);
const chapterProblemPaths=chapterProblemFileNames.map(name=>'data/chapter-problems/'+name);
for(const name of chapterProblemFileNames){
  const parsed=JSON.parse(await readFile(join(root,'data','chapter-problems',name),'utf8'));
  const countOf=(blocks,type)=>Array.isArray(blocks)?blocks.filter(block=>block&&block.type===type).length:-1;
  if(!parsed||parsed.language!=='ja'||parsed.chapterId!==name.replace(/\.json$/,'')
    ||countOf(parsed.problems?.blocks,'problem')!==parsed.problems?.count
    ||countOf(parsed.references?.blocks,'reference')!==parsed.references?.count)
    throw new Error('章末問題・参考文献ファイルの形式を確認してください: '+name);
}
// Appendix reference lists (Appendix A: [A.1]-[A.41], Appendix B: [B.1]) are
// separate data from the sections and the chapter files: the reader fetches
// one appendix file on demand, so they stay out of content-manifest.json and
// the 76-file gate above keeps its meaning as a section count.
const appendixReferenceFileNames=(await readdir(join(root,'data','appendix-references'))).filter(name=>/^appendix-[ab]\.json$/.test(name)).sort();
if(appendixReferenceFileNames.length!==2)throw new Error('付録参考文献のファイルが2件そろっていません: '+appendixReferenceFileNames.length);
const appendixReferencePaths=appendixReferenceFileNames.map(name=>'data/appendix-references/'+name);
for(const name of appendixReferenceFileNames){
  const parsed=JSON.parse(await readFile(join(root,'data','appendix-references',name),'utf8'));
  const blocks=parsed?.references?.blocks;
  if(!parsed||parsed.language!=='ja'||parsed.appendixId!==name.replace(/\.json$/,'')
    ||!Array.isArray(blocks)||blocks.length!==parsed.references?.count
    ||blocks.some(block=>!block||block.type!=='reference'))
    throw new Error('付録参考文献ファイルの形式を確認してください: '+name);
}
for(const question of questions)if(question.figure?.kind==='book')delete question.figure.src;
// Validate the actual allowlisted data after source sanitization, before writing any public files.
const glossary=JSON.parse(await readFile(join(root,'data/glossary.json'),'utf8'));
const originalNotes=JSON.parse(await readFile(join(root,'data/original-notes.json'),'utf8'));
const deepLessons=JSON.parse(await readFile(join(root,'data/original-deep-lessons.json'),'utf8'));
const issues=checkPublicContent({book,questions,glossary,guides:GUIDE_SECTIONS,originalNotes,deepLessons});
if(issues.length)throw new Error('公開教材の整合性検査に失敗しました:\n'+issues.join('\n'));

const files=['dynamic/lumped-radial.mjs','dynamic/surface-exchange-report.mjs','dynamic/surface-exchange.mjs','dynamic/navigation-context.mjs','dynamic/radial-learning.mjs','dynamic/radial-learning-ui.mjs','dynamic/radial.mjs','dynamic/radial.html','dynamic/radial-ui.mjs','dynamic/radial-view.mjs','dynamic/radial-analysis.mjs','dynamic/radial.css','dynamic/channel-learning.mjs','dynamic/channel-learning-ui.mjs','dynamic/developed-channel.mjs','dynamic/channel.html','dynamic/channel-ui.mjs','dynamic/trace-plot.mjs','dynamic/field-frame.mjs','dynamic/field-analysis.mjs','dynamic/field-plots.mjs','dynamic/term-panel.mjs','dynamic/experiment.mjs','dynamic/actor.mjs','dynamic/radiation-learning.mjs','dynamic/radiation-learning-ui.mjs','dynamic/radiation-network.mjs','dynamic/radiation.html','dynamic/radiation-ui.mjs','dynamic/radiation.css','dynamic/properties.mjs','dynamic/boiling.mjs','dynamic/fin-learning.mjs','dynamic/fin-learning-ui.mjs','dynamic/fin-learning.html','dynamic/fin-learning.css','dynamic/fin-view.mjs','dynamic/index.html','dynamic/lab.css','dynamic/learning-path.mjs','dynamic/learning-ui.mjs','dynamic/lab.mjs','dynamic/model-manuals.mjs','dynamic/lab-guide.mjs','dynamic/sim-guide.mjs','dynamic/model-tutorials.mjs','dynamic/geometry.mjs','dynamic/thermal.mjs','dynamic/worker-runtime.mjs','dynamic/worker.mjs','dynamic/presets.mjs','index.html','styles.css','app.js','dynamic-navigation.mjs','study-core.mjs','flashcards.mjs','guide.mjs','chapter-curriculum.mjs','original-notes.mjs','original-deep-lessons.mjs','transient-ui.mjs','term-links.mjs','sim-diagrams.mjs','lesson-diagrams.mjs','fin-efficiency.mjs','heat-exchanger.mjs','transient-slab.mjs','radiation-enclosure.mjs','cylindrical-insulation.mjs','semi-infinite-solid.mjs','forced-convection-flat-plate.mjs','turbulent-pipe-convection.mjs','cylinder-crossflow.mjs','natural-convection-vertical.mjs','laminar-pipe-convection.mjs','laminar-film-condensation.mjs','binary-gas-diffusion.mjs','pool-boiling-nucleate.mjs','pool-boiling-chf.mjs','sw.js','manifest.json','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','assets/apple-touch-icon.png','assets/icon-maskable-512.png','data/glossary.json',...LESSON_DIAGRAM_PATHS];
for(const path of new Set(files)){
  const source=join(root,path),target=join(output,path);
  await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
}
await buildPublicWorker({root,output,allowedSources:files});
await mkdir(join(output,'data'),{recursive:true});
await mkdir(join(output,'book'),{recursive:true});
await writeFile(join(output,'book/AHTTv600.pdf'),pdf);
for(const [name,value] of Object.entries({'book.json':book,'questions.json':questions,'content-manifest.json':{files:sectionPaths.map(path=>'./'+path)},'original-notes.json':originalNotes,'original-deep-lessons.json':deepLessons})){
  await writeFile(join(output,'data',name),JSON.stringify(value,null,2)+'\n');
}
await mkdir(join(output,'data','sections'),{recursive:true});
for(const name of sectionFileNames)await copyFile(join(root,'data','sections',name),join(output,'data','sections',name));
await mkdir(join(output,'data','chapter-problems'),{recursive:true});
for(const name of chapterProblemFileNames)await copyFile(join(root,'data','chapter-problems',name),join(output,'data','chapter-problems',name));
await mkdir(join(output,'data','appendix-references'),{recursive:true});
for(const name of appendixReferenceFileNames)await copyFile(join(root,'data','appendix-references',name),join(output,'data','appendix-references',name));
// Every new public content revision must produce a new service-worker script.
// Otherwise an existing installation may keep old offline lessons and questions.
const publicAssets=[...new Set([...files,
  'data/book.json','data/questions.json','data/content-manifest.json',
  'data/original-notes.json','data/original-deep-lessons.json',...sectionPaths,...chapterProblemPaths,...appendixReferencePaths])];
const cacheAssets=await Promise.all(publicAssets.map(async path=>({
  path,content:await readFile(join(output,path))
})));
const workerPath=join(output,'sw.js');
const cacheName=publicCacheName(cacheAssets,pdfHash);
await writeFile(workerPath,stampServiceWorker(await readFile(workerPath,'utf8'),cacheName,pdfCacheName(pdfHash)));
// A build that silently omits an imported module will crash for every user.
// Fail before publishing instead of relying on browsers to discover a 404.
for(const entry of files.filter(path=>/\.m?js$/.test(path))){
  const code=await readFile(join(output,entry),'utf8');
  for(const match of code.matchAll(/^\s*import\s+(?:[^;\n]*?\s+from\s+)?['"](\.[^'"]+)['"]/gm)){
    const imported=match[1];
    const target=resolve(dirname(join(output,entry)),imported);
    if(!target.startsWith(output+'/'))throw new Error('公開JSのimportが配信ディレクトリ外を参照しています: '+entry+' -> '+imported);
    try{await stat(target);}catch{throw new Error('公開JSの依存モジュールが配信ファイルから欠けています: '+entry+' -> '+imported);}
  }
}
// The precache list is the offline-start guarantee: the transitive import
// closure of the entry module must be listed in APP_SHELL, and every listed
// file must actually ship. A missing entry only surfaces on a learner's
// first offline launch, so verify it here instead.
const workerSource=await readFile(workerPath,'utf8');
const shellDefinition=workerSource.match(/const APP_SHELL=\[([\s\S]*?)\];/);
if(!shellDefinition)throw new Error('サービスワーカーのAPP_SHELL定義を確認できません。');
const appShell=new Set([...shellDefinition[1].matchAll(/'([^']+)'/g)].map(m=>m[1]));

const closure=new Set(),queue=['app.js','dynamic-navigation.mjs'];



while(queue.length){
  const current=queue.pop();
  if(closure.has(current))continue;
  closure.add(current);
  const code=await readFile(join(output,current),'utf8');
  for(const match of code.matchAll(/^\s*import\s+(?:[^;\n]*?\s+from\s+)?['"](\.[^'"]+)['"]/gm)){
    const relative=match[1].replace(/^\.\//,'');
    if(!closure.has(relative))queue.push(relative);
  }
}
for(const path of closure)if(!appShell.has('./'+path))throw new Error('サービスワーカーのAPP_SHELLに起動時依存モジュールが欠けています: '+path);
for(const entry of appShell){
  if(entry==='./')continue;
  try{await stat(join(output,entry));}catch{throw new Error('APP_SHELLの記載ファイルが配信物にありません: '+entry);}
}
await writeFile(marker,'公開対象だけを列挙して作成した配信物です。\n');
console.log('公開配信物：許諾済みの原本PDF、アプリ・独自ガイド・問題・用語・書籍の目次情報、および書籍の日本語訳（全76節と全11章の章末問題・参考文献、付録A・Bの参考文献、専門家校閲未実施）。原図は含めていません。');
