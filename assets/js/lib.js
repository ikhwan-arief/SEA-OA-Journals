/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Shared Command Center components: data loading, formatting, page pattern, KPI cards,
// panels with "View data" + CSV export, drawers, sortable tables, states and Chart.js wrappers.

const cache = new Map();
export function load(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(`data/${path}`, { cache: 'no-cache' }).then((r) => {
      if (r.status === 404) { const e = new Error('This data shard has not been generated yet.'); e.code = 'missing'; e.path = path; throw e; }
      if (!r.ok) { const e = new Error(`The data service answered HTTP ${r.status}.`); e.path = path; throw e; }
      return r.json();
    }).catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}
export async function tryLoad(path) { try { return await load(path); } catch (e) { return null; } }

export const SEA = ['ID', 'MY', 'TH', 'SG', 'VN', 'PH', 'BN', 'KH', 'LA', 'MM', 'TL'];
export const SEA_NAMES = { ID: 'Indonesia', MY: 'Malaysia', SG: 'Singapore', TH: 'Thailand', VN: 'Vietnam', PH: 'Philippines',
  BN: 'Brunei Darussalam', KH: 'Cambodia', LA: 'Laos', MM: 'Myanmar', TL: 'Timor-Leste' };
export const OA_STATUSES = ['diamond', 'gold', 'hybrid', 'green', 'bronze'];
export const OA_LABEL = { diamond: 'Diamond', gold: 'Gold', hybrid: 'Hybrid', green: 'Green', bronze: 'Bronze' };
export const QUARTILES = ['Q1', 'Q2', 'Q3', 'Q4', 'SJR (no quartile)', 'Unindexed'];
export const QUARTILE_LABEL = { 'SJR (no quartile)': 'In SJR, no quartile', Unindexed: 'Unindexed (not in SJR)' };

export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export function quartileColor(q) {
  return { Q1: css('--soa-quartile-q1'), Q2: css('--soa-quartile-q2'), Q3: css('--soa-quartile-q3'), Q4: css('--soa-quartile-q4'),
    'SJR (no quartile)': css('--soa-quartile-noq') }[q] || css('--soa-quartile-unindexed');
}
export function oaColor(s) { return css(`--soa-oa-${s}`) || css('--soa-quartile-unindexed'); }
export const OA_COLORS = new Proxy({}, { get: (_, k) => (OA_LABEL[k] ? oaColor(k) : undefined) });
// Colour-blind-aware categorical palette (Okabe-Ito first, then extensions) for clusters.
export const PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#9CA3AF',
  '#8C564B', '#17BECF', '#BCBD22', '#9467BD', '#AEC7E8', '#FF9896', '#98DF8A', '#C5B0D5'];
export const COUNTRY_COLORS = { ID: '#c2410c', MY: '#1d4ed8', TH: '#15803d', SG: '#7e22ce', VN: '#b91c1c', PH: '#0369a1',
  BN: '#be185d', KH: '#0f766e', LA: '#a16207', MM: '#4b5563', TL: '#65a30d' };
export function colorAt(i) { return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]; }

const nf = new Intl.NumberFormat('en-US');
export function fmt(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return digits ? Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : nf.format(Math.round(v));
}
export function compact(v) {
  if (v === null || v === undefined) return '–';
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
}
export function pct(v, digits = 1, isShare = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return `${(isShare ? v * 100 : v).toFixed(digits)}%`;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function badge(q) {
  const cls = /^Q[1-4]$/.test(q) ? `q-${q}` : q === 'SJR (no quartile)' ? 'q-noq' : 'q-un';
  const label = q === 'SJR (no quartile)' ? 'SJR, no Q' : (q === 'Unindexed' || !q) ? 'Unindexed' : q;
  return `<span class="badge ${cls}" title="${esc(QUARTILE_LABEL[q] || q || 'Unindexed (not in SJR)')}">${esc(label)}</span>`;
}
export function oaLink(prefix, id) { return `https://openalex.org/${prefix}${id}`; }
export function swatch(color) { return `<span class="swatch" style="background:${color}" aria-hidden="true"></span>`; }

// ---------------------------------------------------------------- page pattern
let currentMeta = null;
export function setMeta(meta) { currentMeta = meta; }
export function getMeta() { return currentMeta; }

/** Page head: title, research question, methodology link. */
export function pageHead(title, question) {
  return `<div class="page-head"><div><h1>${esc(title)}</h1><p class="question">${question}</p></div>
    <a class="method-link" href="#/about">Methodology &amp; data coverage →</a></div>`;
}
/** Provenance strip shown at the bottom of every analytic module. */
export function provenance(scope, extra = '') {
  const m = currentMeta || {};
  return `<div class="provenance"><span><strong>Data snapshot:</strong> ${esc(m.snapshot_date || 'Not available')}</span>
    <span><strong>Built:</strong> ${esc((m.generated_at || '').slice(0, 16).replace('T', ' ') || 'Not available')} UTC</span>
    <span><strong>Scope:</strong> ${scope}</span><span><strong>Sources:</strong> OpenAlex Parquet snapshot; Scimago Journal &amp; Country Rank 2025</span>
    ${extra}<a href="#/about">Methodology &amp; data coverage</a></div>`;
}
export function insight(title, html) { return `<section class="insight span-12" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${html}</section>`; }

/** KPI cards. Each item: {label, value, unit?, sub?, def?}; def opens a definition drawer (not hover-only). */
export function kpis(items, cls = '') {
  return `<div class="kpis ${cls}">${items.map((k, i) => `<div class="kpi"><div class="label">${esc(k.label)}${k.def
    ? ` <button type="button" class="info-dot" data-def="${i}" aria-label="Definition of ${esc(k.label)}" title="${esc(k.def)}">i</button>` : ''}</div>
    <div class="value">${k.value}${k.unit ? `<small>${esc(k.unit)}</small>` : ''}</div>${k.sub ? `<div class="sub">${k.sub}</div>` : ''}</div>`).join('')}</div>`;
}
export function bindKpiDefs(root, items) {
  root.querySelectorAll('[data-def]').forEach((b) => b.addEventListener('click', () => {
    const k = items[Number(b.dataset.def)];
    drawer.open({ title: k.label, subtitle: 'Indicator definition', html: `<p>${esc(k.def)}</p>` });
  }));
}

/** Panel shell with title, subtitle (dimension/measure) and tool slot. */
export function panel(id, title, sub, cls = 'span-12', tools = '') {
  return `<section class="panel ${cls}" id="${id}" aria-labelledby="${id}-t"><div class="panel-head"><div><h2 id="${id}-t">${esc(title)}</h2>
    ${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="panel-tools">${tools}</div></div><div class="panel-body"></div></section>`;
}
export function body(root, id) { return root.querySelector(`#${id} .panel-body`); }

/** Adds a "View data" button to a panel; opens a drawer with the table and CSV export. */
export function viewData(root, id, getData) {
  const tools = root.querySelector(`#${id} .panel-tools`);
  if (!tools) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn ghost small'; b.textContent = 'View data';
  b.setAttribute('aria-label', `View data: ${root.querySelector(`#${id}-t`)?.textContent || 'chart'}`);
  b.addEventListener('click', () => {
    const { columns, rows, title, scope } = getData();
    drawer.open({ title: title || root.querySelector(`#${id}-t`).textContent, subtitle: scope || 'Underlying values',
      html: '<div class="dt"></div><p class="note">CSV export keeps the active scope and the data snapshot date.</p>',
      actions: [{ label: 'Download CSV', onClick: () => downloadCsv(csvName(title || root.querySelector(`#${id}-t`).textContent), columns, rows, scope,
        title || root.querySelector(`#${id}-t`).textContent) }],
      onMount: (el) => table(el.querySelector('.dt'), columns, rows, { pageSize: 25, search: rows.length > 12, sortKey: null }) });
  });
  tools.prepend(b);
}
/** File name: sea-oa_<page>_<panel>_<snapshot>.csv */
export function csvName(title) {
  const page = document.querySelector('.page-head h1')?.textContent || '';
  const snap = (currentMeta || {}).snapshot_date || '';
  return `${['sea-oa', slug(page), slug(title), snap].filter(Boolean).join('_')}.csv`;
}
export function downloadCsv(name, columns, rows, scope = '', title = '') {
  const q = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const m = currentMeta || {};
  const lines = [...(title ? [`# ${String(title).replace(/\n/g, ' ')}${document.querySelector('.page-head h1') ? ` (${document.querySelector('.page-head h1').textContent})` : ''}`] : []),
    `# SEA Open Access Observatory export; scope: ${scope || 'as displayed'}; data snapshot: ${m.snapshot_date || 'n/a'}; built: ${m.generated_at || 'n/a'}`,
    columns.map((c) => q(c.label)).join(','),
    ...rows.map((r) => columns.map((c) => q(c.csv ? c.csv(r) : r[c.key])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------------------------------------------------------------- drawer (side panel, focus-trapped)
export const drawer = (() => {
  let scrim = null; let el = null; let returnTo = null;
  function close() {
    if (!el) return;
    el.remove(); scrim.remove(); el = null; scrim = null;
    document.removeEventListener('keydown', onKey, true);
    if (returnTo && document.contains(returnTo)) returnTo.focus();
  }
  function onKey(e) {
    if (!el) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...el.querySelectorAll('a[href],button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }
  function open({ title, subtitle = '', html = '', actions = [], onMount }) {
    close();
    returnTo = document.activeElement;
    scrim = document.createElement('div'); scrim.className = 'drawer-scrim'; scrim.addEventListener('click', close);
    el = document.createElement('aside');
    el.className = 'drawer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'drawerTitle');
    el.innerHTML = `<header><div><h2 id="drawerTitle">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
      <div style="display:flex;gap:6px">${actions.map((a, i) => `<button type="button" class="btn small" data-act="${i}">${esc(a.label)}</button>`).join('')}
      <button type="button" class="close" aria-label="Close panel">×</button></div></header><div class="body">${html}</div>`;
    document.body.append(scrim, el);
    el.querySelector('.close').addEventListener('click', close);
    actions.forEach((a, i) => el.querySelector(`[data-act="${i}"]`).addEventListener('click', a.onClick));
    document.addEventListener('keydown', onKey, true);
    if (onMount) onMount(el.querySelector('.body'));
    el.querySelector('.close').focus();
  }
  return { open, close };
})();

// ---------------------------------------------------------------- states
export function skeleton(root) {
  root.innerHTML = `<div class="skeleton" aria-busy="true"><span class="sr-only" role="status">Loading data…</span>
    <div class="sk" style="height:56px;width:60%"></div><div class="kpis">${'<div class="sk" style="height:112px"></div>'.repeat(4)}</div>
    <div class="grid"><div class="sk span-7" style="height:360px"></div><div class="sk span-5" style="height:360px"></div></div></div>`;
}
export function errorState(root, err, retry) {
  const missing = err && err.code === 'missing';
  root.innerHTML = `<div class="state error" role="alert"><h2>${missing ? 'Data not available yet' : 'This view could not be loaded'}</h2>
    <p>${missing ? 'The pipeline has not produced the data for this module yet. Please try again after the next data build.' : 'Something went wrong while loading or drawing this module.'}</p>
    <button type="button" class="btn" id="retry">Retry</button>
    <details><summary>Technical details</summary><code>${esc((err && err.message) || 'Unknown error')}</code></details></div>`;
  root.querySelector('#retry').addEventListener('click', retry);
}
export function emptyState(msg = 'No results for the current combination of filters.', clear = false) {
  return `<div class="state empty"><p>${esc(msg)}</p>${clear ? '<button type="button" class="btn ghost" data-clear>Clear filters</button>' : ''}</div>`;
}
export function partialWarning(msg) { return `<div class="warn" role="note"><strong>Partial data.</strong> <span>${msg}</span></div>`; }

// ---------------------------------------------------------------- tooltip (hover helper; details always also reachable via drawers)
const tip = () => document.getElementById('tooltip');
export function showTip(evt, html) {
  const t = tip(); t.innerHTML = html; t.hidden = false;
  t.style.left = `${Math.min(evt.clientX + 14, window.innerWidth - t.offsetWidth - 8)}px`;
  t.style.top = `${Math.min(evt.clientY + 14, window.innerHeight - t.offsetHeight - 8)}px`;
}
export function hideTip() { tip().hidden = true; }

// ---------------------------------------------------------------- tables
/**
 * Sortable (keyboard-operable), searchable, paginated table.
 * columns: [{key, label, num?, render?(row), sort?(row), csv?(row), sticky?}]
 * opts.onRow(row) makes rows clickable / Enter-activatable.
 */
export function table(host, columns, data, { pageSize = 15, search = true, sortKey = null, desc = true, placeholder = 'Filter rows…', onRow = null, caption = '' } = {}) {
  let rowsAll = data.slice(); let q = ''; let page = 0; let key = sortKey; let dir = desc ? -1 : 1; let view = [];
  const stickyAt = (c, i) => c.sticky || (i === 0 && columns.length > 6);
  host.innerHTML = `<div class="table-tools">${search ? `<input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">` : '<span></span>'}
    <div class="pager" aria-live="polite"></div></div><div class="table-wrap" tabindex="0" role="region" aria-label="${esc(caption || 'Data table')}"><table>${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ''}<thead><tr>${columns.map((c, i) =>
    `<th scope="col" data-k="${c.key}" class="${c.num ? 'num' : ''} ${stickyAt(c, i) ? 'sticky' : ''}" aria-sort="none"><button type="button">${esc(c.label)}</button></th>`).join('')}</tr></thead><tbody></tbody></table></div>`;
  // wide tables (country columns, heatmaps, matrices): keep readable column widths and scroll horizontally
  if (columns.length > 6) { host.querySelector('.table-wrap').classList.add('heat-wrap'); host.querySelector('table').style.minWidth = `${200 + 100 * (columns.length - 1)}px`; }
  const tbody = host.querySelector('tbody'); const pager = host.querySelector('.pager');
  const sortVal = (r, c) => (c.sort ? c.sort(r) : r[c.key]);
  function draw() {
    let rs = rowsAll;
    if (q) { const ql = q.toLowerCase(); rs = rs.filter((r) => columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(ql))); }
    if (key) {
      const c = columns.find((x) => x.key === key);
      if (c) {
        rs = rs.slice().sort((a, b) => {
          const va = sortVal(a, c); const vb = sortVal(b, c);
          if (va === null || va === undefined) return 1;
          if (vb === null || vb === undefined) return -1;
          return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
        });
      }
    }
    const pages = Math.max(1, Math.ceil(rs.length / pageSize)); page = Math.min(page, pages - 1);
    view = rs.slice(page * pageSize, (page + 1) * pageSize);
    tbody.innerHTML = view.map((r, i) => `<tr data-i="${i}" ${onRow ? 'class="clickable" tabindex="0"' : ''}>${columns.map((c, j) =>
      `<td class="${c.num ? 'num' : ''} ${stickyAt(c, j) ? 'sticky' : ''}">${c.render ? c.render(r) : esc(r[c.key] ?? '–')}</td>`).join('')}</tr>`).join('')
      || `<tr><td colspan="${columns.length}">${emptyState(q ? 'No rows match this filter.' : 'No data for the current scope.')}</td></tr>`;
    pager.innerHTML = `<span>${fmt(rs.length)} rows</span><button type="button" data-p="-1" aria-label="Previous page" ${page === 0 ? 'disabled' : ''}>‹</button>
      <span>${page + 1} / ${pages}</span><button type="button" data-p="1" aria-label="Next page" ${page >= pages - 1 ? 'disabled' : ''}>›</button>`;
    host.querySelectorAll('th').forEach((th) => th.setAttribute('aria-sort', th.dataset.k === key ? (dir < 0 ? 'descending' : 'ascending') : 'none'));
  }
  host.querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('th'); if (!th) return;
    if (key === th.dataset.k) dir = -dir; else { key = th.dataset.k; dir = -1; }
    draw();
  });
  pager.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { page += Number(b.dataset.p); draw(); } });
  if (onRow) {
    const act = (e) => { const tr = e.target.closest('tr[data-i]'); if (tr && !e.target.closest('a')) onRow(view[Number(tr.dataset.i)]); };
    tbody.addEventListener('click', act);
    tbody.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr')) { e.preventDefault(); act(e); } });
  }
  const input = host.querySelector('input[type="search"]');
  let t;
  if (input) input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = input.value.trim(); page = 0; draw(); }, 150); });
  draw();
  return { update(d) { rowsAll = d.slice(); page = 0; draw(); }, setQuery(v) { if (input) input.value = v; q = v; page = 0; draw(); } };
}

// ---------------------------------------------------------------- charts
const charts = new Set();
export function destroyCharts() { charts.forEach((c) => c.destroy()); charts.clear(); }
export function chart(canvas, config) {
  const { Chart } = window;
  Chart.defaults.font.family = css('--soa-font') || 'sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = css('--soa-text-muted');
  Chart.defaults.borderColor = css('--soa-outline');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  config.options = { responsive: true, maintainAspectRatio: false, animation: reduce ? false : { duration: 250 },
    interaction: { mode: 'nearest', intersect: false }, ...(config.options || {}) };
  config.options.plugins = { legend: { labels: { boxWidth: 12, usePointStyle: true } }, ...(config.options.plugins || {}) };
  const c = new Chart(canvas, config);
  charts.add(c);
  return c;
}
export function canvasIn(host, cls = '', label = 'Chart') {
  host.innerHTML = `<div class="chart-box ${cls}"><canvas role="img" aria-label="${esc(label)}"></canvas></div>`;
  return host.querySelector('canvas');
}
export function numberAxis(title, extra = {}) {
  return { beginAtZero: true, title: { display: !!title, text: title }, ticks: { callback: (v) => compact(v) }, ...extra };
}

// ---------------------------------------------------------------- PNG export (every chart panel)
function slug(s) { return String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'chart'; }
function savePng(canvas, name) {
  const a = document.createElement('a');
  a.download = `${slug(name)}.png`;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a); a.click(); a.remove();
}
/** Paint a white page with a title and provenance footer around an image source. */
function framed(src, w, h, title) {
  const m = currentMeta || {};
  const pad = 24; const head = 40; const foot = 28; const scale = 2;
  const c = document.createElement('canvas');
  c.width = (w + pad * 2) * scale; c.height = (h + head + foot + pad) * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w + pad * 2, h + head + foot + pad);
  ctx.fillStyle = '#24313a'; ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(title || '', pad, 28);
  ctx.drawImage(src, pad, head, w, h);
  ctx.fillStyle = '#667085'; ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`SEA Open Access Observatory · OpenAlex snapshot ${m.snapshot_date || ''} · Scimago SJR 2025`, pad, head + h + 20);
  return c;
}
async function svgToCanvas(svg) {
  const clone = svg.cloneNode(true);
  const w = svg.viewBox.baseVal.width || svg.clientWidth; const h = svg.viewBox.baseVal.height || svg.clientHeight;
  clone.setAttribute('width', w); clone.setAttribute('height', h); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // inline the CSS-driven presentation so the standalone SVG renders like the page
  const src = svg.querySelectorAll('*'); const dst = clone.querySelectorAll('*');
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    ['fill', 'stroke', 'stroke-opacity', 'stroke-width', 'font-size', 'font-weight', 'font-family', 'paint-order', 'opacity'].forEach((p) => {
      const v = cs.getPropertyValue(p); if (v) dst[i].style.setProperty(p, v);
    });
  });
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  const img = new Image();
  await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
  URL.revokeObjectURL(url);
  return { img, w, h };
}
export async function exportPanelPng(panelEl) {
  const title = panelEl.querySelector('.panel-head h2')?.textContent || panelEl.dataset.title || 'chart';
  const stage = panelEl.querySelector('.net-stage');
  if (stage && stage.exportCanvas) { const c = stage.exportCanvas(); savePng(framed(c, c.width / (window.devicePixelRatio || 1), c.height / (window.devicePixelRatio || 1), title), title); return; }
  const svg = panelEl.querySelector('.sankey-host svg');
  if (svg) { const { img, w, h } = await svgToCanvas(svg); savePng(framed(img, w, h, title), title); return; }
  const cv = panelEl.querySelector('.chart-box canvas');
  if (cv) { savePng(framed(cv, cv.clientWidth, cv.clientHeight, title), title); return; }
}
/** Adds a "Download PNG" button to every panel that contains a chart, Sankey or network canvas. */
export function addPngButtons(root) {
  root.querySelectorAll('.panel, .png-target').forEach((p) => {
    if (p.querySelector(':scope [data-png]')) return;
    if (!p.querySelector('.chart-box canvas, .sankey-host, .net-stage')) return;
    const tools = p.querySelector('.panel-tools') || p.querySelector('.png-tools');
    if (!tools) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost small'; b.dataset.png = '1'; b.textContent = 'Download PNG';
    b.setAttribute('aria-label', `Download PNG: ${p.querySelector('h2')?.textContent || 'chart'}`);
    b.addEventListener('click', () => exportPanelPng(p).catch((e) => console.error(e)));
    tools.appendChild(b);
  });
}

/** Reset a module completely: navigate to its base route, or re-render it if already there. */
export function resetRoute(base) {
  if (location.hash === base) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = base;
}

// ---------------------------------------------------------------- outbound links (original sources first, OpenAlex last)
const httpUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : null);
/** Article: DOI, then the publisher landing page, then the OpenAlex record. */
export function workUrl(n) { return httpUrl(n.doi) || (n.doi ? `https://doi.org/${n.doi}` : null) || httpUrl(n.url) || oaLink('W', n.id); }
/** Journal: its own homepage, then its ISSN Portal record, then OpenAlex. */
export function journalUrl(r) { return httpUrl(r.url) || (r.issn_l ? `https://portal.issn.org/resource/ISSN/${r.issn_l}` : oaLink('S', r.id)); }
/** Institution: homepage, then ROR record, then OpenAlex. */
export function instUrl(r) { return httpUrl(r.url) || httpUrl(r.ror) || oaLink('I', r.id); }
/** Author: ORCID, then OpenAlex. */
export function authorUrl(r) { return httpUrl(r.orcid) || oaLink('A', r.author ?? r.id); }
export function extLink(href, text) { return `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`; }

// ---------------------------------------------------------------- shared country selector
// "All countries" chip first. From All, clicking a country selects only that country; further clicks add or
// remove countries; removing the last one, or clicking "All countries", returns to all.
function chipState(sel) { const on = new Set(sel); return { all: on.size === 0 || on.size === SEA.length, on }; }
function paintChips(host, sel) {
  const { all, on } = chipState(sel);
  host.querySelectorAll('.chip[data-cc]').forEach((b) => { const v = !all && on.has(b.dataset.cc); b.setAttribute('aria-pressed', String(v)); b.classList.toggle('scope', v); });
  const ab = host.querySelector('.chip[data-all]'); ab.setAttribute('aria-pressed', String(all)); ab.classList.toggle('scope', all);
  const cnt = host.parentElement.querySelector('.cc-count'); if (cnt) cnt.textContent = all ? `All ${SEA.length} countries` : `${on.size} of ${SEA.length} selected`;
}
export function countryChips(sel, label = 'Country (click to select; click more to compare)') {
  const { all, on } = chipState(sel);
  return `<div class="field wide cc-field"><span class="cc-label">${esc(label)} <span class="cc-count" aria-live="polite">${all ? `All ${SEA.length} countries` : `${on.size} of ${SEA.length} selected`}</span></span>
    <div class="chips" id="cchips"><button type="button" class="chip cc-all${all ? ' scope' : ''}" data-all="1" aria-pressed="${all}">All countries</button>${SEA.map((c) => {
      const v = !all && on.has(c); return `<button type="button" class="chip${v ? ' scope' : ''}" aria-pressed="${v}" data-cc="${c}">${SEA_NAMES[c]}</button>`; }).join('')}</div></div>`;
}
/** onChange receives the selected codes in SEA order (all 11 when "All countries"). */
export function bindCountryChips(root, onChange) {
  const host = root.querySelector('#cchips'); if (!host) return;
  host.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const allMode = host.querySelector('.chip[data-all]').getAttribute('aria-pressed') === 'true';
    let next;
    if (b.dataset.all) next = [...SEA];
    else {
      const cur = new Set([...host.querySelectorAll('.chip[data-cc][aria-pressed="true"]')].map((x) => x.dataset.cc));
      if (allMode) next = [b.dataset.cc];
      else { if (cur.has(b.dataset.cc)) cur.delete(b.dataset.cc); else cur.add(b.dataset.cc); next = cur.size ? SEA.filter((c) => cur.has(c)) : [...SEA]; }
    }
    paintChips(host, next);
    onChange(next);
  });
}
export function setCountryChips(root, sel) { const host = root.querySelector('#cchips'); if (host) paintChips(host, sel); }

// ---------------------------------------------------------------- tab-aware global search
// A view registers which result kinds it can show in place: { kinds: {journals: 'label', ...}, run(kind, item) }.
let searchHandler = null;
export function setSearchHandler(h) { searchHandler = h; }
export function getSearchHandler() { return searchHandler; }
/** Entity id carried in a search item's default link (journal: #/sjr/j/<id>, author: .../a/<id>, topic: #/experts/<sf>). */
export function searchId(kind, r) {
  const p = String(r.h || '').replace(/^#\//, '').split('/');
  if (kind === 'journals') return p[2];
  if (kind === 'authors') return p[3];
  if (kind === 'topics') return p[1];
  if (kind === 'countries') return r.d;
  return null;
}

// ---------------------------------------------------------------- institution profile (opened from the global search on any tab)
/** Opens the profile drawer of a search-index institution item ({n, i}). */
export function openInstitution(item) { return openProfile('institution', { id: item.i ?? item.id, name: item.n ?? item.name }); }

// ---------------------------------------------------------------- entity profile panel (assets/js/profiles.js, loaded on demand)
/** Opens the right-hand profile panel: kind = journal | publisher | institution | country | author | subfield | work. */
export function openProfile(kind, ref) { return import('./profiles.js').then((m) => m.openProfile(kind, ref)); }
/** A name that opens its profile panel (clicks are handled once in app.js, before any table-row handler). */
export function profileLink(kind, ref, text) {
  return `<a href="#" class="plink" data-pk="${esc(kind)}" data-pid="${esc(ref.id ?? '')}" data-pname="${esc(ref.name ?? '')}">${esc(text ?? ref.name ?? '')}</a>`;
}

// ---------------------------------------------------------------- DOAJ badge (OpenAlex sources.is_in_doaj)
let doajIds = {};
/** Loads web/data/journals/doaj.json once (built by scripts/build_doaj_flags.py); call before rendering views. */
export async function loadDoaj() { try { doajIds = (await load('journals/doaj.json')).ids || {}; } catch (e) { doajIds = {}; } }
export function inDoaj(id) { return id != null && Object.prototype.hasOwnProperty.call(doajIds, String(id)); }
/** Small "DOAJ" badge linking to the journal's DOAJ record (empty string when the journal is not in DOAJ). */
export function doajBadge(id, { link = true } = {}) {
  if (!inDoaj(id)) return '';
  if (!link) return ' <span class="doaj" title="Indexed in DOAJ (Directory of Open Access Journals), per OpenAlex">DOAJ</span>';
  const issn = doajIds[String(id)];
  const href = issn ? `https://doaj.org/toc/${encodeURIComponent(issn)}` : 'https://doaj.org/';
  return ` <a class="doaj" href="${href}" target="_blank" rel="noopener" title="Indexed in DOAJ (Directory of Open Access Journals), per OpenAlex">DOAJ</a>`;
}
