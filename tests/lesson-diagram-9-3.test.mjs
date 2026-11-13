import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../assets/lesson-diagrams/section-9-3-critical-heat-flux-liquid-vapor-counterflow.svg', import.meta.url), 'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const number = name => {
  const m = svg.match(new RegExp(`\\b${name}="([^"]+)"`));
  assert.ok(m, `missing ${name}`);
  const v = Number(m[1]);
  assert.ok(Number.isFinite(v), `invalid ${name}`);
  return v;
};
const near = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const p = {
  liquid: number('data-rho-liquid'), vapor: number('data-rho-vapor'),
  sigma: number('data-sigma'), g: number('data-gravity'),
  hfg: number('data-latent-heat'), C: number('data-correlation-coefficient'),
  Q: number('data-heat-rate'), A: number('data-area'),
  lc: number('data-capillary-length'), CHF: number('data-chf-model'),
  operating: number('data-average-operating-flux'),
  ratio: number('data-arithmetic-ratio'), margin: number('data-arithmetic-margin'),
};

test('standalone accessible SVG uses original vector artwork and dark mode', () => {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 900 1310"/);
  assert.match(svg, /role="img" aria-labelledby="chf-title chf-desc"/);
  assert.match(svg, /<title id="chf-title">/);
  assert.match(svg, /<desc id="chf-desc">/);
  assert.match(svg, /data-origin="original-app-diagram"/);
  assert.match(svg, /data-lesson="9\.3"/);
  assert.match(svg, /@media\(prefers-color-scheme:dark\)/);
  assert.match(svg, /原著図版の転載・トレース・逐文訳なし/);
  assert.doesNotMatch(svg, /<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('independent CHF correlation uses consistent positive dimensional inputs', () => {
  assert.deepEqual([p.liquid, p.vapor, p.sigma, p.g, p.hfg, p.C, p.Q, p.A],
    [950, 0.6, 0.059, 9.81, 2_200_000, .13, 160_000, .2]);
  assert.ok(p.liquid > p.vapor && p.vapor > 0 && p.sigma > 0 && p.g > 0 && p.C > 0);
  const CHF = p.C * p.hfg * Math.sqrt(p.vapor) * (p.sigma * p.g * (p.liquid - p.vapor)) ** .25;
  near(p.CHF, CHF, 1e-6);
  near(p.CHF, 1072591.1763380333, 1e-6);
  assert.ok(p.CHF > p.Q/p.A);
});

test('operation, ratio, formal arithmetic margin and capillary length are independently recalculated', () => {
  near(p.operating, p.Q / p.A);
  near(p.operating, 800_000);
  near(p.ratio, p.operating / p.CHF, 1e-11);
  near(p.margin, 1 - p.ratio, 1e-11);
  near(p.ratio, .7458573384234847, 1e-11);
  near(p.margin, .2541426615765153, 1e-11);
  near(p.lc, Math.sqrt(p.sigma / (p.g * (p.liquid - p.vapor))), 1e-10);
  near(p.lc * 1000, 2.516905376279981, 1e-9);
  assert.ok(p.margin > 0 && p.margin < 1);
});

test('two comparison bars use exactly the same zero baseline and numerical scale', () => {
  const chf = svg.match(/<rect id="chf-model-bar" class="chfBar" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/);
  const op = svg.match(/<rect id="operating-heat-flux-bar" class="opBar" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/);
  assert.ok(chf && op);
  near(+chf[1], +op[1]);
  near(+chf[1], 161);
  near(+chf[3], number('data-chf-bar-width'));
  near(+op[3], number('data-operation-bar-width'));
  near((+op[3])/(+chf[3]), p.ratio, 1e-8);
  assert.ok(+op[3] < +chf[3]);
  assert.match(svg, /1\.073 MW\/m²/);
  assert.match(svg, /0\.800 MW\/m²/);
  assert.match(svg, /算術量 M = 1 − q_op \/ q_CHF ≈ 0\.254/);
});

test('vapor escape, liquid replenishment and critical safety boundaries remain explicit', () => {
  assert.match(svg, /id="pool-liquid"/);
  assert.match(svg, /id="heated-surface"/);
  assert.match(svg, /蒸気 ↑/);
  assert.match(svg, /液体 ↓/);
  assert.match(svg, /data-geometry="idealized-large-horizontal-pool"/);
  assert.match(svg, /data-safety-verified="false"/);
  for (const caveat of [
    '蒸気柱の形状は定性的',
    '実寸や流動様式の実測値ではない',
    '毛管長 ℓ_c ≈ 2.517 mm（泡径・蒸気柱間隔ではない）',
    '実際の面・圧力・局所乾き・制御条件は未検証',
    '平均熱流束がCHF相関値より低くても安全を保証しない',
    'これは安全率・設計許容値を意味しない',
  ]) assert.ok(svg.includes(caveat), `missing caveat: ${caveat}`);
  assert.doesNotMatch(svg, /安全余裕.*25\.4\s*%/);
});
