// Coverage accounting after the loop-4 overall fix part 2 (56 questions had
// rationale/explanation text rewritten, which changed their content hashes
// and invalidated their previous content-pinned receipts).
//
// Counting rule (settled in loop-2 collation, used by the round-3 checker
// docs/audit-round3/check-coverage-r3.mjs): a question counts as verified
// only when a worked-solution record identifying the question ID exists from
// work done before the saved key was consulted. This checker re-validates
// EVERY receipt against the CURRENT data (content hash match, independent
// choice equals the saved key, non-empty working) and rebuilds the union:
//
//   Muse round 2 peer claims (ID set; docs/audit-round2/results/chunk-*.json)
//   + Codex round 2 receipts still valid (docs/audit/codex-round-02/evidence/independent-41.json)
//   + Muse round 3 receipts still valid (docs/audit-round3/evidence/independent-289.json)
//   + Q01 supplement receipt (docs/audit-collation/evidence/q01-revised-receipt.json)
//   + Part-2 reissue receipts (docs/audit-collation/evidence/revised-56-receipts.json)
//   + Campaign-4 reissue receipts (docs/audit-collation/evidence/campaign4-reissue-6-receipts.json)
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
const q01Receipts = JSON.parse(await readFile(root + 'docs/audit-collation/evidence/q01-revised-receipt.json', 'utf8'));
const reissueReceipts = JSON.parse(await readFile(root + 'docs/audit-collation/evidence/revised-56-receipts.json', 'utf8'));
const c4Receipts = JSON.parse(await readFile(root + 'docs/audit-collation/evidence/campaign4-reissue-6-receipts.json', 'utf8'));
const codexValid = validateReceipts(codexReceipts, 'codex round 2');
const round3Valid = validateReceipts(round3Receipts, 'Muse round 3');
const q01Valid = validateReceipts(q01Receipts, 'q01 supplement');
const reissueValid = validateReceipts(reissueReceipts, 'part-2 reissue (56)');
const c4Valid = validateReceipts(c4Receipts, 'campaign-4 reissue (6)');

const changedIds = reissueReceipts.map(r => r.id);
const changedPrior = changedIds.map(id => ({
  id,
  was_claim: claimSet.has(id),
  was_codex_receipt: codexReceipts.some(r => r.id === id),
  was_round3_receipt: round3Receipts.some(r => r.id === id),
  old_receipt_still_valid: codexValid.has(id) || round3Valid.has(id),
}));

const covered = new Set([...claimSet, ...codexValid, ...round3Valid, ...q01Valid, ...reissueValid, ...c4Valid]);
const uncovered = questions.map(q => q.id).filter(id => !covered.has(id));
console.log(JSON.stringify({
  total: questions.length,
  muse_round2_claims: claimSet.size,
  codex_round2_receipts_valid_now: codexValid.size,
  muse_round3_receipts_valid_now: round3Valid.size,
  q01_supplement_valid: q01Valid.size,
  reissue_receipts_valid: reissueValid.size,
  campaign4_reissue_valid: c4Valid.size,
  covered_union: covered.size,
  uncovered_count: uncovered.length,
  uncovered,
  changed_56_prior_coverage: changedPrior,
}, null, 2));
if (uncovered.length) process.exitCode = 1;
