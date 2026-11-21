/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// 6.4 OA Citation Inflow: citations to SEA works split by the access type of the citing work.
import { load, esc, fmt, compact, pct, badge, kpis, bindKpiDefs, table, chart, canvasIn, numberAxis, SEA_NAMES, OA_LABEL, oaColor,
  QUARTILES, QUARTILE_LABEL, quartileColor, oaLink, css, pageHead, panel, body, viewData, provenance, insight, drawer , journalUrl, extLink, countryChips, bindCountryChips, destroyCharts, addPngButtons, SEA } from '../lib.js';
import { setSearchHandler, searchId } from '../lib.js';
import { renderNcs } from './inflow_ncs.js';
import { inflowForSelection } from './inflow_agg.js';

const CELLS = [
  { cited: true, citing: true, name: 'OA → OA', desc: 'Open-access works citing SEA OA works' },
  { cited: false, citing: true, name: 'OA → Closed', desc: 'Open-access works citing SEA closed works (contrast group)' },
  { cited: true, citing: false, name: 'Non-OA → OA', desc: 'Closed / paywalled works citing SEA OA works' },
  { cited: false, citing: false, name: 'Non-OA → Closed', desc: 'Closed / paywalled works citing SEA closed works (baseline control)' },
];

let SEL = null; // selected SEA countries (module state, kept while the page is open)

export async function render(main) {
  if (!SEL) SEL = [...SEA];
  const sel = SEL; const allSel = sel.length === SEA.length; const inSel = (cc) => sel.includes(cc);
  const d0 = await load('inflow/inflow_summary.json');
  // a country selection replaces the region-wide aggregates with deduplicated per-country-mask ones
  const d = allSel ? d0 : { ...d0, ...inflowForSelection(await load('inflow/cinflow.json'), sel) };
  const selName = allSel ? 'all SEA countries' : sel.map((c) => SEA_NAMES[c]).join(', ');
  const cell = (citedOa, citingOa) => (d.matrix.find((m) => m.cited_oa === citedOa && m.citing_oa === citingOa) || {}).citations || 0;
  const tot = d.matrix.reduce((a, m) => a + m.citations, 0) || 1;
  const toOa = cell(true, true) + cell(true, false);
  const items = [
    { label: 'Non-OA Inflow Ratio (NIR)', value: pct(d.nir_region_pct, 2), sub: 'of citations received by SEA OA works',
      def: 'NIR = citations from closed/paywalled works ÷ total received citations × 100%. Denominator: all citation links to SEA OA works recorded in the snapshot.' },
    { label: 'Citations received', value: compact(toOa), sub: `by ${fmt(d.sea_oa_works)} SEA OA works`, def: 'Citation links in the OpenAlex snapshot whose cited work is a SEA OA work (self-citation of a work to itself excluded).' },
    { label: 'Citations from non-OA works', value: compact(cell(true, false)), sub: 'citing work has is_oa = false', def: 'Subset of received citations whose citing work is not open access according to OpenAlex.' },
    { label: 'Citations per work: OA vs. closed', value: `${fmt(d.cites_per_oa_work, 2)} / ${fmt(d.cites_per_closed_work, 2)}`,
      sub: `ratio ${d.car_oa_vs_closed ? `${fmt(d.car_oa_vs_closed, 2)}×` : 'not available'} (descriptive)`,
      def: 'Citation Advantage Ratio (CAR) = citations per SEA OA work ÷ citations per SEA closed work, both counted from snapshot links. Differences in field, age and venue are not controlled.' },
  ];
  const scope = `SEA works (OA, plus closed works as contrast) · ${allSel ? 'all SEA countries' : `countries: ${selName} (each work once)`}; citation links in the OpenAlex snapshot`;
  const scopeRW = 'All SEA countries (region-wide; this panel cannot be filtered by country); citation links in the OpenAlex snapshot';
  main.innerHTML = `
    ${pageHead('OA Citation Inflow', 'To what extent do Southeast Asian OA works receive citations from closed / paywalled publications, and how do citations flow between access types?')}
    <div class="scope-bar" role="group" aria-label="Country filter">${countryChips(sel)}
      <button type="button" class="btn ghost" id="ccreset">Reset filters</button>
      <p class="note" style="flex-basis:100%;margin:0">${allSel ? 'All countries selected.' : `Showing works with at least one author affiliation in ${esc(selName)}; each work and citation link is counted once (no double counting of co-authored works). Journal tables use the journal's lead country. <strong>Region-wide (not filterable):</strong> SJR quartile of the citing venue and closed venues citing SEA OA works, because the citing venue is not stored per cited work.`}</p></div>
    ${kpis(items)}
    <div class="grid">
      ${panel('i-mx', 'Cross-access citation matrix', 'Rows: access type of the citing work → columns: access type of the cited SEA work (citation counts)', 'span-5')}
      ${panel('i-yr', 'Citations to SEA OA works by year of the citing work', 'Citation links per citing-work year, split by citing access type', 'span-7')}
      ${panel('i-st', 'Citations per work by OA route', 'Citations per SEA OA work for each OA route, relative to SEA closed works (ratio)', 'span-6')}
      ${panel('i-rg', 'Citing regions', 'Citations to SEA OA works by world region of the citing work\'s first listed affiliation country', 'span-6')}
      <div class="span-12 grid" id="ncs-sec"></div>
      ${panel('i-cq', 'SJR quartile of the citing venue', `Citations to SEA OA works by best SJR quartile of the citing venue and citing access type${allSel ? '' : ' · region-wide (not filtered by country)'}`, 'span-6')}
      ${panel('i-cn', 'NIR by SEA country', 'NIR of each country\'s OA works (full counting)', 'span-6')}
      ${panel('i-pen', 'SEA OA journals by citations from non-OA literature', 'Journals with ≥ 500 received citations', 'span-12',
        '<div class="seg" role="group" aria-label="Sort basis"><button type="button" aria-pressed="true" data-v="vol">By non-OA citations</button><button type="button" aria-pressed="false" data-v="nir">By NIR</button></div>')}
      ${panel('i-cj', 'Closed / paywalled venues citing SEA OA works most', `Citing venues by number of citations to SEA OA works${allSel ? '' : ' · region-wide (not filtered by country)'}`, 'span-12')}
      ${insight('Interpretation', `<ul><li>Inflow from non-OA literature shows <em>where</em> SEA OA research is used; on its own it is not evidence of quality or prestige.</li>
        <li>Only links resolvable inside the snapshot are counted. Citing works without affiliation data are reported as “Unattributed”.</li>
        <li>The citation-per-work ratio is descriptive and does not control for field, publication year or venue.</li></ul>`)}
    </div>${provenance(scope)}`;
  bindKpiDefs(main, items);

  const mx = body(main, 'i-mx');
  const c = (x) => { const v = cell(x.cited, x.citing); return `<button type="button" class="c" data-k="${CELLS.indexOf(x)}"><strong>${compact(v)}</strong><span>${esc(x.name)} · ${pct((100 * v) / tot)}</span></button>`; };
  mx.innerHTML = `<div class="matrix" role="group" aria-label="Cross-access citation matrix">
      <div></div><div class="h">Cited: SEA OA works</div><div class="h">Cited: SEA closed works</div>
      <div class="h">Citing: OA literature</div>${c(CELLS[0])}${c(CELLS[1])}
      <div class="h">Citing: non-OA literature</div>${c(CELLS[2])}${c(CELLS[3])}</div>
    <details class="def"><summary>Definition of NIR</summary><p>NIR = citations from closed/paywalled works ÷ total received citations × 100%. Here: ${fmt(cell(true, false))} ÷ ${fmt(toOa)} = ${pct(d.nir_region_pct, 2)}.</p></details>
    <p class="note">Base: ${fmt(d.sea_oa_works)} SEA OA works and ${fmt(d.sea_closed_works)} SEA closed works (non-paratext).</p>`;
  mx.addEventListener('click', (e) => {
    const b = e.target.closest('.c'); if (!b) return;
    const x = CELLS[Number(b.dataset.k)]; const v = cell(x.cited, x.citing);
    drawer.open({ title: x.name, subtitle: 'Cross-access matrix cell', html: `<dl class="dl"><dt>Direction</dt><dd>${esc(x.desc)}</dd><dt>Citations</dt><dd>${fmt(v)}</dd>
      <dt>Share of all four cells</dt><dd>${pct((100 * v) / tot, 2)}</dd><dt>Scope</dt><dd>${esc(scope)}</dd></dl>` });
  });
  const mcols = [{ key: 'citing', label: 'Citing access' }, { key: 'cited', label: 'Cited SEA access' }, { key: 'citations', label: 'Citations', num: true }, { key: 'share', label: 'Share (%)', num: true }];
  viewData(main, 'i-mx', () => ({ scope, columns: mcols, rows: CELLS.map((x) => ({ citing: x.citing ? 'OA' : 'Non-OA', cited: x.cited ? 'OA' : 'Closed', citations: cell(x.cited, x.citing), share: ((100 * cell(x.cited, x.citing)) / tot).toFixed(2) })) }));

  chart(canvasIn(body(main, 'i-yr'), '', 'Stacked bars of citations per citing year'), { type: 'bar', data: { labels: d.yearly.map((r) => r.year), datasets: [
    { label: 'From OA literature', data: d.yearly.map((r) => r.oa), backgroundColor: css('--soa-access-open') },
    { label: 'From non-OA literature', data: d.yearly.map((r) => r.closed), backgroundColor: css('--soa-access-closed') }] },
  options: { scales: { x: { stacked: true, title: { display: true, text: 'Year of citing work' } }, y: { ...numberAxis('Citations (count)'), stacked: true } }, plugins: { tooltip: { mode: 'index' } } } });
  viewData(main, 'i-yr', () => ({ scope, columns: [{ key: 'year', label: 'Citing year', num: true }, { key: 'oa', label: 'From OA', num: true }, { key: 'closed', label: 'From non-OA', num: true }], rows: d.yearly }));

  const st = d.by_oa_status.filter((r) => OA_LABEL[r.oa_status]);
  chart(canvasIn(body(main, 'i-st'), '', 'Bar chart of citation ratio by OA route'), { type: 'bar', data: { labels: st.map((r) => OA_LABEL[r.oa_status]),
    datasets: [{ label: 'Citations per work relative to closed works', data: st.map((r) => r.car_vs_closed), backgroundColor: st.map((r) => oaColor(r.oa_status)) }] },
  options: { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (x) => { const r = st[x.dataIndex]; return `${fmt(r.cites_per_work, 2)} citations/work · NIR ${pct((100 * r.closed_citations) / (r.citations || 1))}`; } } } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Ratio to closed works (1 = parity)' } } } } });
  viewData(main, 'i-st', () => ({ scope, columns: [{ key: 'oa_status', label: 'OA route' }, { key: 'works', label: 'Works', num: true }, { key: 'citations', label: 'Citations', num: true },
    { key: 'closed_citations', label: 'From non-OA', num: true }, { key: 'cites_per_work', label: 'Citations per work', num: true }, { key: 'car_vs_closed', label: 'Ratio to closed', num: true }], rows: st }));

  chart(canvasIn(body(main, 'i-rg'), '', 'Stacked bars of citing regions'), { type: 'bar', data: { labels: d.regions.map((r) => r.region), datasets: [
    { label: 'OA citing', data: d.regions.map((r) => r.oa), backgroundColor: css('--soa-access-open') },
    { label: 'Non-OA citing', data: d.regions.map((r) => r.closed), backgroundColor: css('--soa-access-closed') }] },
  options: { indexAxis: 'y', scales: { x: { ...numberAxis('Citations (count)'), stacked: true }, y: { stacked: true } } } });
  viewData(main, 'i-rg', () => ({ scope, columns: [{ key: 'region', label: 'Citing region' }, { key: 'oa', label: 'OA citing', num: true }, { key: 'closed', label: 'Non-OA citing', num: true }], rows: d.regions }));

  const cq = QUARTILES.map((q) => d.citing_quartile.find((r) => r.citing_quartile === q)).filter(Boolean);
  chart(canvasIn(body(main, 'i-cq'), '', 'Grouped bars of citing venue quartiles'), { type: 'bar', data: { labels: cq.map((r) => QUARTILE_LABEL[r.citing_quartile] || r.citing_quartile), datasets: [
    { label: 'Non-OA citing', data: cq.map((r) => r.closed), backgroundColor: cq.map((r) => quartileColor(r.citing_quartile)), borderColor: css('--soa-access-closed'), borderWidth: 2 },
    { label: 'OA citing', data: cq.map((r) => r.oa), backgroundColor: cq.map((r) => quartileColor(r.citing_quartile)) + '', borderColor: css('--soa-access-open'), borderWidth: 2 }] },
  options: { scales: { y: numberAxis('Citations (count)'), x: { title: { display: true, text: 'SJR quartile of citing venue' } } },
    plugins: { legend: { labels: { generateLabels: () => [{ text: 'Non-OA citing (outlined red)', fillStyle: '#fff', strokeStyle: css('--soa-access-closed'), lineWidth: 2 }, { text: 'OA citing (outlined teal)', fillStyle: '#fff', strokeStyle: css('--soa-access-open'), lineWidth: 2 }] } } } } });
  viewData(main, 'i-cq', () => ({ scope: allSel ? scope : scopeRW, columns: [{ key: 'citing_quartile', label: 'Citing venue quartile' }, { key: 'closed', label: 'Non-OA citing', num: true }, { key: 'oa', label: 'OA citing', num: true }], rows: cq }));

  const ncols = [
    { key: 'cc', label: 'Country', render: (r) => `<a href="#/country/${r.cc}">${esc(SEA_NAMES[r.cc])}</a>`, csv: (r) => SEA_NAMES[r.cc] },
    { key: 'citations', label: 'Citations received', num: true, render: (r) => fmt(r.citations) },
    { key: 'closed', label: 'From non-OA', num: true, render: (r) => fmt(r.closed) },
    { key: 'nir', label: 'NIR (%)', num: true, render: (r) => pct(r.nir, 2) },
  ];
  const cnRows = d.country_nir.filter((r) => inSel(r.cc));
  table(body(main, 'i-cn'), ncols, cnRows, { pageSize: 11, search: false, sortKey: 'nir', caption: 'NIR by SEA country' });
  viewData(main, 'i-cn', () => ({ scope, columns: ncols, rows: cnRows }));

  const openJ = (r) => drawer.open({ title: r.name, subtitle: 'SEA OA journal · citation inflow', html: `<dl class="dl"><dt>Lead country</dt><dd>${esc(SEA_NAMES[r.lead_cc] || 'Not available')}</dd>
    <dt>SJR quartile</dt><dd>${badge(r.quartile)}</dd><dt>SEA OA works</dt><dd>${fmt(r.works)}</dd><dt>Citations received</dt><dd>${fmt(r.cites_in)}</dd>
    <dt>From non-OA works</dt><dd>${fmt(r.cites_closed)}</dd><dt>NIR</dt><dd>${pct(r.nir, 2)}</dd></dl><p>${extLink(journalUrl(r), 'Visit journal website')}</p>` });
  const pcols = [
    { key: 'name', label: 'Journal' },
    { key: 'lead_cc', label: 'Lead country', render: (r) => esc(SEA_NAMES[r.lead_cc] || ''), csv: (r) => SEA_NAMES[r.lead_cc] || '' },
    { key: 'quartile', label: 'SJR quartile', render: (r) => badge(r.quartile) },
    { key: 'works', label: 'SEA OA works', num: true, render: (r) => fmt(r.works) },
    { key: 'cites_in', label: 'Citations received', num: true, render: (r) => fmt(r.cites_in) },
    { key: 'cites_closed', label: 'From non-OA', num: true, render: (r) => fmt(r.cites_closed) },
    { key: 'nir', label: 'NIR (%)', num: true, render: (r) => pct(r.nir, 2) },
  ];
  const pf = (rows) => rows.filter((r) => allSel || inSel(r.lead_cc));
  let penRows = pf(d.top_penetration);
  const pen = table(body(main, 'i-pen'), pcols, penRows, { pageSize: 15, sortKey: 'cites_closed', onRow: openJ, caption: 'SEA OA journals by non-OA citations' });
  main.querySelector('#i-pen .seg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    main.querySelectorAll('#i-pen .seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    penRows = pf(b.dataset.v === 'nir' ? d.top_nir : d.top_penetration); pen.update(penRows);
  });
  viewData(main, 'i-pen', () => ({ scope, columns: pcols, rows: penRows }));
  const jcols = [
    { key: 'name', label: 'Citing venue', render: (r) => extLink(journalUrl(r), esc(r.name)), csv: (r) => r.name },
    { key: 'publisher', label: 'Publisher' },
    { key: 'quartile', label: 'SJR quartile', render: (r) => badge(r.quartile) },
    { key: 'citations', label: 'Non-OA citations to SEA OA', num: true, render: (r) => fmt(r.citations) },
  ];
  table(body(main, 'i-cj'), jcols, d.top_closed_citing_journals, { pageSize: 10, sortKey: 'citations', caption: 'Closed venues citing SEA OA works' });
  viewData(main, 'i-cj', () => ({ scope: allSel ? scope : scopeRW, columns: jcols, rows: d.top_closed_citing_journals }));
  await renderNcs(main, main.querySelector('#ncs-sec'), sel);
  const again = async () => { destroyCharts(); await render(main); addPngButtons(main); };
  setSearchHandler({ kinds: { journals: 'open citation inflow', countries: 'filter by country' }, run: (k, r) => {
    if (k === 'countries') { SEL = [searchId(k, r)]; again(); return; }
    const id = String(searchId(k, r)); const j = [...d.top_penetration, ...d.top_nir].find((x) => String(x.id) === id);
    if (j) { openJ(j); return; }
    drawer.open({ title: r.n, subtitle: 'Citation inflow', html: `<p>This journal is not among the journals listed on this page (journals with ≥ 500 received citations, top 50 by volume or NIR).</p><p><a href="${esc(r.h)}">Open its profile in SJR Matrix →</a></p>` }); } });
  bindCountryChips(main, (v) => { SEL = v; again(); });
  main.querySelector('#ccreset').addEventListener('click', () => { SEL = [...SEA]; again(); });
}
