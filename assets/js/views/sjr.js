/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// 6.5 SJR & Quartile Matrix: SJR vs. FWCI scatter (focus), quartile distributions and journal crosswalk.
import { load, esc, fmt, pct, badge, kpis, bindKpiDefs, table, chart, canvasIn, SEA, SEA_NAMES, QUARTILES, QUARTILE_LABEL, quartileColor, OA_LABEL, oaLink,
  pageHead, panel, body, viewData, provenance, insight, drawer, emptyState, resetRoute , journalUrl, extLink, countryChips, bindCountryChips } from '../lib.js';
import { setSearchHandler, searchId, setCountryChips } from '../lib.js';

export async function render(main, [kind = '', ref = '']) {
  const d = await load('journals/sjr_crosswalk.json');
  const m = d.match;
  const all = d.journals;
  const f = { ccs: [...SEA], q: '', oa: '', diamond: false, text: '', highlight: false };
  const items = [
    { label: 'ISSN match rate', value: pct(m.match_rate_active_serials_pct, 1), sub: `${fmt(m.active_sjr_journals_matched)} of ${fmt(m.active_sjr_journals)} active SJR journals · gate ≥ 85%`,
      def: 'Share of active Scimago 2025 journals (Total Docs 2025 > 0) that match an OpenAlex source by any ISSN.' },
    { label: 'SEA OA journals in SJR', value: fmt(m.sea_oa_journals_in_sjr), sub: `of ${fmt(m.sea_oa_journals)} journals carrying SEA OA works`, def: 'OpenAlex journals with SEA OA works that have an SJR 2025 record (with or without quartile).' },
    { label: 'SEA OA works in SJR journals', value: pct((100 * m.sea_oa_works_in_sjr_journals) / (m.sea_oa_works_in_journals || 1), 1), sub: `${fmt(m.sea_oa_works_in_sjr_journals)} works`, def: 'Share of SEA OA journal articles published in SJR-listed journals.' },
    { label: 'SEA-hosted SJR journals matched', value: pct(m.match_rate_sea_hosted_pct, 1), sub: `${fmt(m.active_sea_hosted_matched)} of ${fmt(m.active_sea_hosted_sjr_journals)}`, def: 'Match rate restricted to active Scimago journals whose country is a SEA country.' },
  ];
  main.innerHTML = `
    ${pageHead('SJR & Quartile Matrix', 'How are regional OA journals positioned with respect to SJR, quartile, article-level impact (FWCI), country and Diamond OA status?')}
    <div class="scope-bar" role="group" aria-label="Scope filters">
      ${countryChips(SEA)}
      <p class="note" style="flex-basis:100%;margin:0">Country filter applies to the journal table and SJR–FWCI scatter (journal lead SEA country) and to the country quartile chart; headline cards cover all countries.</p>
      <label class="field">SJR quartile<select id="fq"><option value="">All quartiles</option>${QUARTILES.map((q) => `<option value="${esc(q)}">${esc(QUARTILE_LABEL[q] || q)}</option>`).join('')}</select></label>
      <label class="field">OA route<select id="fo"><option value="">All OA routes</option>${Object.entries(OA_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="field inline"><input type="checkbox" id="fd"> Diamond OA only</label>
      <label class="field" style="flex:1;min-width:220px">Search title or ISSN<input type="search" id="ft" placeholder="e.g. 2088-8708 or Sains Malaysiana"></label>
      <button type="button" class="btn ghost" id="reset">Reset filters</button>
    </div>
    ${kpis(items)}
    <div class="grid">
      ${panel('s-sc', 'SJR (journal prestige metric) vs. mean FWCI (article impact)', '<span id="scSub"></span>', 'span-12',
        '<label class="field inline" style="color:var(--soa-text)"><input type="checkbox" id="hl"> Highlight FWCI ≥ 1 and SJR below median</label>')}
      ${panel('s-cq', 'Country SJR quartile distribution', 'Share of each country\'s OA works by venue quartile (%)', 'span-7',
        '<div class="seg" role="group" aria-label="Measure"><button type="button" aria-pressed="true" data-v="share">Share</button><button type="button" aria-pressed="false" data-v="count">Count</button></div>')}
      ${panel('s-dq', 'Diamond OA journals by SJR quartile', 'Journals with ≥ 20 SEA OA works that are mostly Diamond (OpenAlex) or flagged Diamond by Scimago', 'span-5')}
      ${panel('s-tbl', 'SEA open-access journal crosswalk', 'OpenAlex venues joined to Scimago 2025 by ISSN; click a row for details', 'span-12')}
      ${insight('Reading the matrix', `<ul><li>SJR is a journal-level prestige indicator; FWCI is an article-level impact average. Neither alone measures scientific quality.</li>
        <li>The optional highlight uses a transparent rule (mean FWCI ≥ 1 and SJR below the median of displayed SJR journals); it is a reading aid, not a classification.</li>
        <li>“Unindexed” means no ISSN match in SJR 2025; “In SJR, no quartile” means listed without a best quartile.</li></ul>`)}
    </div>${provenance('Journals with ≥ 20 SEA OA works (type = journal); SJR 2025 by ISSN crosswalk')}`;
  bindKpiDefs(main, items);

  const filtered = () => all.filter((j) => (f.ccs.length === SEA.length || f.ccs.includes(j.lead_cc)) && (!f.q || j.quartile === f.q) && (!f.oa || j.main_oa === f.oa)
    && (!f.diamond || j.diamond_share >= 0.5 || j.sjr_diamond)
    && (!f.text || `${j.name} ${j.issn_l || ''}`.toLowerCase().includes(f.text.toLowerCase())));
  const scopeText = () => [f.ccs.length < SEA.length && `countries ${f.ccs.map((c) => SEA_NAMES[c]).join(', ') || 'none'}`, f.q && `quartile ${f.q}`, f.oa && `OA route ${OA_LABEL[f.oa]}`, f.diamond && 'Diamond OA only', f.text && `search “${f.text}”`].filter(Boolean).join('; ') || 'All SEA OA journals (≥ 20 works)';
  const open = (j) => drawer.open({ title: j.name, subtitle: `ISSN-L ${j.issn_l || 'Not available'}`, html: `<dl class="dl">
      <dt>Publisher</dt><dd>${esc(j.publisher || 'Not available')}</dd><dt>Lead SEA country</dt><dd>${esc(SEA_NAMES[j.lead_cc] || 'Not available')}</dd>
      <dt>SJR quartile</dt><dd>${badge(j.quartile)}</dd><dt>SJR 2025</dt><dd>${j.sjr ? fmt(j.sjr, 3) : 'Not indexed'}</dd><dt>SJR H index</dt><dd>${j.sjr_h ?? 'Not indexed'}</dd>
      <dt>Subject areas (SJR)</dt><dd>${esc(j.areas || 'Not indexed')}</dd><dt>Main OA route</dt><dd>${esc(OA_LABEL[j.main_oa] || j.main_oa || 'Not available')}</dd>
      <dt>Diamond share of works</dt><dd>${pct(j.diamond_share, 1, true)}</dd><dt>In DOAJ</dt><dd>${j.is_in_doaj ? 'Yes' : 'No / not available'}</dd>
      <dt>APC (USD, OpenAlex)</dt><dd>${j.apc_usd ?? 'Not available'}</dd><dt>SEA OA works</dt><dd>${fmt(j.works)} (${j.first_year}–${j.last_year})</dd>
      <dt>Mean FWCI</dt><dd>${j.mean_fwci === null ? 'Insufficient data' : fmt(j.mean_fwci, 2)}</dd><dt>Citations received</dt><dd>${fmt(j.cites_in)}</dd>
      <dt>NIR</dt><dd>${j.nir === null ? 'Insufficient data' : pct(j.nir, 1)}</dd></dl>
      <p>${extLink(journalUrl(j), j.url ? 'Visit journal website' : 'ISSN Portal record')}</p>` });

  let sc = null; let cq = null;
  function drawScatter() {
    if (sc) { sc.destroy(); sc = null; }
    const rows = filtered();
    const ranked = rows.filter((j) => j.sjr && j.mean_fwci !== null && j.mean_fwci !== undefined);
    const med = median(ranked.map((j) => j.sjr));
    main.querySelector('#scSub').textContent = `Each point is a journal; x = SJR 2025 (log scale), y = mean FWCI of its SEA OA works (capped at 8). Showing ${fmt(ranked.length)} journals; ${fmt(rows.length - ranked.length)} without SJR or FWCI are excluded from the plot but listed in the table.`;
    if (!ranked.length) { body(main, 's-sc').innerHTML = emptyState('No journal with both SJR and FWCI for the current filters.', true); bindClear(); return; }
    const isHl = (j) => f.highlight && j.mean_fwci >= 1 && j.sjr < med;
    const medianLine = { id: 'median', afterDraw(c) {
      const x = c.scales.x.getPixelForValue(med); const { top, bottom } = c.chartArea; const ctx = c.ctx;
      ctx.save(); ctx.strokeStyle = '#64748b'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      const y1 = c.scales.y.getPixelForValue(1); ctx.beginPath(); ctx.moveTo(c.chartArea.left, y1); ctx.lineTo(c.chartArea.right, y1); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = '#475569'; ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText(`Median SJR ${med.toFixed(3)}`, x + 4, top + 12); ctx.fillText('FWCI = 1 (world average)', c.chartArea.left + 4, y1 - 4); ctx.restore(); } };
    sc = chart(canvasIn(body(main, 's-sc'), 'tall', 'Scatter plot of SJR versus mean FWCI'), { type: 'scatter', plugins: [medianLine],
      data: { datasets: ['Q1', 'Q2', 'Q3', 'Q4', 'SJR (no quartile)'].map((q) => { const pts = ranked.filter((j) => j.quartile === q); return {
        label: QUARTILE_LABEL[q] || q, backgroundColor: quartileColor(q), borderWidth: 1.5,
        borderColor: pts.map((j) => (isHl(j) ? '#111827' : 'transparent')), pointRadius: pts.map((j) => (isHl(j) ? 5 : 2.8)),
        data: pts.map((j) => ({ x: j.sjr, y: Math.min(j.mean_fwci, 8), j })) }; }) },
      options: { interaction: { mode: 'nearest', intersect: true },
        onClick: (e, els) => { if (els.length) open(sc.data.datasets[els[0].datasetIndex].data[els[0].index].j); },
        scales: { x: { type: 'logarithmic', title: { display: true, text: 'SJR 2025 (log scale)' } }, y: { beginAtZero: true, title: { display: true, text: 'Mean FWCI of SEA OA works (capped at 8)' } } },
        plugins: { tooltip: { callbacks: { label: (c) => { const j = c.raw.j; return `${j.name} · SJR ${fmt(j.sjr, 3)} · FWCI ${fmt(j.mean_fwci, 2)} · ${fmt(j.works)} works`; } } } } } });
  }
  function drawCq(mode) {
    if (cq) cq.destroy();
    const counts = (cc, q) => (d.country_quartile.find((r) => r.cc === cc && r.quartile === q) || {}).works || 0;
    const ccs = SEA.filter((c) => f.ccs.includes(c) && d.country_quartile.some((r) => r.cc === c));
    cq = chart(canvasIn(body(main, 's-cq'), 'tall', 'Stacked bars of quartile distribution by country'), { type: 'bar', data: { labels: ccs.map((c) => SEA_NAMES[c]),
      datasets: QUARTILES.map((q) => ({ label: QUARTILE_LABEL[q] || q, backgroundColor: quartileColor(q), data: ccs.map((c) => {
        const tot = QUARTILES.reduce((a, x) => a + counts(c, x), 0) || 1; return mode === 'share' ? (100 * counts(c, q)) / tot : counts(c, q); }) })) },
    options: { indexAxis: 'y', scales: { x: { stacked: true, title: { display: true, text: mode === 'share' ? 'Share of OA works (%)' : 'OA works (count)' }, ...(mode === 'share' ? { max: 100, ticks: { callback: (v) => `${v}%` } } : {}) }, y: { stacked: true } },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${mode === 'share' ? `${c.parsed.x.toFixed(1)}%` : fmt(c.parsed.x)}` } } } } });
  }
  drawCq('share');
  main.querySelector('#s-cq .seg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    main.querySelectorAll('#s-cq .seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawCq(b.dataset.v);
  });
  viewData(main, 's-cq', () => ({ scope: 'OA works by venue quartile, full counting by country', columns: [{ key: 'cc', label: 'Country', csv: (r) => SEA_NAMES[r.cc] }, { key: 'quartile', label: 'SJR quartile' }, { key: 'works', label: 'OA works', num: true }], rows: d.country_quartile }));

  const dq = QUARTILES.map((q) => d.diamond_quartile.find((r) => r.quartile === q)).filter(Boolean);
  if (dq.length) {
    chart(canvasIn(body(main, 's-dq'), 'tall', 'Bar chart of Diamond OA journals per quartile'), { type: 'bar', data: { labels: dq.map((r) => QUARTILE_LABEL[r.quartile] || r.quartile),
      datasets: [{ label: 'Journals', data: dq.map((r) => r.journals), backgroundColor: dq.map((r) => quartileColor(r.quartile)) }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => `${fmt(dq[c.dataIndex].works)} SEA OA works` } } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Journals (count)' } } } } });
  } else body(main, 's-dq').innerHTML = emptyState('No Diamond OA journals meet the threshold.');
  viewData(main, 's-dq', () => ({ scope: 'Diamond OA journals with ≥ 20 SEA OA works', columns: [{ key: 'quartile', label: 'SJR quartile' }, { key: 'journals', label: 'Journals', num: true }, { key: 'works', label: 'SEA OA works', num: true }], rows: dq }));

  const cols = [
    { key: 'name', label: 'Journal', sticky: true, render: (r) => extLink(journalUrl(r), esc(r.name)), csv: (r) => r.name },
    { key: 'issn_l', label: 'ISSN-L', render: (r) => `<code class="code-sm">${esc(r.issn_l || '–')}</code>` },
    { key: 'publisher', label: 'Publisher' },
    { key: 'lead_cc', label: 'Lead country', render: (r) => esc(SEA_NAMES[r.lead_cc] || r.lead_cc || ''), csv: (r) => SEA_NAMES[r.lead_cc] || '' },
    { key: 'quartile', label: 'SJR quartile', render: (r) => badge(r.quartile) },
    { key: 'sjr', label: 'SJR 2025', num: true, render: (r) => (r.sjr ? fmt(r.sjr, 3) : 'Not indexed') },
    { key: 'main_oa', label: 'Main OA route', render: (r) => esc(OA_LABEL[r.main_oa] || r.main_oa || '') },
    { key: 'works', label: 'SEA OA works', num: true, render: (r) => fmt(r.works) },
    { key: 'mean_fwci', label: 'Mean FWCI', num: true, render: (r) => (r.mean_fwci === null ? 'Insufficient data' : fmt(r.mean_fwci, 2)) },
    { key: 'nir', label: 'NIR (%)', num: true, render: (r) => (r.nir === null ? '–' : pct(r.nir, 1)) },
  ];
  const t = table(body(main, 's-tbl'), cols, all, { pageSize: 20, sortKey: 'works', search: false, onRow: open, caption: 'SEA OA journal crosswalk' });
  viewData(main, 's-tbl', () => ({ scope: scopeText(), columns: cols, rows: filtered() }));
  viewData(main, 's-sc', () => ({ scope: scopeText(), columns: [{ key: 'name', label: 'Journal' }, { key: 'issn_l', label: 'ISSN-L' }, { key: 'quartile', label: 'SJR quartile' },
    { key: 'sjr', label: 'SJR', num: true }, { key: 'mean_fwci', label: 'Mean FWCI', num: true }, { key: 'works', label: 'SEA OA works', num: true }], rows: filtered().filter((j) => j.sjr && j.mean_fwci !== null) }));

  function apply() { t.update(filtered()); drawScatter(); }
  function bindClear() { main.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => resetRoute('#/sjr'))); }
  function reset() {
    Object.assign(f, { ccs: [...SEA], q: '', oa: '', diamond: false, text: '' });
    main.querySelector('#fq').value = ''; main.querySelector('#fo').value = ''; main.querySelector('#fd').checked = false; main.querySelector('#ft').value = '';
    apply(); drawCq('share');
  }
  bindCountryChips(main, (v) => { f.ccs = v; apply(); drawCq('share'); });
  main.querySelector('#fq').addEventListener('change', (e) => { f.q = e.target.value; apply(); });
  main.querySelector('#fo').addEventListener('change', (e) => { f.oa = e.target.value; apply(); });
  main.querySelector('#fd').addEventListener('change', (e) => { f.diamond = e.target.checked; apply(); });
  let tm;
  main.querySelector('#ft').addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(() => { f.text = e.target.value.trim(); apply(); }, 200); });
  main.querySelector('#hl').addEventListener('change', (e) => { f.highlight = e.target.checked; drawScatter(); });
  main.querySelector('#reset').addEventListener('click', () => resetRoute('#/sjr'));
  setSearchHandler({ kinds: { journals: 'open journal profile', countries: 'filter journals by country' }, run: (k, r) => {
    if (k === 'journals') { const j = all.find((x) => String(x.id) === String(searchId(k, r))); if (j) open(j); else location.hash = r.h; return; }
    const cc = searchId(k, r); f.ccs = [cc]; setCountryChips(main, [cc]); apply(); drawCq('share'); } });
  drawScatter();
  if (kind === 'j' && ref) { const j = all.find((x) => String(x.id) === ref); if (j) open(j); }
}

function median(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; }
