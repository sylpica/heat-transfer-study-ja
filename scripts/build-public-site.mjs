import {readFile,copyFile,mkdir,rm,stat,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {checkPublicContent} from '../public-content-contract.mjs';
import {publicCacheName,pdfCacheName,stampServiceWorker} from './public-cache-version.mjs';
import {GUIDE_SECTIONS} from '../guide.mjs';
import {LESSON_DIAGRAM_PATHS} from '../lesson-diagrams.mjs';

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
for(const question of questions)if(question.figure?.kind==='book')delete question.figure.src;
// Validate the actual allowlisted data after source sanitization, before writing any public files.
const glossary=JSON.parse(await readFile(join(root,'data/glossary.json'),'utf8'));
const originalNotes=JSON.parse(await readFile(join(root,'data/original-notes.json'),'utf8'));
const deepLessons=JSON.parse(await readFile(join(root,'data/original-deep-lessons.json'),'utf8'));
const issues=checkPublicContent({book,questions,glossary,guides:GUIDE_SECTIONS,originalNotes,deepLessons});
if(issues.length)throw new Error('公開教材の整合性検査に失敗しました:\n'+issues.join('\n'));

const files=['index.html','styles.css','app.js','study-core.mjs','guide.mjs','chapter-curriculum.mjs','original-notes.mjs','original-deep-lessons.mjs','transient-ui.mjs','term-links.mjs','sim-diagrams.mjs','lesson-diagrams.mjs','fin-efficiency.mjs','heat-exchanger.mjs','transient-slab.mjs','radiation-enclosure.mjs','cylindrical-insulation.mjs','semi-infinite-solid.mjs','forced-convection-flat-plate.mjs','turbulent-pipe-convection.mjs','cylinder-crossflow.mjs','natural-convection-vertical.mjs','laminar-pipe-convection.mjs','laminar-film-condensation.mjs','binary-gas-diffusion.mjs','pool-boiling-nucleate.mjs','pool-boiling-chf.mjs','sw.js','manifest.json','data/glossary.json',...LESSON_DIAGRAM_PATHS];
for(const path of new Set(files)){
  const source=join(root,path),target=join(output,path);
  await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
}
await mkdir(join(output,'data'),{recursive:true});
await mkdir(join(output,'book'),{recursive:true});
await writeFile(join(output,'book/AHTTv600.pdf'),pdf);
for(const [name,value] of Object.entries({'book.json':book,'questions.json':questions,'content-manifest.json':{files:sectionPaths.map(path=>'./'+path)},'original-notes.json':originalNotes,'original-deep-lessons.json':deepLessons})){
  await writeFile(join(output,'data',name),JSON.stringify(value,null,2)+'\n');
}
await mkdir(join(output,'data','sections'),{recursive:true});
for(const name of sectionFileNames)await copyFile(join(root,'data','sections',name),join(output,'data','sections',name));
// Every new public content revision must produce a new service-worker script.
// Otherwise an existing installation may keep old offline lessons and questions.
const publicAssets=[...new Set([...files,
  'data/book.json','data/questions.json','data/content-manifest.json',
  'data/original-notes.json','data/original-deep-lessons.json',...sectionPaths])];
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
const closure=new Set(),queue=['app.js'];
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
console.log('公開配信物：許諾済みの原本PDF、アプリ・独自ガイド・問題・用語・書籍の目次情報、および書籍の日本語訳（全76節、専門家校閲未実施）。原図は含めていません。');
