// Diagram for the 3D box radiation development page: one equal-size tile
// per face (a schematic, not a to-scale drawing; dimensions live in the
// numeric table), coloured by the face temperature and labelled with the
// values the connector itself computed.  Pure markup generation, no DOM,
// so the Node suite can check the tiles against a connector snapshot.
// The sign convention (outward positive) is stated in the page's legend
// and readout, so the tile flux line omits the suffix to stay inside the
// tile; tiny fluxes use a short exponential form here only -- the readout
// below the diagram always carries the full fmt10 value.
import {BOX_FACE_DEFS, fmt10} from './box-radiation-3d-ui-config.mjs';

export const fmtTileFlux = v => v !== 0 && Math.abs(v) < 1e-5 ? v.toExponential(3) : fmt10(v);

export function temperatureColor(t, lo, hi) {
 const f = hi > lo ? Math.min(1, Math.max(0, (t - lo) / (hi - lo))) : .5;
 return `hsl(${Math.round(220 * (1 - f))} 70% 42%)`;
}

// Tiles in face order, 3 columns x 2 rows.  range is [lo, hi] in K.
// Font sizes are in viewBox units: the figure renders at ~340 px wide on
// a phone, so sizes are chosen to stay legible at that ~0.38 scale.
export function boxFaceTilesMarkup({snapshot, areas, range}) {
 const [lo, hi] = range, W = 296, H = 150, gap = 6;
 const tiles = BOX_FACE_DEFS.map((def, i) => {
  const x = (i % 3) * (W + gap), y = Math.floor(i / 3) * (H + gap);
  const t = snapshot.temperature[i], q = snapshot.faceOutwardFlux[i];
  return `<g><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" fill="${temperatureColor(t, lo, hi)}"/>`
   + `<text x="${x + 12}" y="${y + 38}" font-size="25" fill="#fff">${def.name}（${def.id}、${def.note}）</text>`
   + `<text x="${x + 12}" y="${y + 74}" font-size="25" fill="#fff">T = ${fmt10(t)} K</text>`
   + `<text x="${x + 12}" y="${y + 106}" font-size="20" fill="#fff">q″ = ${fmtTileFlux(q)} W/m²</text>`
   + `<text x="${x + 12}" y="${y + 136}" font-size="20" fill="#fff">A = ${fmt10(areas[i])} m²</text></g>`;
 }).join('');
 return `<svg viewBox="0 0 ${3 * W + 2 * gap} ${2 * H + gap}" role="img" aria-label="6面の温度と正味放射熱流束" style="display:block;width:100%;height:auto">${tiles}</svg>`;
}
