import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-1-5-problem-solving-uncertainty.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const widthOf=(id)=>{
  const found=svg.match(new RegExp('id="'+id+'"[^>]*width="([\\d.]+)"'));
  assert.ok(found,'Missing rect '+id);
  return Number(found[1]);
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};

test('§1.5 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="1\.5"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1054"/);
  assert.match(svg,/role="img" aria-labelledby="title1-5 desc1-5"/);
  assert.match(svg,/<title id="title1-5">/);
  assert.match(svg,/<desc id="desc1-5">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('conductivity and both uncertainty evaluations recompute',()=>{
  const k=num('data-q')*num('data-l')/(num('data-area')*num('data-dt'));
  near(k,num('data-k'),1e-12);
  const rel=num('data-rel');
  const rss=Math.sqrt(4*rel*rel);
  near(rss,num('data-rss'),1e-12);
  near(k*rss,num('data-uk'),1e-12);
  const worst=4*rel;
  near(worst,num('data-worst'),1e-12);
  near(k*worst,num('data-dk-worst'),1e-12);
  assert.ok(num('data-worst')>num('data-rss'),'worst-case bound exceeds the RSS estimate');
});

test('uncertainty bars keep the 1:2 ratio of the two evaluations',()=>{
  near(widthOf('bar-worst'),2*widthOf('bar-rss'),0.01);
  near(widthOf('bar-rss')/num('data-rss'),widthOf('bar-worst')/num('data-worst'),1);
});

test('procedure steps and appendix guidance are shown',()=>{
  for(const s of ['0.50 W/(m·K)','0.050 W/(m·K)','Appendix A','Appendix B','単位'])
    assert.ok(svg.includes(s),s);
});
