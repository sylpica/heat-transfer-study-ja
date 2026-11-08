// Round-3 coverage accounting for R1-P2-01, using the counting rule settled
// in loop-2 collation (docs/audit-collation/LOOP2_COLLATION_20261109.md §4):
// a question counts as worked-solution verified only when an audit record
// identifying the question ID exists for work done before the saved key was
// consulted. Status wording alone never counts; round 1's 376 has no ID map
// and is never added.
//
// Sources:
// - Muse round 2 peer claims: docs/audit-round2/results/chunk-1..8.json
// - Codex round 2 receipts:     docs/audit/codex-round-02/evidence/independent-41.json
// - Muse round 3 receipts:     docs/audit-round3/evidence/independent-289.json
//
// Every receipt is re-validated here against the CURRENT data with the same
// rules as scripts/audit-question-coverage.mjs (content hash match,
// independent choice equals the saved key, non-empty working).
import {questionEvidenceHash} from '../../scripts/audit-question-coverage.mjs';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const questions = JSON.parse(await readFile(root + 'data/questions.json', 'utf8'));
const byId = new Map(questions.map(q => [q.id, q]));
if (byId.size !== questions.length) throw Error('Duplicate question IDs');

const claims = [];
for (const name of (await readdir(root + 'docs/audit-round2/results')).filter(n => /^chunk-\d+\.json$/.test(n))) {
  const chunk = JSON.parse(await readFile(root + 'docs/audit-round2/results/' + name, 'utf8'));
  claims.push(...chunk.verified, ...chunk.issues.map(issue => typeof issue === 'string' ? issue : issue.id));
}
if (new Set(claims).size !== claims.length) throw Error('Duplicate peer claim IDs');
const claimSet = new Set(claims);

function validateReceipts(receipts, label) {
  const valid = new Set(), invalid = [];
  for (const receipt of receipts) {
    const question = byId.get(receipt.id);
    const ok = question
      && receipt.content_sha256 === questionEvidenceHash(question)
      && Number.isInteger(receipt.independent_choice_index)
      && receipt.independent_choice_index === question.answer
      && typeof receipt.working === 'string' && receipt.working.trim();
    if (ok) valid.add(receipt.id); else invalid.push(receipt.id);
  }
  console.log(`${label}: receipts ${receipts.length}, valid ${valid.size}, invalid ${JSON.stringify(invalid)}`);
  return valid;
}

const codexReceipts = JSON.parse(await readFile(root + 'docs/audit/codex-round-02/evidence/independent-41.json', 'utf8'));
const round3Receipts = JSON.parse(await readFile(root + 'docs/audit-round3/evidence/independent-289.json', 'utf8'));
const codexValid = validateReceipts(codexReceipts, 'codex round 2');
const round3Valid = validateReceipts(round3Receipts, 'Muse round 3');

const covered = new Set([...claimSet, ...codexValid, ...round3Valid]);
const uncovered = questions.map(q => q.id).filter(id => !covered.has(id));
console.log(JSON.stringify({
  total: questions.length,
  muse_round2_claims: claimSet.size,
  codex_round2_receipts_valid: codexValid.size,
  muse_round3_receipts_valid: round3Valid.size,
  covered_union: covered.size,
  uncovered_count: uncovered.length,
  uncovered: uncovered,
}, null, 2));
if (uncovered.length) process.exitCode = 1;
