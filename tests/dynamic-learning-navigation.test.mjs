import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync,existsSync} from 'node:fs';import {join,dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
// Phase 5 inventory small fix (2026-11-07): the channel and radiation lab pages
// linked back to the glossary and static guides but not to their textbook
// sections, although the reader links those sections to them (7.2 -> channel,
// 10.1/10.3 -> radiation). The fin learning page also lacked the quiz link its
// sibling learning pages have. These tests pin the completed two-way routes.
test('channel lab page links back to its textbook section 7.2',()=>{
 const html=read('dynamic/channel.html');
 assert.ok(html.includes('href="../index.html#reader/7.2"'),'channel.html must link to §7.2');
});
test('radiation lab page links back to its textbook sections 10.1 and 10.3',()=>{
 const html=read('dynamic/radiation.html');
 assert.ok(html.includes('href="../index.html#reader/10.1"'),'radiation.html must link to §10.1');
 assert.ok(html.includes('href="../index.html#reader/10.3"'),'radiation.html must link to §10.3');
});
test('fin learning page links to the quiz view like its sibling learning pages',()=>{
 const html=read('dynamic/fin-learning.html');
 assert.ok(html.includes('href="../index.html#quiz"'),'fin-learning.html must link to the quiz');
});
test('lesson anchors used by the lab pages exist in the book data',()=>{
 const book=JSON.parse(read('data/book.json'));const ids=new Set();
 const walk=o=>{if(Array.isArray(o))o.forEach(walk);else if(o&&typeof o==='object'){if(typeof o.id==='string')ids.add(o.id);Object.values(o).forEach(walk);}};
 walk(book);
 for(const id of ['7.2','10.1','10.3','4.5','5.3','5.4','5.5'])assert.ok(ids.has(id),`book data must contain section ${id}`);
});
test('every internal file reference in the dynamic pages resolves to a real file',()=>{
 const pages=[...readdirSync(join(root,'dynamic')).filter(f=>f.endsWith('.html')).map(f=>join('dynamic',f)),
  ...readdirSync(join(root,'dynamic/dev')).filter(f=>f.endsWith('.html')).map(f=>join('dynamic/dev',f))];
 const missing=[];
 for(const page of pages){
  const html=read(page);
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   const ref=m[1];if(ref.startsWith('http')||ref.startsWith('data:')||ref.startsWith('#'))continue;
   const path=ref.split('#')[0].split('?')[0];if(!path)continue;
   if(!existsSync(resolve(root,dirname(page),path)))missing.push(`${page} -> ${ref}`);
  }
 }
 assert.deepEqual(missing,[]);
});
