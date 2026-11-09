"""Read-only scope inventory. Search candidates are NOT defect findings."""
from pathlib import Path
import json,re,csv,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).parent
sources=[ROOT/f'docs/audit/codex-round-{i:02d}/defects.csv'for i in [1,2,3]]+[ROOT/'docs/audit-round1/DEFECT_LEDGER_20261108.md',ROOT/'docs/audit-round2/DEFECT_LEDGER_R2_20261108.md',ROOT/'docs/audit-round3/DEFECT_LEDGER_R3_20261109.md']+[ROOT/f'docs/audit-collation/USAGE_STRESS_LOOP{i}_{"20261108" if i==1 else "20261109"}.md'for i in [1,2,3]]
pattern=re.compile(r'(?<![A-Za-z0-9-])(?:C[123]-(?:[A-Z]+-?)?\d{2}|R[123]-P[0123]-\d{2}|R[23]-\d{2}|R3-OBS-\d{2}|A5-(?:L\d+-)?F\d{2}|L\d-\d{1,2})(?![A-Za-z0-9-])')
records={};source_bytes={};source_locations={}
for path in sources:
 rel=str(path.relative_to(ROOT))
 if path.exists():raw=path.read_bytes();location='working-tree:'+rel
 else:raw=subprocess.check_output(['git','show','b3a582600cd648c9adfeedbb0167d8322cfa752c:'+rel],cwd=ROOT);location='git:b3a582600cd648c9adfeedbb0167d8322cfa752c:'+rel
 source_bytes[rel]=raw;source_locations[rel]=location;text=raw.decode('utf-8')
 for m in pattern.finditer(text):
  id=m.group();row=records.setdefault(id,{'id':id,'sources':[],'context':text[max(0,text.rfind('\n',0,m.start())+1):min(len(text),text.find('\n',m.end())if '\n' in text[m.end():]else len(text))][:360],'expanded_reaudit':'Round5 pending; review original disposition first, do not treat every reference as an accepted defect or reopen a settled non-finding without evidence.'})
  if rel not in row['sources']:row['sources'].append(rel)
(OUT/'historical-scope-index.json').write_text(json.dumps({'source_documents':[str(p.relative_to(ROOT))for p in sources],'source_document_hashes':{rel:hashlib.sha256(raw).hexdigest()for rel,raw in source_bytes.items()},'source_locations':source_locations,'unique_reference_ids':len(records),'counting':'Unique reference IDs, aliases not collapsed. Contains references to withdrawals/observations; not a count of actual defects or of reaudited cases. All accepted findings must be mapped using their source decisions.','rows':sorted(records.values(),key=lambda r:r['id'])},ensure_ascii=False,indent=2)+'\n')
files=sorted((ROOT/'data/sections').glob('*.json'))+[ROOT/'data'/p for p in ['original-deep-lessons.json','original-notes.json','questions.json','glossary.json']]
def strings(x,path=''):
 if isinstance(x,str):yield path,x
 elif isinstance(x,list):
  for i,v in enumerate(x):yield from strings(v,f'{path}[{i}]')
 elif isinstance(x,dict):
  for k,v in x.items():yield from strings(v,f'{path}.{k}')
formulas=[];mean=[];powers=[]
for path in files:
 data=json.loads(path.read_text());rel=str(path.relative_to(ROOT))
 if rel.startswith('data/sections/'):
  for i,b in enumerate(data['blocks']):
   if b.get('type')=='formula':
    row={'file':rel,'block':i,'number':b.get('number'),'expression':b.get('expression'),'alt':b.get('alt'),'review':'not automatically verified'};formulas.append(row)
    rhs=b.get('expression','').split('=',1)[-1].strip()
    if rhs.startswith('[') and '/'in rhs and re.search(r'\]\^\(',rhs):powers.append(row)
 for key,s in strings(data):
  # Mean words together with an unbarred variable are candidates; local/mean comparisons are valid too.
  if '平均'in s and re.search(r'(?<![A-Za-z])(?:h|Nu[A-Za-z_]*|T|Θ)(?![\u0304\u0305])',s):
   m=re.search('平均',s);mean.append({'file':rel,'json_path':key,'excerpt':s[max(0,m.start()-50):m.start()+310],'review':'Candidate only: original definition and local/mean roles must be established before changing any symbol.'})
js=[]
for path in sorted(set(list(ROOT.glob('*.mjs'))+[ROOT/'app.js',ROOT/'guide.mjs',ROOT/'dynamic/model-manuals.mjs'])):
 if not path.is_file():continue
 for n,line in enumerate(path.read_text().splitlines(),1):
  if '平均'in line and re.search(r'\b(?:h|Nu\w*|T)\b',line):js.append({'file':str(path.relative_to(ROOT)),'line':n,'excerpt':line[max(0,line.find('平均')-50):line.find('平均')+260]})
summary={'public_json_files_scanned':len(files),'formula_blocks_indexed':len(formulas),'mean_word_candidates':len(mean),'outer_fraction_power_candidates':len(powers),'production_JS_candidate_lines':len(js),'status':'Indexes for exhaustive role/source review, not validated defects. No regex can establish the absence of missing overbars or of wrong exponent scope.'}
(OUT/'pattern-index.json').write_text(json.dumps({'summary':summary,'scanned_files':[{ 'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files],'formula_blocks':formulas,'mean_candidates':mean,'outer_fraction_power_candidates':powers,'JS_mean_candidates':js},ensure_ascii=False,indent=2)+'\n')
with(OUT/'mean-pattern-candidates.csv').open('w',newline='')as f:
 w=csv.DictWriter(f,fieldnames=['file','json_path','excerpt','review'],lineterminator='\n');w.writeheader();w.writerows(mean)
print(json.dumps({'historical_reference_ids':len(records),'source_documents':len(sources),**summary},ensure_ascii=False,indent=2))
