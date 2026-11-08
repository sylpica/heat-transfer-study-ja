#!/usr/bin/env python3
"""Read-only gate observations. Does not fetch, check out, build, or read audit reports.

python3 verify-preflight.py --repo /path/to/repo --output /tmp/preflight.json
Optional --instruction hashes a canonical file; it does not establish Muse agreement.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--repo', required=True)
p.add_argument('--output', required=True)
p.add_argument('--instruction')
a = p.parse_args()

def git(*args):
    return subprocess.check_output(['git', '-C', a.repo, *args], text=True).strip()

heads = {}
for line in git('ls-remote', '--heads', 'origin').splitlines():
    sha, ref = line.split('\t')
    heads[ref.removeprefix('refs/heads/')] = sha
candidate = heads['feiris/mainline-integration']
# Requires objects fetched by the operator; fail rather than silently use stale refs.
git('cat-file', '-e', candidate + '^{commit}')
paths = git('ls-tree', '-r', '--name-only', candidate).splitlines()
manifest = json.loads(git('show', candidate + ':data/content-manifest.json'))
pdf = pathlib.Path(a.repo, 'book/AHTTv600.pdf').read_bytes()
sha256 = hashlib.sha256(pdf).hexdigest()
def is_ancestor(sha):
    result = subprocess.run(['git', '-C', a.repo, 'merge-base', '--is-ancestor', sha, candidate], capture_output=True)
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr.decode())
    return result.returncode == 0

result = {
    'observed_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'remote_heads': heads,
    'candidate_sha': candidate,
    's0': None,
    'dynamic_head_is_ancestor': is_ancestor(heads['codex/dynamic-heat-simulation']),
    'graetz_head_is_ancestor': is_ancestor(heads['feiris/graetz-channel-2']),
    'japanese_section_path_count': sum(bool(re.fullmatch(r'data/sections/\d+-\d+-ja\.json', s)) for s in paths),
    'manifest_entry_count': len(manifest['files']),
    'radial_analysis_in_build_text': 'dynamic/radial-analysis.mjs' in git('show', candidate + ':scripts/build-public-site.mjs'),
    'tracked_dist_files': sum(s.startswith('dist/') for s in paths),
    'pdf_size': len(pdf),
    'pdf_sha256': sha256,
    'pdf_identity_matches': len(pdf) == 32472182 and sha256 == 'd318176a9cac997d415ec5ee95b30979dcdaed0392705185393735c7d59a447a',
    'canonical_instruction_sha256': hashlib.sha256(pathlib.Path(a.instruction).read_bytes()).hexdigest() if a.instruction else None,
    'gate_passed': False,
    'limits': 'Structural observations only. No semantic audit, tests, build, browser, dist, or completion approval. Non-ancestry does not exclude equivalent or cherry-picked changes.'
}
pathlib.Path(a.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: result[k] for k in ['candidate_sha', 'japanese_section_path_count', 'manifest_entry_count', 'pdf_identity_matches', 'gate_passed']}))
