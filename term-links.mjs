// Static, local, original terminology. No network service and no HTML in dataset text.
const escapeText=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Math notation conversion for ALREADY-ESCAPED text. The corpus authors
// sub/superscripts in plain notation (_x, _{...}, _(…), ^x, ^{...}, ^(…))
// alongside Unicode sub/superscripts; before 2026-11-12 only the quiz path
// converted a narrow subset, so the reader and glossary showed raw "_"/"^"
// characters. URLs are left untouched so a "_" inside a link stays literal.
// Overlines arrive as combining U+0304/U+0305 after a letter and become a
// styled span so the mark cannot clip against the line box.
const mathUrlPattern=/(https?:\/\/[^\s<]+)/g;
function convertMathSegment(t){
  return t
    .replace(/((?:\p{L}[\u0304\u0305])+)/gu,s=>`<span class="math-overline">${s.replace(/[\u0304\u0305]/g,'')}</span>`)
    .replace(/_\{([^}]+)\}/g,'<sub>$1</sub>')
    .replace(/\^\{([^}]+)\}/g,'<sup>$1</sup>')
    .replace(/_\(([\p{L}\p{N}∞+−\-.\/=, ]+)\)/gu,'<sub>$1</sub>')
    .replace(/\^\(([\p{L}\p{N}∞+−\-.\/=, ]+)\)/gu,'<sup>$1</sup>')
    .replace(/_([A-ZΑ-Ω][A-ZΑ-Ω0-9]*(?:,[A-Za-zΑ-Ωα-ω0-9∞]+)*|[a-zα-ω0-9∞]+(?:,[A-Za-zΑ-Ωα-ω0-9∞]+)*)/gu,'<sub>$1</sub>')
    .replace(/\^([−\-]?[0-9]+(?:\.[0-9]+)?|[\p{L}\p{No}∞])/gu,'<sup>$1</sup>');
}
export function formatMathText(escaped){
  const text=String(escaped??'');
  if(!/[_^\u0304\u0305]/.test(text))return text;
  return text.split(mathUrlPattern).map((part,i)=>i%2===1?part:convertMathSegment(part)).join('');
}
const mathText=value=>formatMathText(escapeText(value));
const ambiguous=new Set(['熱','W','J','K','℃','m','s','比','流れ','密度','傾き']);
const latin=/[A-Za-z0-9_]/;

// The lead is already displayed immediately above this block. Equality
// leaves no additional text; retaining it would repeat the full definition.
export function withoutRepeatedLead(text, lead) {
  if (typeof text !== 'string' || typeof lead !== 'string' || !lead || !text.startsWith(lead)) return text;
  return text.slice(lead.length).replace(/^[\s　]+/, '');
}
// Japanese labels have no word boundaries, so a label that is merely the head
// of a longer, different compound must not be linked: 比熱 inside 比熱比
// (specific-heat ratio, a distinct quantity) or 対流 inside 対流圏
// (troposphere) misleads the learner. A blanket "next character is kanji"
// exclusion was measured against the shipped corpus and rejected: it would
// have removed 2,152 of 17,905 legitimate links (黒体放射, 対流境界層,
// 非定常伝導, …) where linking the head term is semantically correct. Only
// compounds whose meaning actually diverges from the head label are listed.
const falseCompounds=['比熱比','対流圏'];
const shortLabels=new Set(['比熱','積分','対流','黒体','潜熱','顕熱','層流','乱流','向流','並流','射度',
  // Two-character labels added 2026-11-07 after a full-corpus false-link
  // measurement (questions, glossary, all 76 section texts, notes, deep
  // lessons, guide): every shipped occurrence of 蒸発 (261), 液滴 (103),
  // 管群 (38) and its alias 管束 (22) denotes the term itself or a direct
  // derivative (蒸発潜熱・蒸発部・蒸発器, 液滴飛散・液滴分布, 管群相関), with
  // no divergent compound (蒸発散 does not occur). 濡れ was measured and
  // deliberately NOT added: of its 205 occurrences, 濡れ縁 (wetted
  // perimeter, the hydraulic-diameter context) and 濡れた断面・閉流路
  // (wetted cross-section) account for a large share and belong to a
  // different concept than the wetting entry, so auto-linking it would
  // systematically mislead. It stays reachable via glossary browsing,
  // search and deep links.
  '蒸発','液滴','管群','管束',
  'bi','fo','re','pr','nu','ra','gr','sc','sh','pe']);
export function termCandidates(terms){
  if(!Array.isArray(terms))return [];
  const indexed=new Map();
  for(const term of terms){
    if(!term||!term.id||!term.ja||term.availableInApp===false)continue;
    for(const label of [term.ja,...(Array.isArray(term.aliases)?term.aliases:[]),term.en]){
      if(typeof label!=='string'||!label.trim()||label.length<2||ambiguous.has(label)||/^[^\p{L}\p{N}]+$/u.test(label))continue;
      if(label.length<3&&!shortLabels.has(label.toLocaleLowerCase()))continue;
      const key=label.toLocaleLowerCase();
      if(!indexed.has(key))indexed.set(key,{label,id:term.id});
    }
  }
  return [...indexed.values()].sort((a,b)=>b.label.length-a.label.length||a.id.localeCompare(b.id));
}
export function matchTerms(input,terms,maxMatches=4){
  const text=String(input??'');
  if(!text||!Number.isInteger(maxMatches)||maxMatches<1)return [];
  return compiledMatches(text,compileTerms(terms),maxMatches);
}
const compileTerms=terms=>termCandidates(terms).map(item=>({...item,key:item.label.toLocaleLowerCase()}));
function compiledMatches(text,candidates,maxMatches){
  const matches=[],folded=text.toLocaleLowerCase();
  let cursor=0;
  // Most labels are Japanese or ASCII. Searching each prepared label once per
  // match avoids locale conversion for every label at every character position.
  // Preserve original offsets even for rare case folds that change text length.
  const stable=folded.length===text.length;
  while(cursor<text.length&&matches.length<maxMatches){
    let found=null,at=text.length;
    for(const item of candidates){
      let index=stable?folded.indexOf(item.key,cursor):-1;
      if(!stable){
        for(let i=cursor;i<text.length;i++)if(text.slice(i,i+item.label.length).toLocaleLowerCase()===item.key){index=i;break;}
      }
      while(index>=0&&index<at){
        const stop=index+item.label.length;
        let valid=true;
      if(/^[A-Za-z]/.test(item.label)){
          if(index>0&&latin.test(text[index-1]))valid=false;
          if(text[stop]&&latin.test(text[stop]))valid=false;
        }else if(falseCompounds.some(compound=>compound.length>item.label.length&&compound.startsWith(item.label)&&text.startsWith(compound,index))){
          valid=false;
        }
        if(valid){found=item;at=index;break;}
        if(stable)index=folded.indexOf(item.key,index+1);
        else{
          let next=-1;
          for(let i=index+1;i<text.length;i++)if(text.slice(i,i+item.label.length).toLocaleLowerCase()===item.key){next=i;break;}
          index=next;
        }
      }
    }
    if(!found)break;
    matches.push({start:at,end:at+found.label.length,id:found.id,label:text.slice(at,at+found.label.length)});
    cursor=at+found.label.length;
  }
  return matches;
}
export function renderTermLinks(input,terms,{limit=4,highlights=[]}={}){
  const text=String(input??'');
  return renderMatchedText(text,matchTerms(text,terms,limit),highlights);
}
// Bulk rendering path (glossary page, search snippets): compiling the
// candidate list costs milliseconds per call, so rendering hundreds of
// texts through renderTermLinks recompiles it hundreds of times (measured
// 13 s for all 504 glossary entries' body fields). compileTermMatcher pays
// that cost once and buckets candidates by first folded character, which
// keeps per-text matching near-instant. fastMatches is a positional scan
// that returns exactly what compiledMatches returns: the earliest valid
// occurrence wins, ties at one position follow candidate order (longest
// label first), and the latin-boundary / false-compound validity rules are
// identical. Texts whose case fold changes length fall back to
// compiledMatches, like the original stable/unstable split.
export function compileTermMatcher(terms){
  const candidates=compileTerms(terms);
  const buckets=new Map();
  for(const item of candidates){
    const first=item.key[0];
    if(!buckets.has(first))buckets.set(first,[]);
    buckets.get(first).push(item);
  }
  return {candidates,buckets};
}
function fastMatches(text,matcher,maxMatches,excludeId=null){
  const folded=text.toLocaleLowerCase();
  if(folded.length!==text.length){
    const pool=excludeId?matcher.candidates.filter(item=>item.id!==excludeId):matcher.candidates;
    return compiledMatches(text,pool,maxMatches);
  }
  const matches=[];let cursor=0;
  while(cursor<text.length&&matches.length<maxMatches){
    let found=null,at=-1;
    for(let i=cursor;i<text.length;i++){
      const bucket=matcher.buckets.get(folded[i]);
      if(!bucket)continue;
      for(const item of bucket){
        if(item.id===excludeId)continue;
        if(!folded.startsWith(item.key,i))continue;
        const stop=i+item.label.length;
        let valid=true;
        if(/^[A-Za-z]/.test(item.label)){
          if(i>0&&latin.test(text[i-1]))valid=false;
          if(text[stop]&&latin.test(text[stop]))valid=false;
        }else if(falseCompounds.some(compound=>compound.length>item.label.length&&compound.startsWith(item.label)&&text.startsWith(compound,i))){
          valid=false;
        }
        if(valid){found=item;at=i;break;}
      }
      if(found)break;
    }
    if(!found)break;
    matches.push({start:at,end:at+found.label.length,id:found.id,label:text.slice(at,at+found.label.length)});
    cursor=at+found.label.length;
  }
  return matches;
}
export function renderTermLinksFast(input,matcher,{limit=4,highlights=[],excludeId=null}={}){
  const text=String(input??'');
  if(!matcher||!Number.isInteger(limit)||limit<1)return renderMatchedText(text,[],highlights);
  return renderMatchedText(text,fastMatches(text,matcher,limit,excludeId),highlights);
}
function renderMatchedText(text,hits,highlights=[]){
  const ranges=[];
  for(const [start,end] of (Array.isArray(highlights)?highlights:[])
    .filter(r=>Array.isArray(r)&&r.length===2&&r.every(Number.isInteger)&&r[0]>=0&&r[1]>r[0]&&r[1]<=text.length)
    .sort((a,b)=>a[0]-b[0])){
    if(ranges.length&&start<=ranges.at(-1)[1])ranges.at(-1)[1]=Math.max(end,ranges.at(-1)[1]);
    else ranges.push([start,end]);
  }
  // Split highlights at term boundaries without losing matches that span a term
  // and adjacent prose. All text remains escaped; math notation in the prose
  // is converted by formatMathText (term labels themselves are plain words
  // and contain no math notation).
  const slice=(start,end)=>{
    let out='',at=start;
    for(const [a,b] of ranges){
      if(b<=at||a>=end)continue;
      const left=Math.max(at,a),right=Math.min(end,b);
      out+=mathText(text.slice(at,left))+'<mark>'+mathText(text.slice(left,right))+'</mark>';
      at=right;
    }
    return out+mathText(text.slice(at,end));
  };
  let output='',cursor=0;
  for(const hit of hits){
    output+=slice(cursor,hit.start);
    // Span with role=button avoids nesting a labelable button in answer-choice labels.
    // Native delegated pointer/keyboard handling must suppress the label's radio default.
    output+=`<span role="button" tabindex="0" class="inline-term" data-term-id="${escapeText(hit.id)}" aria-label="${escapeText(hit.label)}の意味を開く" aria-haspopup="dialog">${slice(hit.start,hit.end)}</span>`;
    cursor=hit.end;
  }
  return output+slice(cursor,text.length);
}
export function linkTermTextNodes(container,terms,{limit=3,labels=false}={}){
  const doc=container?.ownerDocument;
  if(!doc||!Number.isInteger(limit)||limit<1)return;
  const walker=doc.createTreeWalker(container,4),nodes=[];
  const candidates=compileTerms(terms);
  while(walker.nextNode())nodes.push(walker.currentNode);
  const budget=new Map();
  // Label-contained text is skipped by default: a term control inside a
  // label would hijack the label's activation behaviour. The simulator
  // field labels opt in via {labels:true} because the app's delegated
  // [data-term-id] handler calls preventDefault before the label default
  // can run (the same mechanism the answer-choice labels already rely on),
  // and the control cluster (.input-unit: input, unit, select) stays
  // excluded either way.
  const skip=labels
    ?'a,button,summary,input,textarea,select,option,code,pre,svg,math,script,style,[data-term-id],.input-unit'
    :'a,button,summary,label,input,textarea,select,option,code,pre,svg,math,script,style,[data-term-id]';
  for(const node of nodes){
    const parent=node.parentElement;
    // Do not nest controls or alter editable fields, formula markup or diagrams.
    if(!parent||parent.closest(skip))continue;
    const block=parent.closest('p,li,td,dd')||parent,left=limit-(budget.get(block)||0);
    if(left<=0)continue;
    const hits=compiledMatches(node.textContent,candidates,left);
    if(!hits.length)continue;
    const template=doc.createElement('template');
    template.innerHTML=renderMatchedText(node.textContent,hits);
    node.replaceWith(template.content);budget.set(block,(budget.get(block)||0)+hits.length);
  }
}
// The same examples and navigation are available in the full glossary and the
// in-place panel. IDs are validated at public-build time; text is still escaped.
export function renderTermLearningLinks(term){
  const sections=Array.isArray(term.relatedSections)?term.relatedSections:[];
  const models={conduction:'平板伝導',convection:'対流',radiation:'放射',resistance:'直列熱抵抗',transient:'非定常冷却・加熱'};
  const simulations=(Array.isArray(term.relatedSimulators)?term.relatedSimulators:[]).filter(id=>models[id]);
  return (sections.length?`<div class="term-related"><strong>関連する節</strong>${sections.map(id=>`<button type="button" class="text-link" data-section="${escapeText(id)}">§${escapeText(id)}の教材へ →</button>`).join('')}</div>`:'')+
    (simulations.length?`<div class="term-related"><strong>関連するモデル</strong>${simulations.map(id=>`<a class="text-link" href="#guide/sim-${id}">${models[id]}の説明と計算へ →</a>`).join('')}</div>`:'');
}
export function renderTermExample(term,terms=[],matcher=null){
  if(!term.example)return '';
  // The example prose links onward to other terms (never to the term
  // itself); with no terms/matcher supplied it stays plain escaped text.
  const body=matcher?renderTermLinksFast(term.example,matcher,{limit:3,excludeId:term.id})
    :terms.length?renderTermLinks(term.example,terms.filter(item=>item.id!==term.id),{limit:3})
    :escapeText(term.example);
  return `<p class="term-example"><strong>独立作成の例：</strong>${body}</p>`;
}
export function renderTermSheet(term,terms=[]){
  const detail=term.detail||term.meaning,brief=term.brief||term.meaning;
  // Sheet prose links onward to other terms, so a learner can keep tapping
  // through the sheet itself; the term's own label is excluded to avoid a
  // self-referring control. Formula and unit stay plain (formula text is
  // an equation, and the unit line is a terse label).
  const others=terms.filter(item=>item.id!==term.id);
  const linked=value=>renderTermLinks(value,others,{limit:4});
  const related=Array.isArray(term.related)?term.related.slice(0,8):[];
  const relatedMarkup=related.map(label=>{
    const matches=terms.filter(item=>item.id!==term.id&&[item.ja,item.en,...(item.aliases||[])].includes(label));
    return matches.length===1?`<button type="button" class="inline-term" data-term-id="${escapeText(matches[0].id)}" aria-label="${escapeText(label)}の意味を開く">${escapeText(label)}</button>`:escapeText(label);
  }).join('・');
  return `<div class="modal-backdrop term-backdrop" data-term-backdrop>
    <section class="report-modal surface-card term-sheet" role="dialog" aria-modal="true" aria-labelledby="term-sheet-title" aria-describedby="term-sheet-brief" tabindex="-1">
    <button type="button" class="modal-close" data-close-term aria-label="用語の説明を閉じる">×</button>
    <p class="eyebrow">${term.source?.type==='supplement'?'補足説明':'書籍に関連する用語'} · 学習用ミニ辞典</p>
    <h2 id="term-sheet-title">${escapeText(term.ja)}</h2>
    ${term.en?`<p class="term-english" lang="en">${escapeText(term.en)}</p>`:''}
    <p id="term-sheet-brief" class="term-sheet-brief">${linked(brief)}</p>
    ${term.beginner&&term.beginner!==brief&&term.beginner!==detail?`<h3>はじめての説明</h3><p>${linked(term.beginner)}</p>`:''}
    <h3>詳しい説明</h3><p>${linked(detail)}</p>
    ${term.formula?`<p><strong>関連式：</strong> <span class="term-formula">${mathText(term.formula)}</span></p>`:''}
    ${term.unit?`<p><strong>単位：</strong> ${mathText(term.unit)}</p>`:''}
    ${renderTermExample(term,terms)}
    ${related.length?`<p><strong>関連語：</strong> ${relatedMarkup}</p>`:''}
    ${renderTermLearningLinks(term)}
    <button type="button" class="button secondary" data-term-detail="${escapeText(term.id)}">用語集で詳しく見る</button>
    </section></div>`;
}
