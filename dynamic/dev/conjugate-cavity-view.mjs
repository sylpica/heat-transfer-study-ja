// Canvas rendering for the conjugate-cavity development page.  The
// snapshot's temperature is ONE cell-centred field over solid+fluid
// (columns 0..solidColumns-1 are the solid slab, the rest the fluid),
// rows run from the bottom (j=0) to the top.  The drawing shows that
// single field on its true geometry: the solid occupies x in
// [-delta, 0], the fluid x in [0, 1], the interface is the column
// boundary at x=0 and is drawn as a line over the field.

export function drawConjugateField(canvas, snapshot, {range = [0, 1]} = {}) {
  const {n, solidColumns, columns} = snapshot.mesh;
  const T = snapshot.temperature;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, pad = 10;
  const plot = {
    left: pad, top: pad,
    width: W - 2 * pad, height: H - 2 * pad,
  };
  const cw = plot.width / columns, ch = plot.height / n;
  ctx.clearRect(0, 0, W, H);
  for (let j = 0; j < n; j++) {
    const y = plot.top + plot.height - (j + 1) * ch;
    for (let i = 0; i < columns; i++) {
      const a = Math.max(0, Math.min(1, (T[j * columns + i] - range[0]) / (range[1] - range[0])));
      ctx.fillStyle = `hsl(${240 * (1 - a)} 80% 43%)`;
      ctx.fillRect(plot.left + i * cw, y, cw + 0.3, ch + 0.3);
    }
  }
  // Interface at x=0 (the solid/fluid column boundary).
  const ix = plot.left + solidColumns * cw;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ix, plot.top); ctx.lineTo(ix, plot.top + plot.height); ctx.stroke();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ix, plot.top); ctx.lineTo(ix, plot.top + plot.height); ctx.stroke();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.strokeRect(plot.left, plot.top, plot.width, plot.height);
  return plot;
}
