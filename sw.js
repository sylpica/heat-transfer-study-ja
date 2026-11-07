const CACHE_NAME='heat-study-ja-v13';
const PDF_CACHE_NAME='heat-study-ja-pdf-v1';
const PDF_URL='./book/AHTTv600.pdf';
const APP_SHELL=['./dynamic/lumped-radial.mjs','./dynamic/surface-exchange-report.mjs','./dynamic/surface-exchange.mjs','./dynamic/navigation-context.mjs','./dynamic/radial-learning.mjs','./dynamic/radial-learning-ui.mjs','./dynamic/radial.mjs','./dynamic/radial.html','./dynamic/radial-ui.mjs','./dynamic/radial-view.mjs','./dynamic/radial.css','./dynamic/channel-learning.mjs','./dynamic/channel-learning-ui.mjs','./dynamic/developed-channel.mjs','./dynamic/channel.html','./dynamic/channel-ui.mjs','./dynamic/trace-plot.mjs','./dynamic/field-frame.mjs','./dynamic/field-analysis.mjs','./dynamic/field-plots.mjs','./dynamic/term-panel.mjs','./dynamic/experiment.mjs','./dynamic/actor.mjs','./dynamic/radiation-learning.mjs','./dynamic/radiation-learning-ui.mjs','./dynamic/radiation-network.mjs','./dynamic/radiation.html','./dynamic/radiation-ui.mjs','./dynamic/radiation.css','./dynamic/properties.mjs','./dynamic/boiling.mjs','./dynamic/fin-learning.mjs','./dynamic/fin-learning-ui.mjs','./dynamic/fin-learning.html','./dynamic/fin-learning.css','./dynamic/fin-view.mjs','./dynamic/index.html','./dynamic/lab.css','./dynamic/learning-path.mjs','./dynamic/learning-ui.mjs','./dynamic/lab.mjs','./dynamic/geometry.mjs','./dynamic/thermal.mjs','./dynamic/worker-runtime.mjs','./dynamic/worker.mjs','./dynamic/presets.mjs','./','./index.html','./styles.css','./app.js','./dynamic-navigation.mjs','./study-core.mjs','./guide.mjs','./chapter-curriculum.mjs','./original-notes.mjs','./original-deep-lessons.mjs','./term-links.mjs','./transient-ui.mjs','./sim-diagrams.mjs','./lesson-diagrams.mjs','./fin-efficiency.mjs','./heat-exchanger.mjs','./transient-slab.mjs','./radiation-enclosure.mjs','./cylindrical-insulation.mjs','./semi-infinite-solid.mjs','./forced-convection-flat-plate.mjs','./turbulent-pipe-convection.mjs','./cylinder-crossflow.mjs','./natural-convection-vertical.mjs','./laminar-pipe-convection.mjs','./laminar-film-condensation.mjs','./binary-gas-diffusion.mjs','./pool-boiling-nucleate.mjs','./pool-boiling-chf.mjs','./manifest.json',
  './data/book.json','./data/questions.json','./data/glossary.json','./data/content-manifest.json','./data/original-notes.json','./data/original-deep-lessons.json',
  './assets/lesson-diagrams/section-1-1-heat-rate-flux-integrals.svg',
  './assets/lesson-diagrams/section-1-2-energy-balance-vs-heat-equation.svg',
  './assets/lesson-diagrams/section-1-3-three-modes-comparison.svg',
  './assets/lesson-diagrams/section-1-4-roadmap-series-resistance.svg',
  './assets/lesson-diagrams/section-1-5-problem-solving-uncertainty.svg',
  './assets/lesson-diagrams/section-2-1-heat-equation-control-volume.svg',
  './assets/lesson-diagrams/section-2-2-slab-method-linear-profile.svg',
  './assets/lesson-diagrams/section-2-3-series-parallel-thermal-resistance.svg',
  './assets/lesson-diagrams/section-2-4-cylindrical-wall-resistance.svg',
  './assets/lesson-diagrams/section-2-5-composite-wall-summary.svg',
  './assets/lesson-diagrams/section-3-1-hx-configurations-balance.svg',
  './assets/lesson-diagrams/section-3-2-counterflow-lmtd.svg',
  './assets/lesson-diagrams/section-3-3-ntu-isothermal-heat-exchanger.svg',
  './assets/lesson-diagrams/section-3-4-required-heat-transfer-area.svg',
  './assets/lesson-diagrams/section-4-1-well-posed-boundary-conditions.svg',
  './assets/lesson-diagrams/section-4-2-uniform-generation-plane-wall.svg',
  './assets/lesson-diagrams/section-4-3-bi-fo-similarity-scaling.svg',
  './assets/lesson-diagrams/section-4-4-shape-factor-scaling.svg',
  './assets/lesson-diagrams/section-4-5-adiabatic-fin-efficiency-effectiveness.svg',
  './assets/lesson-diagrams/section-5-1-time-scales-model-selection.svg',
  './assets/lesson-diagrams/section-5-2-lumped-capacitance-exponential-cooling.svg',
  './assets/lesson-diagrams/section-5-3-transient-slab-cooling.svg',
  './assets/lesson-diagrams/section-5-4-response-chart-profile-reading.svg',
  './assets/lesson-diagrams/section-5-5-one-term-eigenvalue-series.svg',
  './assets/lesson-diagrams/section-5-6-semi-infinite-error-function.svg',
  './assets/lesson-diagrams/section-5-7-steady-2d-square-series.svg',
  './assets/lesson-diagrams/section-5-8-product-solution-square-bar.svg',
  './assets/lesson-diagrams/section-6-1-velocity-thermal-boundary-layers.svg',
  './assets/lesson-diagrams/section-6-2-blasius-similarity-friction.svg',
  './assets/lesson-diagrams/section-6-3-energy-equation-integral-balance.svg',
  './assets/lesson-diagrams/section-6-4-prandtl-thickness-ratio.svg',
  './assets/lesson-diagrams/section-6-5-laminar-local-average-nusselt.svg',
  './assets/lesson-diagrams/section-6-6-reynolds-colburn-analogy.svg',
  './assets/lesson-diagrams/section-6-7-turbulent-wall-units-log-law.svg',
  './assets/lesson-diagrams/section-6-8-turbulent-gas-liquid-correlations.svg',
  './assets/lesson-diagrams/section-6-9-transition-mixed-average.svg',
  './assets/lesson-diagrams/section-7-1-rectangular-duct-hydraulic-diameter.svg',
  './assets/lesson-diagrams/section-7-2-laminar-pipe-entrance-lengths.svg',
  './assets/lesson-diagrams/section-7-3-turbulent-pipe-correlations-friction.svg',
  './assets/lesson-diagrams/section-7-4-constant-wall-temperature-ntu.svg',
  './assets/lesson-diagrams/section-7-5-square-duct-nusselt-friction.svg',
  './assets/lesson-diagrams/section-7-6-cylinder-crossflow-churchill-bernstein.svg',
  './assets/lesson-diagrams/section-7-7-correlation-uncertainty-residuals.svg',
  './assets/lesson-diagrams/section-8-1-driving-forces-richardson.svg',
  './assets/lesson-diagrams/section-8-2-film-velocity-profile.svg',
  './assets/lesson-diagrams/section-8-3-vertical-plate-boundary-layer.svg',
  './assets/lesson-diagrams/section-8-4-natural-convection-orientation.svg',
  './assets/lesson-diagrams/section-8-5-film-condensation-liquid-film.svg',
  './assets/lesson-diagrams/section-9-1-pool-boiling-curve-regimes.svg',
  './assets/lesson-diagrams/section-9-2-spherical-bubble-laplace-pressure.svg',
  './assets/lesson-diagrams/section-9-3-critical-heat-flux-liquid-vapor-counterflow.svg',
  './assets/lesson-diagrams/section-9-4-film-boiling-vapor-layer-resistance.svg',
  './assets/lesson-diagrams/section-9-5-minimum-heat-flux-berenson.svg',
  './assets/lesson-diagrams/section-9-6-transition-wetting-fraction.svg',
  './assets/lesson-diagrams/section-9-7-surface-effects-chf.svg',
  './assets/lesson-diagrams/section-9-8-kandlikar-two-branches.svg',
  './assets/lesson-diagrams/section-9-9-shear-film-stopping-condition.svg',
  './assets/lesson-diagrams/section-9-10-dropwise-droplet-cycle.svg',
  './assets/lesson-diagrams/section-9-11-heat-pipe-capillary-budget.svg',
  './assets/lesson-diagrams/section-10-1-radiosity-irradiation-balance.svg',
  './assets/lesson-diagrams/section-10-2-kirchhoff-spectral-bands.svg',
  './assets/lesson-diagrams/section-10-3-view-factor-reciprocity.svg',
  './assets/lesson-diagrams/section-10-4-gray-surface-radiation-network.svg',
  './assets/lesson-diagrams/section-10-5-gas-radiation-beer-hottel.svg',
  './assets/lesson-diagrams/section-10-6-solar-roof-balance.svg',
  './assets/lesson-diagrams/section-11-1-introduction-flux-timescale.svg',
  './assets/lesson-diagrams/section-11-2-air-composition-flux-decomposition.svg',
  './assets/lesson-diagrams/section-11-3-fick-molar-diffusion-comparison.svg',
  './assets/lesson-diagrams/section-11-4-species-balance-raoult-henry.svg',
  './assets/lesson-diagrams/section-11-5-stationary-medium-log-profile.svg',
  './assets/lesson-diagrams/section-11-6-naphthalene-sublimation-analogy.svg',
  './assets/lesson-diagrams/section-11-7-coffee-cup-wet-bulb.svg',
  './assets/lesson-diagrams/section-11-8-blowing-factor-reverse-osmosis.svg',
  './assets/lesson-diagrams/section-11-9-high-rate-heat-coefficient.svg',
  './assets/lesson-diagrams/section-11-10-transport-properties-kinetic-theory.svg',
  './assets/lesson-diagrams/section-11-11-multicomponent-chemical-potential.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('heat-study-ja-')&&k!==CACHE_NAME&&k!==PDF_CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('message',event=>{
  if(event.data?.type==='CHECK_PDF_CACHE'){
    event.waitUntil(caches.open(PDF_CACHE_NAME).then(cache=>cache.match(PDF_URL)).then(response=>event.source?.postMessage({type:'PDF_CACHE_STATUS',cached:Boolean(response)})).catch(()=>event.source?.postMessage({type:'PDF_CACHE_STATUS',cached:false,error:true})));
    return;
  }
  if(event.data?.type==='CACHE_PDF'){
    event.waitUntil((async()=>{
      try {const cache=await caches.open(PDF_CACHE_NAME);if(!await cache.match(PDF_URL))await cache.add(PDF_URL);event.source?.postMessage({type:'PDF_CACHE_RESULT',ok:true});}
      catch {event.source?.postMessage({type:'PDF_CACHE_RESULT',ok:false});}
    })());return;
  }
  if(event.data?.type!=='CACHE_CONTENT'||!Array.isArray(event.data.urls))return;
  const urls=[...new Set(event.data.urls)].filter(p=>typeof p==='string'&&p.startsWith('./data/')&&!p.includes('..')&&!/[?#]/.test(p)).slice(0,500);
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(urls)).then(()=>event.source?.postMessage({type:'CONTENT_CACHE_RESULT',ok:true})).catch(()=>event.source?.postMessage({type:'CONTENT_CACHE_RESULT',ok:false})));
});
async function cachedPdfRange(response,rangeHeader){
  // Avoid expanding 32 MB into a Uint8Array for every small PDF range.
  const blob=await response.blob(); const length=blob.size;
  const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader||'');
  if(!match)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${length}`}});
  let start=match[1]===''?null:Number(match[1]);
  let end=match[2]===''?null:Number(match[2]);
  if(start===null&&end!==null){start=Math.max(0,length-end);end=length-1;}
  else if(start!==null&&end===null)end=length-1;
  if(start===null||end===null||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=length||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${length}`}});
  end=Math.min(end,length-1);
  const slice=blob.slice(start,end+1,'application/pdf');
  return new Response(slice,{status:206,headers:{'Content-Type':'application/pdf','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${length}`,'Content-Length':String(slice.size)}});
}
async function dynamicNavigationShell(cache,request){
  if(request.mode!=='navigate')return null;
  const scope=new URL('./',self.location.href),url=new URL(request.url),pages=['dynamic/fin-learning.html','dynamic/radial.html','dynamic/index.html','dynamic/radiation.html','dynamic/channel.html'];
  if(url.pathname===new URL('dynamic/',scope).pathname)return cache.match(new URL('dynamic/index.html',scope).href);
  const page=pages.find(p=>url.pathname===new URL(p,scope).pathname);return page?cache.match(new URL(page,scope).href):null;
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const isPdf=new URL(event.request.url).pathname.endsWith('/book/AHTTv600.pdf');
    const pdfCache=isPdf?await caches.open(PDF_CACHE_NAME):null;
    const range=event.request.headers.get('range');
    if(isPdf&&range&&/^bytes=(\d*)-(\d*)$/.test(range)){const stored=await pdfCache.match(PDF_URL);if(stored)return cachedPdfRange(stored,range);}
    if(!isPdf&&self.navigator.onLine===false){
      const saved=await cache.match(event.request);
      if(saved)return saved;
      const dynamicShell=await dynamicNavigationShell(cache,event.request);if(dynamicShell)return dynamicShell;
      if(event.request.mode==='navigate'){
        const shell=await cache.match('./index.html');
        if(shell)return shell;
      }
    }
    try {
      const response=await fetch(event.request);
      if(!isPdf&&response.status===200)try{await cache.put(event.request,response.clone());}catch{}
      return response;
    }catch {
      const cached=isPdf?await pdfCache.match(PDF_URL):await cache.match(event.request);if(cached)return range?cachedPdfRange(cached,range):cached;
      if(!isPdf){const dynamicShell=await dynamicNavigationShell(cache,event.request);if(dynamicShell)return dynamicShell;}
      if(!isPdf&&event.request.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell;}
      return new Response('このファイルはオフライン保存されていません。ネット接続中に開いてください。',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
    }
  })());
});
