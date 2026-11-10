// Read-only bounded evidence validation. No product import; same documented hash specification.
import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const fields=['id','revision','prompt','choices','answer','explanation','distractors','hints','solutionSteps','source','figure'];
const sort=x=>Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;
const hash=q=>crypto.createHash('sha256').update(JSON.stringify(sort(Object.fromEntries(fields.map(k=>[k,q[k]??null]))))).digest('hex');
const qs=read('data/questions.json'),byId=new Map(qs.map(q=>[q.id,q]));
if(byId.size!==751||qs.length!==751)throw Error('Question ID denominator changed');
const claims=fs.readdirSync('docs/audit-round2/results').filter(n=>/^chunk-\d+\.json$/.test(n)).flatMap(n=>{const c=read('docs/audit-round2/results/'+n);return [...c.verified,...c.issues.map(i=>typeof i==='string'?i:i.id)]});
if(new Set(claims).size!==claims.length||claims.some(id=>!byId.has(id)))throw Error('Invalid peer ID claims');
const sources=['docs/audit/codex-round-02/evidence/independent-41.json','docs/audit-round3/evidence/independent-289.json','docs/audit-collation/evidence/q01-revised-receipt.json','docs/audit-collation/evidence/revised-56-receipts.json'];
const pinned=new Set(),groupResults=[];
for(const source of sources){
 const receipts=read(source),seen=new Set(),invalid=[];
 for(const r of receipts){
  if(seen.has(r.id))throw Error('Duplicate within receipt group: '+r.id);seen.add(r.id);
  const q=byId.get(r.id);
  if(q&&r.content_sha256===hash(q)&&r.independent_choice_index===q.answer&&Number.isInteger(r.independent_choice_index)&&r.working?.trim())pinned.add(r.id);else invalid.push(r.id);
 }
 groupResults.push({source,total:receipts.length,valid:receipts.length-invalid.length,invalid});
}
const reissued=read(sources[3]),reissuedSet=new Set(reissued.map(r=>r.id));
if(reissued.length!==56||reissuedSet.size!==56||groupResults[3].invalid.length)throw Error('Invalid reissue group');
const before=JSON.parse(cp.execFileSync('git',['show','ccc6cc3b8e8955f0a04baf28ec655bb4e5b386c9:data/questions.json'],{encoding:'utf8',maxBuffer:15e6}));
const old=new Map(before.map(q=>[q.id,q]));
const changed=qs.filter(q=>!old.has(q.id)||hash(q)!==hash(old.get(q.id))).map(q=>q.id);
const missingReissues=changed.filter(id=>!reissuedSet.has(id));
const union=new Set([...claims,...pinned]),uncovered=qs.map(q=>q.id).filter(id=>!union.has(id));
const samples=read('docs/audit/codex-round-05/evidence/sample-working-before-key.json').map(r=>({...r,saved_key:byId.get(r.id).answer,agrees:r.choice===byId.get(r.id).answer}));
if(samples.some(r=>!r.agrees)||missingReissues.length||uncovered.length)throw Error('Coverage or sample failure');
console.log(JSON.stringify({total:qs.length,groups:groupResults,ID_only_peer_claims:claims.length,unique_current_hash_receipts:pinned.size,ID_only_without_current_hash_receipt:claims.filter(id=>!pinned.has(id)).length,covered_union:union.size,uncovered,semantic_changes_since_ccc:changed.length,changed_without_reissue:missingReissues,samples},null,2));
