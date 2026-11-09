// Read-only independent receipt/set audit. No answers are solved by this check.
import{readFile,readdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{questionEvidenceHash}from'../../../../scripts/audit-question-coverage.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const read=async p=>JSON.parse(await readFile(root+p,'utf8'));
const questions=await read('data/questions.json'),byId=new Map(questions.map(q=>[q.id,q]));
const claims=[];for(const f of(await readdir(root+'docs/audit-round2/results')).filter(x=>/^chunk-\d+\.json$/.test(x))){const c=await read('docs/audit-round2/results/'+f);claims.push(...c.verified,...c.issues.map(x=>typeof x==='string'?x:x.id));}
const checks={};const sets={peer:new Set(claims)};
for(const[label,p]of[['codex41','docs/audit/codex-round-02/evidence/independent-41.json'],['muse289','docs/audit-round3/evidence/independent-289.json']]){
 const rs=await read(p),ids=rs.map(r=>r.id);sets[label]=new Set(ids);checks[label]={count:rs.length,unique:sets[label].size,invalid:rs.filter(r=>!byId.has(r.id)||r.content_sha256!==questionEvidenceHash(byId.get(r.id))||r.independent_choice_index!==byId.get(r.id).answer||!Number.isInteger(r.independent_choice_index)||!r.working?.trim()).map(r=>r.id)};
}
const union=new Set(Object.values(sets).flatMap(s=>[...s]));
const peerUnknown=claims.filter(id=>!byId.has(id));const uncovered=questions.filter(q=>!union.has(q.id)).map(q=>q.id);
const sampled=[];
for(const kind of ['numeric','concept']){
 const dir='docs/audit/codex-round-03/coverage/',packetBytes=await readFile(root+dir+`blind-${kind}-packet.json`),packet=JSON.parse(packetBytes),solutions=await read(dir+`blind-${kind}-solutions.json`);
 const inputHash=createHash('sha256').update(packetBytes).digest('hex');
 for(const r of solutions.results){const q=byId.get(r.id),b=packet.questions.find(q=>q.id===r.id);sampled.push({id:r.id,kind,prompt_choices_equal:!!b&&q.prompt===b.prompt&&JSON.stringify(q.choices)===JSON.stringify(b.choices),choice:r.independent_choice_index,key:q.answer,matches:r.independent_choice_index===q.answer,qualification:r.qualification??null});}
 checks[kind]={packet_sha256:inputHash,frozen_packet_sha256:solutions.input_sha256,packet_hash_matches:inputHash===solutions.input_sha256,count:solutions.results.length,key_exposure:solutions.key_exposure};
}
const result={baseline:'925f6508a3369e428e3de90a4fe2b82f609dab01',total:questions.length,unique_questions:byId.size,peer_claim_count:claims.length,peer_unique:sets.peer.size,peer_unknown:peerUnknown,checks,union:union.size,uncovered,overlaps:{peer_codex:[...sets.peer].filter(x=>sets.codex41.has(x)),muse289_prior:[...sets.muse289].filter(x=>sets.peer.has(x)||sets.codex41.has(x))},sample_size:sampled.length,sample_mismatches:sampled.filter(x=>!x.matches),sample_packet_differences:sampled.filter(x=>!x.prompt_choices_equal),sampled,limits:'751 is ID coverage of accepted audit records; sample48 is deliberately stratified, not a random error-rate estimate. Peer422 are ID-based records accepted in loop2, not 422 newly content-pinned receipts. This check does not prove every working scientifically correct.'};
await writeFile(new URL('current-coverage.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,sampled:undefined},null,2));
if(uncovered.length||peerUnknown.length||questions.length!==byId.size||claims.length!==sets.peer.size||sampled.some(x=>!x.matches||!x.prompt_choices_equal)||Object.values(checks).some(x=>x.invalid?.length||x.packet_hash_matches===false))process.exitCode=1;
