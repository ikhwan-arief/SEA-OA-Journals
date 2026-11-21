/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// VOSviewer-style network renderer on Sigma.js + Graphology (vendored), drawn on the dark network canvas.
// Layout and communities are precomputed by the pipeline; the browser only renders and filters.
import { colorAt, quartileColor, COUNTRY_COLORS, oaColor, esc, fmt, QUARTILE_LABEL, SEA_NAMES } from './lib.js';

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

/**
 * opts: { colorBy, sizeBy, onSelect(nodeAttrs, neighbours), onBox(nodes) }
 * returns controller.
 */
export function renderNetwork(stage, data, opts = {}) {
  const { Sigma, graphology } = window;
  if (!webglAvailable() || !Sigma || !graphology) throw new Error('WebGL rendering is not available in this browser.');
  stage.innerHTML = `<div class="sigma-host" role="img" aria-label="Network map; use the node list for keyboard access"></div><canvas class="density"></canvas>
    <div class="hint">Scroll to zoom · drag to pan · click a node for its neighbourhood · Shift + drag for lasso (box) selection</div>`;
  const host = stage.querySelector('.sigma-host');
  const dens = stage.querySelector('canvas.density');
  const g = new graphology.MultiGraph();
  const ids = new Set();
  data.nodes.forEach((n) => {
    const { type, ...rest } = n; // 'type' is reserved by Sigma for the node program
    ids.add(String(n.id));
    g.addNode(String(n.id), { ...rest, kindLabel: type, x: n.x, y: -n.y, label: n.label || String(n.id) });
  });
  let maxW = 0;
  data.edges.forEach(([, , w]) => { maxW = Math.max(maxW, w); });
  data.edges.forEach(([a, b, w]) => {
    if (ids.has(String(a)) && ids.has(String(b))) g.addEdge(String(a), String(b), { weight: w, kind: 'link', size: 1.1 + 3.4 * Math.sqrt(w / (maxW || 1)) }); // thicker floor; sqrt keeps weak links visible
  });
  (data.citations || []).forEach(([a, b]) => {
    if (ids.has(String(a)) && ids.has(String(b))) g.addEdge(String(a), String(b), { kind: 'cite', type: 'arrow', size: 2, weight: 1 });
  });

  const state = { colorBy: opts.colorBy || 'cluster', sizeBy: opts.sizeBy || null, selected: null, neighbours: new Set(),
    query: '', boxSel: new Set(), density: false, directed: false, minW: 0, keep: null };

  function nodeColor(a) {
    switch (state.colorBy) {
      case 'quartile': return quartileColor(a.quartile);
      case 'country': return COUNTRY_COLORS[a.country] || '#9aa3ae';
      case 'oa_status': return oaColor(a.oa_status);
      default: return colorAt(a.cluster ?? 0);
    }
  }
  function applySizes() {
    const key = state.sizeBy;
    const mx = Math.max(1, ...g.mapNodes((n, a) => Number(a[key]) || 0));
    g.forEachNode((n, a) => g.setNodeAttribute(n, 'size', key ? 3 + 17 * Math.sqrt((Number(a[key]) || 0) / mx) : 6));
  }
  applySizes();
  const hiddenNode = (n, a) => state.keep && !state.keep(a);

  const renderer = new Sigma(g, host, {
    renderEdgeLabels: false, labelDensity: 0.6, labelGridCellSize: 90, labelRenderedSizeThreshold: 7,
    defaultEdgeType: 'line', zIndex: true, labelColor: { color: '#24313a' }, labelFont: 'ui-sans-serif, system-ui, sans-serif',
    minCameraRatio: 0.05, maxCameraRatio: 8,
    nodeReducer: (n, a) => {
      const r = { ...a, color: nodeColor(a) };
      if (hiddenNode(n, a)) { r.hidden = true; return r; }
      const focus = state.selected || state.query || state.boxSel.size;
      if (focus) {
        const on = (state.selected && (n === state.selected || state.neighbours.has(n)))
          || (state.query && state.hits && state.hits.has(n)) || state.boxSel.has(n);
        if (!on) { r.color = 'rgba(148,163,184,0.25)'; r.label = ''; r.zIndex = 0; } else { r.zIndex = 1; r.highlighted = n === state.selected; r.forceLabel = true; }
      }
      return r;
    },
    edgeReducer: (e, a) => {
      const [s, t] = g.extremities(e);
      // VOSviewer-style: links take the colour of their source cluster, translucent
      const r = { ...a, color: a.kind === 'cite' ? 'rgba(234,88,12,0.75)' : hexA(edgeTone(nodeColor(g.getNodeAttributes(s))), 0.62) };
      if (hiddenNode(s, g.getNodeAttributes(s)) || hiddenNode(t, g.getNodeAttributes(t))) { r.hidden = true; return r; }
      if (a.kind === 'cite') r.hidden = !state.directed;
      else if (state.directed || a.weight < state.minW) r.hidden = true;
      if (state.selected && !r.hidden) {
        if (s !== state.selected && t !== state.selected) r.hidden = true;
        else r.color = a.kind === 'cite' ? 'rgba(234,88,12,0.95)' : 'rgba(15,118,110,0.7)';
      }
      return r;
    },
  });

  function select(n) {
    state.selected = n;
    state.neighbours = n ? new Set(g.neighbors(n)) : new Set();
    renderer.refresh();
    if (opts.onSelect) opts.onSelect(n ? g.getNodeAttributes(n) : null, n ? [...state.neighbours].map((x) => g.getNodeAttributes(x)) : []);
  }
  renderer.on('clickNode', ({ node }) => select(state.selected === node ? null : node));
  renderer.on('clickStage', () => { if (!boxing) { state.boxSel.clear(); select(null); } });

  // ---- Shift + drag lasso (rectangular) selection --------------------------------------
  let boxing = false; let start = null; let box = null;
  const mouse = renderer.getMouseCaptor();
  const onDown = (e) => {
    if (!e.shiftKey) return;
    boxing = true; e.preventDefault(); e.stopPropagation();
    const r = stage.getBoundingClientRect();
    start = { x: e.clientX - r.left, y: e.clientY - r.top };
    box = document.createElement('div'); box.className = 'select-box'; stage.appendChild(box);
  };
  const onMove = (e) => {
    if (!boxing || !box) return;
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left; const y = e.clientY - r.top;
    Object.assign(box.style, { left: `${Math.min(x, start.x)}px`, top: `${Math.min(y, start.y)}px`, width: `${Math.abs(x - start.x)}px`, height: `${Math.abs(y - start.y)}px` });
  };
  const onUp = (e) => {
    if (!boxing) return;
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left; const y = e.clientY - r.top;
    const [x0, x1, y0, y1] = [Math.min(x, start.x), Math.max(x, start.x), Math.min(y, start.y), Math.max(y, start.y)];
    state.boxSel = new Set(g.filterNodes((n, a) => { if (hiddenNode(n, a)) return false; const p = renderer.graphToViewport({ x: a.x, y: a.y }); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; }));
    if (box) box.remove(); box = null;
    renderer.refresh();
    if (opts.onBox) opts.onBox([...state.boxSel].map((n) => g.getNodeAttributes(n)));
    setTimeout(() => { boxing = false; }, 0);
  };
  stage.addEventListener('mousedown', onDown, true);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  mouse.on('mousedown', (e) => { if (e.original && e.original.shiftKey) e.preventSigmaDefault(); });
  mouse.on('mousemovebody', (e) => { if (boxing) e.preventSigmaDefault(); });

  // ---- Cluster density view (VOSviewer density visualisation) --------------------------
  function drawDensity() {
    const ctx = dens.getContext('2d');
    const w = stage.clientWidth; const hgt = stage.clientHeight; const dpr = window.devicePixelRatio || 1;
    dens.width = w * dpr; dens.height = hgt * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    if (!state.density) return;
    const radius = Math.max(28, Math.min(w, hgt) / 14);
    g.forEachNode((n, a) => {
      if (hiddenNode(n, a)) return;
      const p = renderer.graphToViewport({ x: a.x, y: a.y });
      const rr = radius * (0.6 + a.size / 14);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      const col = nodeColor(a);
      grad.addColorStop(0, hexA(col, 0.32)); grad.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
    });
  }
  renderer.on('afterRender', drawDensity);

  // PNG export: re-render synchronously, then composite all Sigma layers onto one canvas.
  stage.exportCanvas = () => {
    renderer.refresh();
    const dpr = window.devicePixelRatio || 1;
    const out = document.createElement('canvas');
    out.width = stage.clientWidth * dpr; out.height = stage.clientHeight * dpr;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
    if (state.density) ctx.drawImage(dens, 0, 0, out.width, out.height);
    host.querySelectorAll('canvas').forEach((c) => { try { ctx.drawImage(c, 0, 0, out.width, out.height); } catch (e) { /* skip */ } });
    return out;
  };

  return {
    graph: g,
    setColor(by) { state.colorBy = by; renderer.refresh(); },
    setSize(by) { state.sizeBy = by; applySizes(); renderer.refresh(); },
    setMinWeight(w) { state.minW = w; renderer.refresh(); },
    setFilter(fn) { state.keep = fn; renderer.refresh(); },
    visibleNodes() { return g.filterNodes((n, a) => !hiddenNode(n, a)).map((n) => g.getNodeAttributes(n)); },
    visibleEdges() { let k = 0; g.forEachEdge((e, a, s, t) => { if (a.kind === 'link' && a.weight >= state.minW && !hiddenNode(s, g.getNodeAttributes(s)) && !hiddenNode(t, g.getNodeAttributes(t))) k += 1; }); return k; },
    focusNode(id) {
      const n = String(id); if (!g.hasNode(n)) return;
      const p = renderer.getNodeDisplayData(n);
      if (p) renderer.getCamera().animate({ x: p.x, y: p.y, ratio: 0.35 }, { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 });
      select(n);
    },
    /** Highlight every visible node whose label matches q (accent/case-insensitive); focus the best match.
     *  Ranking: exact > starts with > word starts with > contains. Returns the ranked matches. */
    search(q) {
      const nq = fold(q);
      state.query = nq;
      const hits = [];
      if (nq) g.forEachNode((n, a) => { if (hiddenNode(n, a)) return; const r = rankMatch(a.label, nq); if (r < 4) hits.push([r, n, a]); });
      hits.sort((x, y) => x[0] - y[0] || (y[2].size || 0) - (x[2].size || 0));
      state.hits = new Set(hits.map((h) => h[1]));
      if (hits.length) this.focusNode(hits[0][1]); else { select(null); renderer.refresh(); }
      return hits.map((h) => h[2]);
    },
    setDensity(on) { state.density = on; renderer.refresh(); },
    toggleDirected(on) { state.directed = on; renderer.refresh(); },
    reset() { state.boxSel.clear(); state.query = ''; state.hits = null; select(null); renderer.getCamera().animatedReset({ duration: 250 }); },
    resize() { renderer.resize(); renderer.refresh(); },
    destroy() {
      stage.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.kill();
    },
  };
}

/** Lower-case, strip diacritics and collapse spaces (so "truong" finds "Trường"). */
export function fold(x) { return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); }
/** 0 exact, 1 prefix, 2 a word starts with q, 3 contains, 4 no match. */
export function rankMatch(label, nq) {
  const l = fold(label); if (!nq) return 4;
  if (l === nq) return 0; if (l.startsWith(nq)) return 1;
  if ((' ' + l).includes(' ' + nq)) return 2; return l.includes(nq) ? 3 : 4;
}

/** Darkens very light cluster colours (yellow, light green, ...) so their links stay visible on the light canvas. */
function edgeTone(color) {
  const m = String(color).match(/^#([0-9a-f]{6})$/i); if (!m) return color;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum > 0.42) { const k = 0.42 / lum; [r, g, b] = [r, g, b].map((v) => Math.round(v * k)); }
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexA(color, alpha) {
  if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${alpha})`);
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  const c = color.replace('#', '');
  const v = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = parseInt(v, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function legendHtml(nodes, colorBy) {
  const seen = new Map();
  nodes.forEach((n) => {
    let key; let col;
    if (colorBy === 'quartile') { key = QUARTILE_LABEL[n.quartile] || n.quartile || 'Unindexed (not in SJR)'; col = quartileColor(n.quartile); }
    else if (colorBy === 'country') { key = SEA_NAMES[n.country] || n.country || 'Other / unknown'; col = COUNTRY_COLORS[n.country] || '#9aa3ae'; }
    else if (colorBy === 'oa_status') { key = n.oa_status || 'unknown'; col = oaColor(n.oa_status); }
    else { key = `Cluster ${(n.cluster ?? 0) + 1}`; col = colorAt(n.cluster ?? 0); }
    seen.set(key, { col, n: (seen.get(key)?.n || 0) + 1 });
  });
  return [...seen.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 30)
    .map(([k, v]) => `<span><i style="background:${v.col}"></i>${esc(k)} <small>(${fmt(v.n)})</small></span>`).join('');
}

export function metricsHtml(meta, light = false) {
  const rows = [['Items on the map', fmt(meta.nodes)], ['Links shown (weakest removed)', fmt(meta.edges)], ['Clusters (Louvain)', fmt(meta.communities)],
    ['Modularity Q', fmt(meta.modularity, 3)], ['Avg. clustering coeff.', fmt(meta.avg_clustering, 3)], ['Density', fmt(meta.density, 4)]];
  if (meta.directed_edges) rows.push(['Direct citations', fmt(meta.directed_edges)]);
  if (meta.isolates_removed) rows.push(['Unlinked items not mapped', fmt(meta.isolates_removed)]);
  return `<dl class="metrics ${light ? 'light' : ''}">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
    <p class="note">Link strength: ${esc(meta.normalization || 'not specified')}</p>`;
}
