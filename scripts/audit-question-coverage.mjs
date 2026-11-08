// Evidence accounting, not a physics oracle. Status labels never prove a
// calculation. Receipts must identify the current semantic content exactly.
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const semanticKeys=['id','revision','prompt','choices','answer','explanation','distractors','hints','solutionSteps','source','figure'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function questionEvidenceHash(question){
  const content=Object.fromEntries(semanticKeys.map(key=>[key,question[key]??null]));
  return createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
}
export function questionCoverage(questions,peerClaims=[],receipts=[]){
  const byId=new Map(questions.map(q=>[q.id,q]));
  if(byId.size!==questions.length)throw Error('Duplicate question IDs');
  const peerSet=new Set(peerClaims),unknownPeerIds=[...peerSet].filter(id=>!byId.has(id));
  const receiptById=new Map(),invalidReceipts=[];
  for(const receipt of receipts){
    const question=byId.get(receipt.id);
    const valid=question && receipt.content_sha256===questionEvidenceHash(question)
      && Number.isInteger(receipt.independent_choice_index)
      && receipt.independent_choice_index===question.answer
      && typeof receipt.working==='string' && receipt.working.trim();
    if(!valid){invalidReceipts.push(receipt.id);continue;}
    if(receiptById.has(receipt.id))throw Error('Duplicate receipt: '+receipt.id);
    receiptById.set(receipt.id,receipt);
  }
  const rows=questions.map(q=>({
    id:q.id,revision:q.revision??'initial',content_sha256:questionEvidenceHash(q),
    reviewStatus:q.reviewStatus??null,
    label_mentions_independent:/独立|別式/.test(q.reviewStatus||''),
    muse_round2_claim:peerSet.has(q.id),
    codex_current_content_receipt:receiptById.has(q.id),
    evidence_state:receiptById.has(q.id)?'content-pinned working recorded':peerSet.has(q.id)?'peer claim; current-content working not attached':'no content-pinned working attached'
  }));
  const outsidePeer=rows.filter(row=>!row.muse_round2_claim);
  return {total:rows.length,peer_claimed:peerSet.size,unknown_peer_ids:unknownPeerIds,
    current_content_receipts:receiptById.size,invalid_receipts:invalidReceipts,
    complement_of_peer:outsidePeer.length,
    complement_label_mentions_independent:outsidePeer.filter(row=>row.label_mentions_independent).length,
    complement_with_receipts:outsidePeer.filter(row=>row.codex_current_content_receipt).length,
    complement_without_receipts:outsidePeer.filter(row=>!row.codex_current_content_receipt).length,
    unlinked_current_content:rows.filter(row=>!row.codex_current_content_receipt).length,
    all_working_linked:rows.length>0&&receiptById.size===rows.length&&unknownPeerIds.length===0&&invalidReceipts.length===0,
    limitation:'A receipt links recorded work to content; its physical reasoning still requires review. Neither status wording nor peer ID-only claims count as content-pinned proof. Historical R1=376 has no recoverable ID set and is not added.',rows};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url));
  const questions=JSON.parse(await readFile(root+'data/questions.json','utf8'));
  const claims=[];
  for(const name of (await readdir(root+'docs/audit-round2/results')).filter(n=>/^chunk-\d+\.json$/.test(n))){
    const chunk=JSON.parse(await readFile(root+'docs/audit-round2/results/'+name,'utf8'));
    claims.push(...chunk.verified,...chunk.issues.map(issue=>typeof issue==='string'?issue:issue.id));
  }
  if(new Set(claims).size!==claims.length)throw Error('Duplicate peer claim IDs');
  const receipts=JSON.parse(await readFile(root+'docs/audit/codex-round-02/evidence/independent-41.json','utf8'));
  const report=questionCoverage(questions,claims,receipts);
  console.log(JSON.stringify(report,null,2));
  if(process.argv.includes('--strict')&&!report.all_working_linked)process.exitCode=1;
}
