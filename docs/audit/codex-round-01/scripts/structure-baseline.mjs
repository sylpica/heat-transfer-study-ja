import {fileURLToPath} from 'node:url';
const auditRoot=fileURLToPath(new URL('../../../../',import.meta.url));
const auditOut=fileURLToPath(new URL('../evidence/',import.meta.url));
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const root=auditRoot;const read=async p=>JSON.parse(await readFile(root+p,'utf8'));
const {validateQuestion}=await import(root+'study-core.mjs');const book=await read('data/book.json');const qs=await read('data/questions.json');const terms=await read('data/glossary.json');
const secs=book.chapters.flatMap(c=>c.sections); const ids=secs.map(s=>s.id); const issues=[];const files=(await read('data/content-manifest.json')).files;
let blocks=0;const translated=[];
for(const p of files){const x=await read(p.replace(/^\.\//,''));translated.push(x.sectionId);blocks+=x.blocks.length;if(!ids.includes(x.sectionId))issues.push({type:'invalid-section',file:p,id:x.sectionId});}
const invalidQuestions=qs.map(q=>({id:q.id,issue:validateQuestion(q)})).filter(x=>x.issue);
const duplicateChoices=qs.filter(q=>new Set(q.choices.map(x=>x.normalize('NFKC').trim())).size!==4).map(q=>q.id);
for(const t of terms){for(const s of t.relatedSections||[])if(!ids.includes(s))issues.push({type:'term-section',id:t.id,section:s});}
let problems=0,references=0;const problemNumbers=[];for(const f of await readdir(root+'data/chapter-problems')){const d=await read('data/chapter-problems/'+f); problems+=d.problems.blocks.filter(b=>b.type==='problem').length;references+=d.references.blocks.filter(b=>b.type==='reference').length;for(const b of d.problems.blocks)if(b.type==='problem')problemNumbers.push(b.number);}
const dist=[];async function walk(p=''){for(const f of await readdir(root+'dist/'+p,{withFileTypes:true}))f.isDirectory()?await walk(p+f.name+'/'):dist.push(p+f.name);}await walk();
const result={sectionCount:secs.length,translationFiles:files.length,uniqueTranslatedSections:new Set(translated).size,translationBlocks:blocks,questions:qs.length,terms:terms.length,chapterProblems:problems,chapterReferences:references,invalidQuestions,duplicateChoices,issues,distCount:dist.length,distDynamic:dist.filter(p=>p.startsWith('dynamic/')).length,distForbidden:dist.filter(p=>/^(dynamic\/dev\/|docs\/|tests\/)|\.map$|\.py$|\.env/.test(p))};
await writeFile(auditOut+'structure-baseline.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
