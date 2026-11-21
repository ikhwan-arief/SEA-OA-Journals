/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Country Comparator: tick the countries to compare (route #/country/ID,MY,TH), choose a year range,
// then compare; a per-country (or all-selected) detail section follows.
import { load, fmt, pct, esc, badge, table, chart, canvasIn, numberAxis, SEA, SEA_NAMES, COUNTRY_COLORS, OA_STATUSES, OA_LABEL, oaColor,
  QUARTILES, QUARTILE_LABEL, quartileColor, pageHead, panel, body, viewData, provenance, insight, drawer, emptyState, resetRoute,
  journalUrl, instUrl, authorUrl, extLink, countryChips, bindCountryChips } from '../lib.js';
import { setSearchHandler, searchId } from '../lib.js';

const DEFAULT = ['ID', 'MY', 'TH', 'SG', 'VN', 'PH'];
const FLAG = (c) => `assets/vendor/flags/${c.toLowerCase()}.svg`;
const SDG_ICON = (i) => `assets/vendor/sdg/sdg-${String(i).padStart(2, '0')}.png`;
// Full names, wrapped on word boundaries (never truncated).
function wrapWords(text, width) {
  const lines = []; let cur = '';
  text.split(/\s+/).filter(Boolean).forEach((w) => { if (cur && (cur + ' ' + w).length > width) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; });
  if (cur) lines.push(cur);
  return lines;
}
const ALL_YEARS_NOTE = '<span class="chip">all years</span>';

export async function render(main, [codes = '']) {
  let picked = codes.split(',').map((c) => c.trim().toUpperCase()).filter((c) => SEA.includes(c));
  if (!picked.length) picked = DEFAULT.slice();
  if (picked.length === 1 && !codes.includes(',')) picked = [picked[0], ...DEFAULT.filter((c) => c !== picked[0]).slice(0, 2)];
  const all = Object.fromEntries(await Promise.all(SEA.map(async (c) => [c, await load(`countries/${c}.json`)])));
  const sel = SEA.filter((c) => picked.includes(c));
  const names = sel.map((c) => SEA_NAMES[c]).join(', ');
  const yearsAll = [...new Set(sel.flatMap((c) => all[c].access_year.map((r) => r.year)))].filter((y) => y >= 1990).sort();
  const yMax = Math.max(...yearsAll);
  const state = { from: Math.max(2000, yearsAll[0]), to: yMax, detail: 'ALL' };
  const scope = () => `Compared: ${names}; period ${state.from}–${state.to} where noted; OA works only; full counting by country`;
  const yearOpts = (v) => yearsAll.map((y) => `<option ${y === v ? 'selected' : ''}>${y}</option>`).join('');

  main.innerHTML = `
    ${pageHead('Country Comparator', 'How do the selected Southeast Asian countries compare in open-access volume, openness, OA routes, journal positioning and research profile?')}
    <div class="scope-bar" role="group" aria-label="Countries and period to compare">
      ${countryChips(sel)}
      <label class="field">Period from<select id="from">${yearOpts(state.from)}</select></label>
      <label class="field">to<select id="to">${yearOpts(state.to)}</select></label>
      <button type="button" class="btn ghost" id="reset">Reset filters</button>
    </div>
    <div class="grid">
      ${panel('k-tbl', 'Comparison table', 'Counts and OA share follow the selected period; impact and collaboration columns cover all years', 'span-12')}
      ${panel('k-yr', 'Annual open-access output', 'OA works per publication year (count), selected period', 'span-6',
        '<div class="seg" role="group" aria-label="Y-axis scale"><button type="button" aria-pressed="true" data-v="linear">Linear</button><button type="button" aria-pressed="false" data-v="logarithmic">Log</button></div>')}
      ${panel('k-share', 'OA share per year', 'OA works ÷ all works of the country per publication year (%), selected period', 'span-6')}
      ${panel('k-route', 'OA route mix', 'Share of each country\'s OA works by OA route (%), selected period', 'span-6')}
      ${panel('k-quart', 'SJR quartile mix', `Share of OA works by venue quartile, SJR 2025 (%) ${ALL_YEARS_NOTE}`, 'span-6')}
      ${panel('k-sdg', 'SDG profile', `Share of each country's OA works mapped to each UN Sustainable Development Goal (%) ${ALL_YEARS_NOTE}`, 'span-12')}
      ${panel('k-sf', 'Subfield profile (heatmap)', `Share of each country's OA works in the leading subfields; darker = larger share ${ALL_YEARS_NOTE}`, 'span-7')}
      ${panel('k-collab', 'Co-authorship among selected countries', `OA works co-authored by the row country with the column country (count) ${ALL_YEARS_NOTE}`, 'span-5')}
      ${panel('k-det', 'Country detail', `Venues, institutions, authors and funders ${ALL_YEARS_NOTE}`, 'span-12',
        `<label class="field inline">Country<select id="det"><option value="ALL">All countries (selected)</option>${sel.map((c) => `<option value="${c}">${SEA_NAMES[c]}</option>`).join('')}</select></label>`)}
      ${insight('Interpretation notes', '<p>Countries differ greatly in size; compare proportions (OA share, route mix, quartile mix, SDG and subfield shares) rather than raw counts. Panels marked “all years” are not available per year in this build. Co-authorship and partner counts use full counting. These are descriptive indicators, not evaluations.</p>')}
    </div><div id="prov"></div>`;

  const go = (list) => { location.hash = `#/country/${list.join(',')}${list.length === 1 ? ',' : ''}`; };
  bindCountryChips(main, (v) => go(v));
  setSearchHandler({ kinds: { countries: 'compare this country' }, run: (k, r) => go([searchId(k, r)]) });
  main.querySelector('#reset').addEventListener('click', () => resetRoute('#/country'));
  const labels = sel.map((c) => SEA_NAMES[c]);
  const inRange = (y) => y >= state.from && y <= state.to;
  let periodCharts = [];

  // ---------- period-dependent panels
  const yearMap = (c) => { const m = new Map(); all[c].access_year.forEach((r) => { const v = m.get(r.year) || { oa: 0, all: 0 }; v.all += r.n; if (r.is_oa) v.oa += r.n; m.set(r.year, v); }); return m; };
  const maps = Object.fromEntries(sel.map((c) => [c, yearMap(c)]));
  const tcols = [
    { key: 'name', label: 'Country', render: (r) => esc(r.name) },
    { key: 'oa_works', label: 'OA works (period)', num: true, render: (r) => fmt(r.oa_works) },
    { key: 'all_works', label: 'All works (period)', num: true, render: (r) => fmt(r.all_works) },
    { key: 'oa_share', label: 'OA share, period (%)', num: true, render: (r) => pct(r.oa_share) },
    { key: 'cagr_10y', label: '10-yr CAGR (%)', num: true, render: (r) => pct(r.cagr_10y) },
    { key: 'cites', label: 'Citations', num: true, render: (r) => fmt(r.cites) },
    { key: 'mean_fwci', label: 'Mean FWCI', num: true, render: (r) => fmt(r.mean_fwci, 2) },
    { key: 'top10_share', label: 'Top-10% cited (%)', num: true, render: (r) => pct(r.top10_share, 1, true), csv: (r) => r.top10_share },
    { key: 'intl_share', label: 'Intl. co-authored (%)', num: true, render: (r) => pct(r.intl_share, 1, true), csv: (r) => r.intl_share },
  ];
  const summRows = () => sel.map((c) => {
    let oa = 0; let al = 0; maps[c].forEach((v, y) => { if (inRange(y)) { oa += v.oa; al += v.all; } });
    return { ...all[c].summary, cc: c, oa_works: oa, all_works: al, oa_share: al ? (100 * oa) / al : null };
  });
  const tbl = table(body(main, 'k-tbl'), tcols, summRows(), { pageSize: 11, search: false, sortKey: 'oa_works', caption: 'Country comparison' });
  viewData(main, 'k-tbl', () => ({ scope: scope(), columns: tcols, rows: summRows() }));

  function drawPeriod() {
    periodCharts.forEach((c) => c.destroy()); periodCharts = [];
    const ys = yearsAll.filter(inRange);
    tbl.update(summRows());
    main.querySelector('#prov').innerHTML = provenance(esc(scope()));
    const yc = chart(canvasIn(body(main, 'k-yr'), 'tall', 'Line chart of annual OA works'), { type: 'line',
      data: { labels: ys, datasets: sel.map((c) => ({ label: SEA_NAMES[c], data: ys.map((y) => (maps[c].get(y) || {}).oa ?? null), borderColor: COUNTRY_COLORS[c], backgroundColor: COUNTRY_COLORS[c], pointRadius: 0, borderWidth: 2, tension: 0.2 })) },
      options: { scales: { y: numberAxis('OA works (count)'), x: { title: { display: true, text: 'Publication year' } } }, plugins: { tooltip: { mode: 'index' } } } });
    periodCharts.push(yc);
    const seg = main.querySelector('#k-yr .seg');
    seg.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(i === 0)));
    seg.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      yc.options.scales.y.type = b.dataset.v; yc.options.scales.y.beginAtZero = b.dataset.v === 'linear'; yc.update(); };
    periodCharts.push(chart(canvasIn(body(main, 'k-share'), 'tall', 'Line chart of OA share per year'), { type: 'line',
      data: { labels: ys, datasets: sel.map((c) => ({ label: SEA_NAMES[c], data: ys.map((y) => { const v = maps[c].get(y); return v && v.all >= 20 ? (100 * v.oa) / v.all : null; }), borderColor: COUNTRY_COLORS[c], backgroundColor: COUNTRY_COLORS[c], pointRadius: 0, borderWidth: 2, tension: 0.2, spanGaps: true })) },
      options: { scales: { y: { min: 0, max: 100, title: { display: true, text: 'OA share (%)' }, ticks: { callback: (v) => `${v}%` } }, x: { title: { display: true, text: 'Publication year' } } },
        plugins: { tooltip: { mode: 'index', callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y === null ? 'Insufficient data' : `${c.parsed.y.toFixed(1)}%`}` } } } } }));
    const rv = (c, st) => all[c].status_year.filter((r) => r.oa_status === st && inRange(r.year)).reduce((a, r) => a + r.n, 0);
    const rt = (c) => OA_STATUSES.reduce((a, st) => a + rv(c, st), 0) || 1;
    periodCharts.push(chart(canvasIn(body(main, 'k-route'), 'tall', 'Stacked bars of OA route shares'), { type: 'bar',
      data: { labels, datasets: OA_STATUSES.map((st) => ({ label: OA_LABEL[st], backgroundColor: oaColor(st), data: sel.map((c) => (100 * rv(c, st)) / rt(c)) })) },
      options: { indexAxis: 'y', scales: { x: { stacked: true, max: 100, title: { display: true, text: 'Share of OA works (%)' }, ticks: { callback: (v) => `${v}%` } }, y: { stacked: true } },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` } } } } }));
  }
  viewData(main, 'k-yr', () => ({ scope: scope(), columns: [{ key: 'country', label: 'Country' }, { key: 'year', label: 'Year', num: true }, { key: 'oa', label: 'OA works', num: true }, { key: 'all', label: 'All works', num: true }],
    rows: sel.flatMap((c) => yearsAll.filter(inRange).map((y) => ({ country: SEA_NAMES[c], year: y, oa: (maps[c].get(y) || {}).oa ?? null, all: (maps[c].get(y) || {}).all ?? null }))) }));
  viewData(main, 'k-share', () => ({ scope: scope(), columns: [{ key: 'country', label: 'Country' }, { key: 'year', label: 'Year', num: true }, { key: 'share', label: 'OA share (%)', num: true }],
    rows: sel.flatMap((c) => yearsAll.filter(inRange).map((y) => { const v = maps[c].get(y); return { country: SEA_NAMES[c], year: y, share: v && v.all >= 20 ? ((100 * v.oa) / v.all).toFixed(2) : '' }; })) }));
  viewData(main, 'k-route', () => ({ scope: scope(), columns: [{ key: 'country', label: 'Country' }, { key: 'route', label: 'OA route' }, { key: 'works', label: 'OA works', num: true }],
    rows: sel.flatMap((c) => OA_STATUSES.map((st) => ({ country: SEA_NAMES[c], route: OA_LABEL[st], works: all[c].status_year.filter((r) => r.oa_status === st && inRange(r.year)).reduce((a, r) => a + r.n, 0) }))) }));
  const share = body(main, 'k-share');
  drawPeriod();
  const sn = document.createElement('p'); sn.className = 'note'; sn.textContent = 'Years with fewer than 20 works in total are left blank (insufficient data).'; share.after(sn);
  main.querySelector('#from').addEventListener('change', (e) => { state.from = Number(e.target.value); if (state.from > state.to) { state.to = state.from; main.querySelector('#to').value = String(state.to); } drawPeriod(); });
  main.querySelector('#to').addEventListener('change', (e) => { state.to = Number(e.target.value); if (state.to < state.from) { state.from = state.to; main.querySelector('#from').value = String(state.from); } drawPeriod(); });

  // ---------- quartile mix (all years)
  const qv = (c, q) => (all[c].quartiles.find((r) => r.quartile === q) || {}).works || 0;
  const qt = (c) => QUARTILES.reduce((a, q) => a + qv(c, q), 0) || 1;
  chart(canvasIn(body(main, 'k-quart'), 'tall', 'Stacked bars of SJR quartile shares'), { type: 'bar',
    data: { labels, datasets: QUARTILES.map((q) => ({ label: QUARTILE_LABEL[q] || q, backgroundColor: quartileColor(q), data: sel.map((c) => (100 * qv(c, q)) / qt(c)) })) },
    options: { indexAxis: 'y', scales: { x: { stacked: true, max: 100, title: { display: true, text: 'Share of OA works (%)' }, ticks: { callback: (v) => `${v}%` } }, y: { stacked: true } },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` } } } } });
  viewData(main, 'k-quart', () => ({ scope: scope(), columns: [{ key: 'country', label: 'Country' }, { key: 'quartile', label: 'SJR quartile' }, { key: 'works', label: 'OA works', num: true }],
    rows: sel.flatMap((c) => QUARTILES.map((q) => ({ country: SEA_NAMES[c], quartile: q, works: qv(c, q) }))) }));

  // ---------- SDG profile: horizontal grouped bars, official UN icons on the Y axis
  const sdgIds = [...new Set(sel.flatMap((c) => all[c].sdgs.map((r) => r.id)))].sort((a, b) => a - b);
  const sdgName = Object.fromEntries(sel.flatMap((c) => all[c].sdgs.map((r) => [r.id, r.name])));
  const sdgShare = (c, id) => (100 * ((all[c].sdgs.find((r) => r.id === id) || {}).works || 0)) / (all[c].summary.oa_works || 1);
  const icons = Object.fromEntries(sdgIds.map((i) => { const im = new Image(); im.src = SDG_ICON(i); return [i, im]; }));
  const flags = Object.fromEntries(sel.map((c) => { const im = new Image(20, 15); im.src = FLAG(c); return [c, im]; }));
  const ICON = 34;
  const iconAxis = { id: 'sdgIcons',
    afterDraw(c) {
      const y = c.scales.y; const ctx = c.ctx;
      sdgIds.forEach((id, i) => { const im = icons[id]; if (!im.complete || !im.naturalWidth) return; const py = y.getPixelForTick(i); ctx.drawImage(im, 4, py - ICON / 2, ICON, ICON); });
      // country flag at the end of every bar
      c.data.datasets.forEach((ds, di) => { const fl = flags[sel[di]]; if (!fl.complete || !fl.naturalWidth) return; const meta = c.getDatasetMeta(di); if (meta.hidden) return;
        meta.data.forEach((b) => { const h = Math.min(12, Math.max(6, b.height || 8)); const w = h * 4 / 3; ctx.drawImage(fl, b.x + 3, b.y - h / 2, w, h); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.5; ctx.strokeRect(b.x + 3, b.y - h / 2, w, h); }); });
    } };
  const sdgHost = body(main, 'k-sdg');
  const sdgBox = canvasIn(sdgHost, '', 'Horizontal grouped bar chart of SDG shares by country, with UN SDG icons');
  sdgHost.querySelector('.chart-box').style.height = `${Math.max(420, sdgIds.length * Math.max(64, sel.length * 16 + 26))}px`;
  const sdgChart = chart(sdgBox, { type: 'bar', plugins: [iconAxis],
    data: { labels: sdgIds.map((i) => `SDG ${i}`), datasets: sel.map((c) => ({ label: SEA_NAMES[c], backgroundColor: COUNTRY_COLORS[c], pointStyle: flags[c], data: sdgIds.map((i) => sdgShare(c, i)), barPercentage: 0.72, categoryPercentage: 0.82 })) },
    options: { indexAxis: 'y', layout: { padding: { left: ICON + 8, right: 22 } },
      scales: { x: { beginAtZero: true, position: 'top', title: { display: true, text: 'Share of the country\'s OA works (%)' }, ticks: { callback: (v) => `${v}%` } },
        y: { ticks: { callback: (v, i) => [`SDG ${sdgIds[i]}`, ...wrapWords(sdgName[sdgIds[i]] || '', 24)] } } },
      plugins: { legend: { labels: { usePointStyle: true } }, tooltip: { callbacks: { title: (x) => `SDG ${sdgIds[x[0].dataIndex]}: ${sdgName[sdgIds[x[0].dataIndex]] || ''}`, label: (x) => `${x.dataset.label}: ${x.parsed.x.toFixed(2)}%` } } } } });
  [...Object.values(icons), ...Object.values(flags)].forEach((im) => { im.onload = () => sdgChart.update(); });
  const sdgNote = document.createElement('p'); sdgNote.className = 'note'; sdgNote.textContent = 'SDG icons: United Nations (used for information). Flags: flag-icons (MIT). A work can map to several SDGs, so shares do not sum to 100%.'; sdgHost.appendChild(sdgNote);
  viewData(main, 'k-sdg', () => ({ scope: scope(), columns: [{ key: 'sdg', label: 'SDG' }, { key: 'country', label: 'Country' }, { key: 'share', label: 'Share of OA works (%)', num: true }],
    rows: sdgIds.flatMap((i) => sel.map((c) => ({ sdg: `${i} ${sdgName[i] || ''}`, country: SEA_NAMES[c], share: sdgShare(c, i).toFixed(3) }))) }));

  // ---------- subfield profile as heatmap (share of the country's OA works)
  const sfNames = [...new Set(sel.flatMap((c) => all[c].subfields.slice(0, 6).map((r) => r.name)))];
  const sfVal = (c, n) => { const r = all[c].subfields.find((x) => x.name === n); return r ? { works: r.works, share: (100 * r.works) / (all[c].summary.oa_works || 1) } : null; };
  const sfMax = Math.max(0.0001, ...sfNames.flatMap((n) => sel.map((c) => (sfVal(c, n) || { share: 0 }).share)));
  const heat = (v) => { if (!v) return '<span class="heat na" title="Not among this country\'s top 20 subfields">–</span>';
    const a = Math.min(1, v.share / sfMax); const dark = a > 0.55;
    return `<span class="heat" style="background:rgba(15,118,110,${(0.08 + 0.85 * a).toFixed(3)});color:${dark ? '#fff' : 'var(--soa-text)'}" title="${fmt(v.works)} OA works">${v.share.toFixed(1)}%</span>`; };
  const sfRows = sfNames.map((n) => Object.assign({ name: n }, ...sel.map((c) => ({ [c]: sfVal(c, n) }))));
  const sfCols = [{ key: 'name', label: 'Subfield' }, ...sel.map((c) => ({ key: c, label: SEA_NAMES[c], num: true, sort: (r) => (r[c] ? r[c].share : -1), render: (r) => heat(r[c]), csv: (r) => (r[c] ? r[c].share.toFixed(2) : '') }))];
  table(body(main, 'k-sf'), sfCols, sfRows, { pageSize: 15, sortKey: sel[0], caption: 'Subfield profile heatmap' });
  const sfNote = document.createElement('p'); sfNote.className = 'note';
  sfNote.innerHTML = `Cell = share of the country's OA works in the subfield; colour scale 0–${sfMax.toFixed(1)}%. – = not among that country's top 20 subfields. Hover a cell for the count.`;
  body(main, 'k-sf').appendChild(sfNote);
  viewData(main, 'k-sf', () => ({ scope: scope(), columns: sfCols.map((c) => ({ ...c, render: undefined, label: c.key === 'name' ? c.label : `${c.label} (%)` })), rows: sfRows }));

  // ---------- co-authorship matrix among selected countries
  const pv = (a, b) => (a === b ? null : (all[a].partners.find((r) => r.cc === b) || {}).works ?? null);
  const mRows = sel.map((a) => Object.assign({ name: SEA_NAMES[a] }, ...sel.map((b) => ({ [b]: pv(a, b) }))));
  const mCols = [{ key: 'name', label: 'Country' }, ...sel.map((b) => ({ key: b, label: b, num: true, render: (r) => (r[b] === null ? '–' : fmt(r[b])) }))];
  if (sel.length > 1) {
    table(body(main, 'k-collab'), mCols, mRows, { pageSize: 11, search: false, caption: 'Co-authorship matrix' });
    const n2 = document.createElement('p'); n2.className = 'note'; n2.textContent = '– on the diagonal, or when the partner is not among the row country\'s top 25 partners.'; body(main, 'k-collab').appendChild(n2);
  } else body(main, 'k-collab').innerHTML = emptyState('Select at least two countries to compare co-authorship.');
  viewData(main, 'k-collab', () => ({ scope: scope(), columns: mCols.map((c) => ({ ...c, render: undefined })), rows: mRows }));

  // ---------- detail: one country, or all selected countries merged
  const merged = (key, idKey, sumKeys) => {
    const m = new Map();
    sel.forEach((c) => all[c][key].forEach((r) => {
      const k = r[idKey]; const cur = m.get(k);
      if (!cur) m.set(k, { ...r, countries: [c] }); else { sumKeys.forEach((s) => { cur[s] = (cur[s] || 0) + (r[s] || 0); }); cur.countries.push(c); }
    }));
    return [...m.values()];
  };
  const detailData = () => (state.detail === 'ALL'
    ? { name: 'All selected countries', journals: merged('journals', 'id', ['works', 'cites']), institutions: merged('institutions', 'id', ['works', 'cites']),
      authors: merged('authors', 'author', ['works', 'cites']), funders: merged('funders', 'name', ['works']) }
    : all[state.detail]);
  const det = body(main, 'k-det');
  const drawDetail = () => {
    const d = detailData();
    det.innerHTML = `${state.detail === 'ALL' ? '<p class="note">Lists of the selected countries combined; counts are summed per country (a co-authored work can be counted for more than one country).</p>' : ''}
      <div class="grid"><div class="span-6"><h3>Top publication venues</h3><div id="dj"></div></div><div class="span-6"><h3>Top institutions</h3><div id="di"></div></div><div class="span-6"><h3>Leading authors</h3><div id="da"></div></div><div class="span-6"><h3>Top funders</h3><div id="df"></div></div></div>`;
    table(det.querySelector('#dj'), [{ key: 'name', label: 'Venue', render: (r) => extLink(journalUrl(r), esc(r.name)) }, { key: 'quartile', label: 'SJR', render: (r) => badge(r.quartile) },
      { key: 'works', label: 'OA works', num: true, render: (r) => fmt(r.works) }, { key: 'cites', label: 'Citations', num: true, render: (r) => fmt(r.cites) }], d.journals, { pageSize: 8, sortKey: 'works', caption: 'Top venues',
      onRow: (r) => drawer.open({ title: r.name, subtitle: `Venue · ${d.name}`, html: `<dl class="dl"><dt>Publisher</dt><dd>${esc(r.publisher || 'Not available')}</dd><dt>ISSN-L</dt><dd>${esc(r.issn_l || 'Not available')}</dd>
        <dt>SJR quartile</dt><dd>${badge(r.quartile)}</dd><dt>SJR 2025</dt><dd>${r.sjr ? fmt(r.sjr, 3) : 'Not indexed'}</dd><dt>OA works</dt><dd>${fmt(r.works)}</dd><dt>Citations</dt><dd>${fmt(r.cites)}</dd></dl>
        <p>${extLink(journalUrl(r), r.url ? 'Visit journal website' : 'ISSN Portal record')}</p>` }) });
    table(det.querySelector('#di'), [{ key: 'name', label: 'Institution', render: (r) => extLink(instUrl(r), esc(r.name || `I${r.id}`)) },
      { key: 'works', label: 'OA works', num: true, render: (r) => fmt(r.works) }, { key: 'cites', label: 'Citations', num: true, render: (r) => fmt(r.cites) }], d.institutions, { pageSize: 8, sortKey: 'works', caption: 'Top institutions' });
    table(det.querySelector('#da'), [{ key: 'name', label: 'Author', render: (r) => extLink(authorUrl(r), esc(r.name)) },
      { key: 'h', label: 'h-index', num: true }, { key: 'works', label: 'OA works', num: true, render: (r) => fmt(r.works) }, { key: 'cites', label: 'Citations', num: true, render: (r) => fmt(r.cites) }],
    d.authors, { pageSize: 8, sortKey: state.detail === 'ALL' ? 'cites' : 'h', caption: 'Leading authors' });
    table(det.querySelector('#df'), [{ key: 'name', label: 'Funder' }, { key: 'works', label: 'OA works', num: true, render: (r) => fmt(r.works) }], d.funders, { pageSize: 8, search: false, sortKey: 'works', caption: 'Top funders' });
  };
  drawDetail();
  main.querySelector('#det').addEventListener('change', (e) => { state.detail = e.target.value; drawDetail(); });
  viewData(main, 'k-det', () => ({ scope: `${detailData().name}: top venues`, columns: [{ key: 'name', label: 'Venue' }, { key: 'issn_l', label: 'ISSN-L' }, { key: 'quartile', label: 'SJR quartile' }, { key: 'works', label: 'OA works', num: true }, { key: 'cites', label: 'Citations', num: true }], rows: detailData().journals }));
  return null;
}
