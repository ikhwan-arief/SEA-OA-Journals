/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// 6.1 Regional OA Observatory (11-country comparator).
import { load, tryLoad, kpis, bindKpiDefs, fmt, compact, pct, esc, table, chart, canvasIn, numberAxis, SEA, SEA_NAMES, COUNTRY_COLORS,
  OA_STATUSES, OA_LABEL, oaColor, QUARTILES, QUARTILE_LABEL, quartileColor, pageHead, panel, body, viewData, provenance, insight, emptyState, resetRoute, countryChips, bindCountryChips, setCountryChips } from '../lib.js';
import { setSearchHandler, searchId } from '../lib.js';

export async function render(main) {
  const [d, cw] = await Promise.all([load('overview/sea_macro_summary.json'), tryLoad('journals/sjr_crosswalk.json')]);
  const s = d.sea;
  const allYears = [...new Set(d.years.map((r) => r.year))].sort();
  const maxYear = Math.max(...allYears);
  const state = { countries: new Set(SEA), from: Math.max(2000, allYears[0] || 2000), to: maxYear };
  const diamond = d.status.filter((r) => r.oa_status === 'diamond').reduce((a, r) => a + r.n, 0);
  const statusTot = d.status.reduce((a, r) => a + r.n, 0);
  const items = [
    { label: 'OA works', value: compact(s.oa_works), unit: 'works', sub: `${fmt(s.oa_works)} with ≥ 1 SEA affiliation`,
      def: 'Distinct works with open_access.is_oa = true and at least one authorship institution in the 11 SEA countries; paratext excluded.' },
    { label: 'OA share', value: pct(s.oa_share, 1), sub: `of ${fmt(s.all_works)} SEA works (all access types)`,
      def: 'OA works ÷ all SEA-affiliated works in the snapshot (closed works are used only as this denominator).' },
    { label: 'Diamond OA share', value: pct(statusTot ? (100 * diamond) / statusTot : null, 1), sub: 'of country-attributed OA works',
      def: 'Share of OA works whose OpenAlex oa_status is "diamond" (free to read and publish), full counting by country.' },
    { label: 'Mean FWCI', value: fmt(s.mean_fwci, 2), sub: 'world average = 1.00',
      def: 'Arithmetic mean of OpenAlex field-weighted citation impact over OA works with a computed FWCI.' },
    { label: 'SJR-indexed journals', value: cw ? fmt(cw.match.sea_oa_journals_in_sjr) : 'Not available',
      sub: cw ? `of ${fmt(cw.match.sea_oa_journals)} journals carrying SEA OA works` : 'SJR crosswalk not built',
      def: 'OpenAlex journals that publish SEA OA works and match a Scimago 2025 record by ISSN (ISSN-L or any listed ISSN).' },
  ];

  main.innerHTML = `
    ${pageHead('Regional Open-Access Overview', 'How do volume, growth, OA routes and SJR positioning of open-access output differ across the eleven Southeast Asian countries?')}
    <div class="scope-bar" role="group" aria-label="Scope filters">
      ${countryChips(SEA)}
      <label class="field">Period from<select id="from">${allYears.filter((y) => y >= 1990).map((y) => `<option ${y === state.from ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label class="field">to<select id="to">${allYears.filter((y) => y >= 1990).map((y) => `<option ${y === state.to ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <button type="button" class="btn ghost" id="reset">Reset filters</button>
    </div>
    ${kpis(items, 'five')}
    <div class="grid">
      ${panel('p-trend', 'Annual open-access output', 'OA works per publication year, by country (full counting)', 'span-7',
        '<div class="seg" role="group" aria-label="Y-axis scale"><button type="button" aria-pressed="true" data-v="linear">Linear</button><button type="button" aria-pressed="false" data-v="logarithmic">Log</button></div>')}
      ${panel('p-route', 'OA route mix by country', 'Share of each country\'s OA works by OpenAlex OA status (%)', 'span-5')}
      ${panel('p-table', 'Eleven-country comparator', 'Absolute counts and proportions; ranking by size alone is not a performance ranking', 'span-12')}
      ${panel('p-quart', 'SJR quartile distribution of OA output', 'Share of OA works by the best SJR 2025 quartile of the publishing venue (%)', 'span-7')}
      ${panel('p-status-year', 'Regional OA route trajectory', 'OA works per year by OA status, selected countries', 'span-5')}
      ${insight('How to read this page', `<ul>
        <li>Volumes reflect OpenAlex coverage and affiliation metadata; Indonesia shows the <em>highest observed volume</em>, which is not a statement about research performance.</li>
        <li>OA share uses all SEA works (open and closed) as the denominator; closed works are not analysed elsewhere.</li>
        <li>CAGR is computed over ${d.cagr_window[0]}–${d.cagr_window[1]}; recent years may still be incomplete in the snapshot.</li></ul>`)}
    </div>
    ${provenance('11 SEA countries, OA works only, full counting by country', '<span id="scopeChip"></span>')}`;
  bindKpiDefs(main, items);

  // ----- comparator table
  const cols = [
    { key: 'name', label: 'Country', render: (r) => `<a href="#/country/${r.cc}">${esc(r.name)}</a>` },
    { key: 'oa_works', label: 'OA works', num: true, render: (r) => fmt(r.oa_works) },
    { key: 'all_works', label: 'All works', num: true, render: (r) => fmt(r.all_works) },
    { key: 'oa_share', label: 'OA share (%)', num: true, render: (r) => pct(r.oa_share) },
    { key: 'cagr_10y', label: '10-yr CAGR (%)', num: true, render: (r) => pct(r.cagr_10y) },
    { key: 'cites', label: 'Citations', num: true, render: (r) => fmt(r.cites) },
    { key: 'mean_fwci', label: 'Mean FWCI', num: true, render: (r) => fmt(r.mean_fwci, 2) },
    { key: 'top10_share', label: 'Top-10% cited (%)', num: true, render: (r) => pct(r.top10_share, 1, true), csv: (r) => r.top10_share },
    { key: 'intl_share', label: 'Intl. co-authored (%)', num: true, render: (r) => pct(r.intl_share, 1, true), csv: (r) => r.intl_share },
  ];
  const tbl = table(body(main, 'p-table'), cols, d.countries, { pageSize: 11, search: false, sortKey: 'oa_works', caption: 'Eleven-country comparator' });
  viewData(main, 'p-table', () => ({ columns: cols, rows: d.countries.filter((r) => state.countries.has(r.cc)), scope: scopeText() }));

  let charts = [];
  const scopeText = () => `${state.countries.size === 11 ? 'All 11 SEA countries' : [...state.countries].map((c) => SEA_NAMES[c]).join(', ')}; ${state.from}–${state.to}`;
  function years() { return allYears.filter((y) => y >= state.from && y <= state.to); }
  function draw() {
    charts.forEach((c) => c.destroy()); charts = [];
    const sel = SEA.filter((c) => state.countries.has(c));
    tbl.update(d.countries.filter((r) => state.countries.has(r.cc)));
    main.querySelector('#scopeChip').innerHTML = `<strong>Active filters:</strong> ${esc(scopeText())}`;
    if (!sel.length) {
      ['p-trend', 'p-route', 'p-quart', 'p-status-year'].forEach((id) => { body(main, id).innerHTML = emptyState('No country selected.', true); });
      main.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', reset));
      return;
    }
    const ys = years();
    const yc = chart(canvasIn(body(main, 'p-trend'), 'tall', 'Line chart of annual OA works by country'), {
      type: 'line',
      data: { labels: ys, datasets: sel.map((cc) => {
        const m = new Map(d.years.filter((r) => r.cc === cc).map((r) => [r.year, r.n]));
        return { label: SEA_NAMES[cc], data: ys.map((y) => m.get(y) ?? null), borderColor: COUNTRY_COLORS[cc], backgroundColor: COUNTRY_COLORS[cc], pointRadius: 0, borderWidth: 2, tension: 0.2 };
      }) },
      options: { scales: { y: numberAxis('OA works (count)'), x: { title: { display: true, text: 'Publication year' } } }, plugins: { tooltip: { mode: 'index' } } },
    });
    charts.push(yc);
    const scaleSeg = main.querySelector('#p-trend .seg');
    scaleSeg.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      scaleSeg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      yc.options.scales.y.type = b.dataset.v; yc.options.scales.y.beginAtZero = b.dataset.v === 'linear'; yc.update();
    };
    const tot = Object.fromEntries(sel.map((cc) => [cc, d.status.filter((r) => r.cc === cc).reduce((a, r) => a + r.n, 0)]));
    charts.push(chart(canvasIn(body(main, 'p-route'), 'tall', 'Stacked bar chart of OA route shares by country'), {
      type: 'bar',
      data: { labels: sel.map((c) => SEA_NAMES[c]), datasets: OA_STATUSES.map((st) => ({ label: OA_LABEL[st], backgroundColor: oaColor(st),
        data: sel.map((cc) => { const r = d.status.find((x) => x.cc === cc && x.oa_status === st); return r && tot[cc] ? (100 * r.n) / tot[cc] : 0; }) })) },
      options: { indexAxis: 'y', scales: { x: { stacked: true, max: 100, title: { display: true, text: 'Share of OA works (%)' }, ticks: { callback: (v) => `${v}%` } }, y: { stacked: true } },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` } } } },
    }));
    if (cw) {
      const cq = cw.country_quartile;
      const qtot = Object.fromEntries(sel.map((cc) => [cc, cq.filter((r) => r.cc === cc).reduce((a, r) => a + r.works, 0)]));
      charts.push(chart(canvasIn(body(main, 'p-quart'), 'tall', 'Stacked bar chart of SJR quartile shares by country'), {
        type: 'bar',
        data: { labels: sel.map((c) => SEA_NAMES[c]), datasets: QUARTILES.map((q) => ({ label: QUARTILE_LABEL[q] || q, backgroundColor: quartileColor(q),
          data: sel.map((cc) => { const r = cq.find((x) => x.cc === cc && x.quartile === q); return r && qtot[cc] ? (100 * r.works) / qtot[cc] : 0; }) })) },
        options: { indexAxis: 'y', scales: { x: { stacked: true, max: 100, title: { display: true, text: 'Share of OA works (%)' }, ticks: { callback: (v) => `${v}%` } }, y: { stacked: true } },
          plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` } } } },
      }));
    } else body(main, 'p-quart').innerHTML = emptyState('The SJR crosswalk has not been built yet.');
    const agg = new Map();
    // status_year is regional; scale by country only when all countries are selected
    d.status_year.filter((r) => r.year >= state.from && r.year <= state.to).forEach((r) => agg.set(`${r.year}|${r.oa_status}`, r.n));
    charts.push(chart(canvasIn(body(main, 'p-status-year'), 'tall', 'Stacked bar chart of regional OA works per year by OA status'), {
      type: 'bar',
      data: { labels: ys, datasets: OA_STATUSES.map((st) => ({ label: OA_LABEL[st], backgroundColor: oaColor(st), data: ys.map((y) => agg.get(`${y}|${st}`) || 0) })) },
      options: { scales: { x: { stacked: true }, y: { ...numberAxis('OA works (count, all 11 countries)'), stacked: true } }, plugins: { tooltip: { mode: 'index' } } },
    }));
  }
  viewData(main, 'p-trend', () => ({ scope: scopeText(), columns: [{ key: 'country', label: 'Country' }, { key: 'year', label: 'Year', num: true }, { key: 'n', label: 'OA works', num: true }],
    rows: d.years.filter((r) => state.countries.has(r.cc) && r.year >= state.from && r.year <= state.to).map((r) => ({ country: SEA_NAMES[r.cc], year: r.year, n: r.n })) }));
  viewData(main, 'p-route', () => ({ scope: scopeText(), columns: [{ key: 'country', label: 'Country' }, { key: 'route', label: 'OA route' }, { key: 'n', label: 'OA works', num: true }],
    rows: d.status.filter((r) => state.countries.has(r.cc)).map((r) => ({ country: SEA_NAMES[r.cc], route: OA_LABEL[r.oa_status] || r.oa_status, n: r.n })) }));
  if (cw) viewData(main, 'p-quart', () => ({ scope: scopeText(), columns: [{ key: 'country', label: 'Country' }, { key: 'quartile', label: 'SJR quartile' }, { key: 'works', label: 'OA works', num: true }],
    rows: cw.country_quartile.filter((r) => state.countries.has(r.cc)).map((r) => ({ country: SEA_NAMES[r.cc], quartile: r.quartile, works: r.works })) }));
  viewData(main, 'p-status-year', () => ({ scope: `All 11 SEA countries; ${state.from}–${state.to}`, columns: [{ key: 'year', label: 'Year', num: true }, { key: 'route', label: 'OA route' }, { key: 'n', label: 'OA works', num: true }],
    rows: d.status_year.filter((r) => r.year >= state.from && r.year <= state.to).map((r) => ({ year: r.year, route: OA_LABEL[r.oa_status] || r.oa_status, n: r.n })) }));
  main.querySelector('#p-status-year .sub').textContent = 'OA works per year by OA status, all 11 countries (regional series)';

  function reset() {
    state.countries = new Set(SEA); state.from = Math.max(2000, allYears[0] || 2000); state.to = maxYear;
    setCountryChips(main, SEA);
    main.querySelector('#from').value = String(state.from); main.querySelector('#to').value = String(state.to);
    draw();
  }
  bindCountryChips(main, (v) => { state.countries = new Set(v); draw(); });
  main.querySelector('#from').addEventListener('change', (e) => { state.from = Number(e.target.value); if (state.from > state.to) { state.to = state.from; main.querySelector('#to').value = String(state.to); } draw(); });
  main.querySelector('#to').addEventListener('change', (e) => { state.to = Number(e.target.value); if (state.to < state.from) { state.from = state.to; main.querySelector('#from').value = String(state.from); } draw(); });
  main.querySelector('#reset').addEventListener('click', () => resetRoute('#/overview'));
  setSearchHandler({ kinds: { countries: 'show this country' }, run: (k, r) => {
    const cc = searchId(k, r); state.countries = new Set([cc]); setCountryChips(main, [cc]); draw(); } });
  draw();
}
