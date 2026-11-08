// Generates dynamic/model-manuals.mjs from the §21 model manuals in
// docs/dynamic/. The Markdown documents are the source of truth; this script
// converts the small Markdown subset they use (paragraphs, ### subheads,
// - / 1. lists with one nesting level, pipe tables, **bold**, `code`) into
// structured blocks that dynamic/lab.mjs renders inside the in-app #manual.
// Lead bullets 日時 and 位置づけ are document-management metadata (dates,
// branch names, commit SHAs) and are deliberately NOT carried into the app;
// the exclusion is recorded in docs/dynamic/MANUALS_INAPP_20261107.md.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ITEM_TITLES=['現象の概要','現実世界での使用例','支配方程式','記号と単位','初期条件','境界条件','数値計算法','計算過程','グラフの読み方','結果の解釈','モデルの仮定','モデルの限界','よくある誤解','関連教材','関連問題','参考文献'];
const LEAD_KEEP=new Set(['対象モデル','対象範囲','注意','状態','読み分け']);
const MANUALS=[
 {id:'transient-rectangular',file:'TRANSIENT_MANUAL_RECTANGULAR_20261107.md',name:'矩形 FVM 非定常熱伝導',screen:{href:null,label:'この画面（動的熱移動実験室）'}},
 {id:'transient-radial',file:'TRANSIENT_MANUAL_RADIAL_20261107.md',name:'円筒・球の半径方向 非定常熱伝導',screen:{href:'radial.html',label:'円筒・球の半径方向伝導の画面'}},
 {id:'transient-triangle',file:'TRANSIENT_MANUAL_TRIANGLE_20261107.md',name:'三角形系 非定常熱伝導',screen:null},
 {id:'fin-straight-tip',file:'FIN_MANUAL_STRAIGHT_TIP_20261107.md',name:'直線フィン（先端条件つき）',screen:null},
 {id:'fin-annular',file:'FIN_MANUAL_ANNULAR_20261107.md',name:'環状フィン',screen:null},
 {id:'fin-heat-sink',file:'FIN_MANUAL_HEAT_SINK_20261107.md',name:'ヒートシンク（規定 h モデル）',screen:null},
 {id:'fin-wind-h',file:'FIN_MANUAL_WIND_H_20261107.md',name:'風速から熱伝達率を求める',screen:null},
 {id:'forced-flat-plate',file:'FORCED_CONVECTION_MANUAL_FLAT_PLATE_20261107.md',name:'平板境界層（強制対流）',screen:null},
 {id:'forced-graetz-channel',file:'FORCED_CONVECTION_MANUAL_GRAETZ_CHANNEL_20261107.md',name:'Graetz チャネル流れ',screen:null},
 {id:'forced-pipe-heat-flux',file:'FORCED_CONVECTION_MANUAL_PIPE_HEAT_FLUX_20261107.md',name:'円管・一定熱流束（入口域）',screen:null},
 {id:'forced-pipe-wall-temperature',file:'FORCED_CONVECTION_MANUAL_PIPE_WALL_TEMPERATURE_20261107.md',name:'円管・一定壁温（入口域）',screen:null},
 {id:'natural-cavity',file:'NATURAL_CONVECTION_MANUAL_CAVITY_20261107.md',name:'閉キャビティ自然対流',screen:null},
 {id:'radiation-network',file:'RADIATION_MANUAL_NETWORK_20261107.md',name:'複数面の放射ネットワーク',screen:{href:'radiation.html',label:'複数面の動的放射の画面'}},
 {id:'radiation-long-duct',file:'RADIATION_MANUAL_LONG_DUCT_20261107.md',name:'長ダクト放射（自由頂点）',screen:null},
 {id:'radiation-surface-exchange',file:'RADIATION_MANUAL_SURFACE_EXCHANGE_20261107.md',name:'表面の対流＋放射 交換',screen:{href:null,label:'この画面と径方向画面の境界条件'}},
];
const joinText=(a,b)=>{
  const left=a.at(-1)||'',right=b[0]||'';
  return a+(/[A-Za-z0-9]$/.test(left)&&/^[A-Za-z0-9]/.test(right)?' ':'')+b;
};
function parseBlocks(lines,file){
  const blocks=[];let i=0;
  const fail=msg=>{throw new Error(`${file}: ${msg} (line ${i+1}: ${JSON.stringify(lines[i]??'')})`);};
  while(i<lines.length){
    const line=lines[i];
    if(!line.trim()){i++;continue;}
    if(/^</.test(line.trim())||/^\s*(`{3}|~~~)/.test(line)||/^>/.test(line.trim())||/^!\[/.test(line.trim()))fail('unsupported Markdown construct');
    const sub=line.match(/^###\s+(.*)$/);
    if(sub){blocks.push({t:'h',x:sub[1].trim()});i++;continue;}
    if(/^#{1,6}\s/.test(line))fail('unexpected heading level');
    if(line.trimStart().startsWith('|')){
      const rows=[];
      while(i<lines.length&&lines[i].trimStart().startsWith('|')){rows.push(lines[i].trim());i++;}
      const cells=r=>r.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
      if(rows.length<2||!/^[|\s:-]+$/.test(rows[1]))fail('table without separator row');
      const head=cells(rows[0]),body=rows.slice(2).map(cells);
      for(const r of body)if(r.length!==head.length)fail(`table row width ${r.length} != head ${head.length}`);
      blocks.push({t:'table',head,rows:body});continue;
    }
    if(/^\s*(?:-|\d+\.)\s+/.test(line)){
      // One list run; nesting decided by marker indent. An indented
      // non-marker line continues the deepest open item.
      const list={t:/^\s*\d+\./.test(line)?'ol':'ul',items:[]};
      const stack=[{indent:(line.match(/^\s*/)[0].length),items:list.items}];
      while(i<lines.length){
        const l=lines[i];
        if(!l.trim()){i++;break;}
        const m=l.match(/^(\s*)(?:(-)|\d+\.)\s+(.*)$/);
        if(m){
          const indent=m[1].length,text=m[3].trim();
          while(stack.length>1&&indent<stack.at(-1).indent)stack.pop();
          if(indent>stack.at(-1).indent){
            const parent=stack.at(-1).items.at(-1);
            if(!parent)fail('nested list without parent item');
            const sub={t:m[2]?'ul':'ol',items:[]};
            parent.sub=sub;stack.push({indent,items:sub.items});
          }
          stack.at(-1).items.push({x:text});i++;continue;
        }
        const indent=l.match(/^\s*/)[0].length;
        const deepest=stack.at(-1).items.at(-1);
        if(deepest&&indent>0&&!/^#{1,6}\s/.test(l)&&!l.trimStart().startsWith('|')){deepest.x=joinText(deepest.x,l.trim());i++;continue;}
        break;
      }
      blocks.push(list);continue;
    }
    // Paragraph: consecutive plain lines.
    let text=line.trim();i++;
    while(i<lines.length&&lines[i].trim()&&!/^#{1,6}\s/.test(lines[i])&&!/^\s*(?:-|\d+\.)\s+/.test(lines[i])&&!lines[i].trimStart().startsWith('|')){
      text=joinText(text,lines[i].trim());i++;
    }
    blocks.push({t:'p',x:text});
  }
  return blocks;
}
const manuals=[];
for(const spec of MANUALS){
  const raw=await readFile(resolve(root,'docs/dynamic',spec.file),'utf8');
  const lines=raw.split('\n');
  if(lines.at(-1)==='')lines.pop();
  const title=lines.find(l=>/^#\s/.test(l));
  if(!title)throw new Error(`${spec.file}: missing # title`);
  const firstItem=lines.findIndex(l=>/^##\s+1\.\s/.test(l));
  if(firstItem<0)throw new Error(`${spec.file}: missing ## 1.`);
  // Lead: bullets before item 1. Keep learner-facing bullets only.
  const lead=[];
  for(const l of lines.slice(0,firstItem)){
    const b=l.match(/^-\s+([^：:]+)[：:]\s*(.*)$/);
    if(!b)continue;
    if(LEAD_KEEP.has(b[1].trim()))lead.push({label:b[1].trim(),x:b[2].trim()});
  }
  if(!lead.length)throw new Error(`${spec.file}: no learner-facing lead bullets kept`);
  // Items: split on ## N. headings and verify the canonical §21 titles.
  const items=[];let current=null;
  for(const l of lines.slice(firstItem)){
    const m=l.match(/^##\s+(\d+)\.\s+(.*)$/);
    if(m){current={n:Number(m[1]),title:m[2].trim(),lines:[]};items.push(current);continue;}
    current.lines.push(l);
  }
  if(items.length!==16)throw new Error(`${spec.file}: expected 16 items, got ${items.length}`);
  items.forEach((item,idx)=>{
    if(item.n!==idx+1)throw new Error(`${spec.file}: item order broken at ${item.n}`);
    if(item.title!==ITEM_TITLES[idx])throw new Error(`${spec.file}: item ${item.n} title '${item.title}' != canonical '${ITEM_TITLES[idx]}'`);
    item.blocks=parseBlocks(item.lines,spec.file);delete item.lines;
    if(!item.blocks.length)throw new Error(`${spec.file}: item ${item.n} has no blocks`);
  });
  manuals.push({id:spec.id,name:spec.name,source:`docs/dynamic/${spec.file}`,screen:spec.screen,lead,items});
  const chars=items.reduce((s,it)=>s+JSON.stringify(it.blocks).length,0);
  console.log(`${spec.id}: 16 items, ${items.reduce((s,it)=>s+it.blocks.length,0)} blocks, ${chars} chars, lead ${lead.map(l=>l.label).join('/')}`);
}
const out=`// Generated by scripts/generate-model-manuals.mjs from the §21 model\n// manuals in docs/dynamic/ (the Markdown documents are the source of\n// truth). Do not edit by hand; edit the manual and regenerate.\n// Lead bullets 日時 and 位置づけ are document-management metadata and are\n// intentionally not included (see docs/dynamic/MANUALS_INAPP_20261107.md).\nexport const MODEL_MANUALS=${JSON.stringify(manuals)};\n`;
await writeFile(resolve(root,'dynamic/model-manuals.mjs'),out);
console.log(`wrote dynamic/model-manuals.mjs (${out.length} bytes, ${manuals.length} manuals)`);
