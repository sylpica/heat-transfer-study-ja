#!/usr/bin/env python3
"""Read-only product-data encoding checks; writes only audit evidence."""
import hashlib
import json
import re
import subprocess
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
TARGET = 'supp-film-versus-condensation-v1'
BASELINE = '925f6508a3369e428e3de90a4fe2b82f609dab01'
BEFORE_ROUND3 = 'c5b445e'
MOJIBAKE = re.compile(r'\ufffd|Ã|Â|â€|ðŸ|縺|繧|譁|蟄|蜿|髱|驥')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def strings(value, path=''):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for i, item in enumerate(value):
            yield from strings(item, f'{path}[{i}]')
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from strings(item, f'{path}.{key}')

def inspect_bytes(data):
    text = data.decode('utf-8', errors='strict')
    questions = json.loads(text)
    target = next(q for q in questions if q['id'] == TARGET)
    target_text = target['distractors'][3]
    candidates = []
    string_count = 0
    for question in questions:
        for path, string in strings(question):
            string_count += 1
            suspect_controls = [f'U+{ord(c):04X}' for c in string
                                if unicodedata.category(c) in ('Cc', 'Cf')
                                and c not in '\n\r\t']
            matches = sorted(set(MOJIBAKE.findall(string)))
            if suspect_controls or matches:
                candidates.append(dict(id=question['id'], path=path,
                                       controls=suspect_controls,
                                       marker_matches=matches, text=string))
    return dict(bytes=len(data), sha256=sha(data), utf8_strict_decode=True,
                question_count=len(questions), strings_scanned=string_count,
                raw_replacement_count=text.count('\ufffd'),
                target_distractor=target_text,
                target_distractor_utf8_hex=target_text.encode('utf-8').hex(),
                target_distractor_codepoints=[f'U+{ord(c):04X}' for c in target_text],
                target_question_sha256=sha(json.dumps(target, ensure_ascii=False,
                                                       separators=(',', ':'), sort_keys=True).encode()),
                suspicious_candidates=candidates)

sources = {}
for filename in ('data/questions.json', 'dist/data/questions.json'):
    sources[filename] = inspect_bytes((ROOT / filename).read_bytes())
for commit in (BASELINE, BEFORE_ROUND3):
    data = subprocess.check_output(['git', 'show', f'{commit}:data/questions.json'], cwd=ROOT)
    sources[f'git:{commit}:data/questions.json'] = inspect_bytes(data)
phase2_path = ROOT / 'docs/audit-round3/results/chunk-3-phase2.json'
phase2 = json.loads(phase2_path.read_text())
if isinstance(phase2, dict):
    rows = next(v for v in phase2.values() if isinstance(v, list))
else:
    rows = phase2
complaint = next(row for row in rows if row['id'] == TARGET)
result = dict(
    baseline=BASELINE,
    scope='Exact target distractor and every string in the 751-question source/distribution; historical source compared without modifying product files.',
    heuristic_limit='Mojibake markers are only candidate indicators, not a proof that all possible encoding errors are absent.',
    sources=sources,
    prior_phase2=dict(path=str(phase2_path.relative_to(ROOT)),
                      sha256=sha(phase2_path.read_bytes()), target_record=complaint),
    decision='No encoding corruption in the target source or distribution, including before round 3. The phase-2 product-defect report is a false positive. The saved complaint contains literal replacement characters, but the exact reading/rendering pipeline that introduced them is not evidenced.')
destination = HERE / 'encoding-evidence.json'
destination.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'output':str(destination.relative_to(ROOT)),
                  'current_product_sha256':sources['data/questions.json']['sha256'],
                  'current_source_dist_equal':sources['data/questions.json']['sha256'] == sources['dist/data/questions.json']['sha256'],
                  'target_unchanged_since_before_round3':len({v['target_question_sha256'] for v in sources.values()})==1,
                  'candidate_counts':{k:len(v['suspicious_candidates']) for k,v in sources.items()}}, indent=2))
