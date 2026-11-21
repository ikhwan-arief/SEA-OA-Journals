/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Journal Landscape: the ecosystem of journals hosted in Southeast Asia (host country = OpenAlex source country).
// Data: web/data/journals/landscape.json (scripts/build_journal_landscape.py). Indicators count SEA OA works.
import { load, esc, fmt, pct, kpis, bindKpiDefs, table, chart, canvasIn, numberAxis, css, panel, body, viewData, provenance, insight, pageHead,
  SEA, SEA_NAMES, COUNTRY_COLORS, badge, countryChips, bindCountryChips, setCountryChips, doajBadge, profileLink, destroyCharts, addPngButtons } from '../lib.js';
import { setSearchHandler, searchId } from '../lib.js';

let SEL = null;
const STATUS_COLORS = { 'SJR quartile': '#0f766e', 'SJR, no quartile': '#5eead4', 'DOAJ only': '#a8550a', Neither: '#94a3b8' };
const MODEL_COLORS = { Diamond: '#1d4ed8', 'APC recorded': '#b91c1c', 'Other OA / unknown': '#94a3b8' };

export async function render(main) {
  if (!SEL) SEL = [...SEA];
  const sel = SEL; const allSel = sel.length === SEA.length;
  const L = await load('journals/landscape.json');
  const C = Object.fromEntries(L.cols.map((c, i) => [c, i]));
  const all = L.journals.map((r) => Object.fromEntries(L.cols.map((c, i) => [c, r[i]])));
  const rows = all.filter((j) => sel.includes(j.host_cc));
  const n = rows.length || 1;
  const cnt = (f) => rows.filter(f).length;
  const works = rows.reduce((a, j) => a + j.works, 0);
  const st = Object.fromEntries(L.status.map((s) => [s, cnt((j) => j.status === s)]));
  const diamond = cnt((j) => j.model === 'Diamond'); const apc = rows.filter((j) => j.apc_usd);
  const doaj = cnt((j) => j.doaj);
  const selName = allSel ? 'all SEA countries' : sel.map((c) => SEA_NAMES[c]).join(', ');
  const scope = `Journals hosted in ${selName} (OpenAlex host country) with SEA OA works; ${L.note}`;
  const items = [
    { label: 'SEA-hosted journals', value: fmt(rows.length), sub: `${fmt(works)} SEA OA works published in them`, def: 'Venues in the SEA OA journal crosswalk whose OpenAlex host country is the selected SEA country.' },
    { label: 'Indexed with an SJR quartile', value: pct(st['SJR quartile'] / n, 1, true), sub: `${fmt(st['SJR quartile'])} journals (Scopus / SCImago 2025)`, def: 'Journals with an SJR 2025 best quartile (Q1–Q4).' },
    { label: 'In DOAJ', value: pct(doaj / n, 1, true), sub: `${fmt(doaj)} journals`, def: 'OpenAlex is_in_doaj flag (Directory of Open Access Journals).' },
    { label: 'Mostly Diamond OA', value: pct(diamond / n, 1, true), sub: `${fmt(diamond)} journals · ${fmt(apc.length)} record an APC`, def: 'Diamond = at least half of the journal’s SEA OA works are Diamond OA (free to read and to publish). APC = article processing charge recorded by OpenAlex.' },
  ];
  main.innerHTML = `
    ${pageHead('Journal Landscape', 'What does the ecosystem of journals hosted in Southeast Asia look like: how many, how indexed, how funded, how fast growing, and which unindexed journals perform well?')}
    <div class="scope-bar" role="group" aria-label="Host country filter">${countryChips(sel, 'Host country of the journal (click to select; click more to compare)')}
      <button type="button" class="btn ghost" id="ccreset">Reset filters</button></div>
    ${kpis(items)}
    <div class="grid">
      ${panel('j-st', 'Indexing status by host country', 'Number of journals: SJR quartile, SJR without quartile, DOAJ only, or neither', 'span-7')}
      ${panel('j-md', 'Publishing model', 'Journals by funding model (Diamond = mostly Diamond OA works)', 'span-5')}
      ${panel('j-ac', 'Active journals per year', 'Journals with at least one SEA OA work in the year, and journals appearing for the first time', 'span-7')}
      ${panel('j-apc', 'Article processing charges', 'Journals recording an APC in OpenAlex, by amount (USD)', 'span-5')}
      ${panel('j-fd', 'Fields', 'Journals by dominant OpenAlex field of their SEA OA works (top 12)', 'span-6')}
      ${panel('j-pb', 'Largest publishers / hosting organisations', 'By number of SEA-hosted journals', 'span-6')}
      ${panel('j-cd', 'High-impact journals without an SJR quartile', 'Not in Scopus/SCImago with a quartile, ≥ 100 SEA OA works and mean FWCI ≥ 1: candidates for wider indexing', 'span-12')}
      ${panel('j-ex', 'Journal explorer', 'All SEA-hosted journals; filter, sort, and click a name for its profile', 'span-12')}
      <div class="span-12" id="j-ins"></div>
    </div>${provenance(scope, `<span><strong>Coverage:</strong> ${fmt(L.coverage.sea_hosted)} SEA-hosted of ${fmt(L.coverage.crosswalk_venues)} venues; host country unknown for ${fmt(L.coverage.host_unknown)}</span>`)}`;
  bindKpiDefs(main, items);

  // indexing status (stacked, per selected country)
  const ccs = sel.filter((c) => all.some((j) => j.host_cc === c));
  chart(canvasIn(body(main, 'j-st'), 'tall', 'Stacked bars of indexing status by host country'), { type: 'bar',
    data: { labels: ccs.map((c) => SEA_NAMES[c]), datasets: L.status.map((s) => ({ label: s, data: ccs.map((c) => all.filter((j) => j.host_cc === c && j.status === s).length), backgroundColor: STATUS_COLORS[s] })) },
    options: { indexAxis: 'y', scales: { x: { ...numberAxis('Journals (count, log scale)'), type: 'logarithmic', stacked: false }, y: { stacked: false } } } });
  viewData(main, 'j-st', () => ({ scope, columns: [{ key: 'country', label: 'Host country' }, ...L.status.map((s) => ({ key: s, label: s, num: true }))],
    rows: ccs.map((c) => Object.assign({ country: SEA_NAMES[c] }, ...L.status.map((s) => ({ [s]: all.filter((j) => j.host_cc === c && j.status === s).length })))) }));

  // publishing model
  chart(canvasIn(body(main, 'j-md'), 'tall', 'Doughnut chart of publishing models'), { type: 'doughnut',
    data: { labels: L.models, datasets: [{ data: L.models.map((m) => cnt((j) => j.model === m)), backgroundColor: L.models.map((m) => MODEL_COLORS[m]) }] },
    options: { plugins: { legend: { position: 'bottom' } } } });
  viewData(main, 'j-md', () => ({ scope, columns: [{ key: 'model', label: 'Model' }, { key: 'n', label: 'Journals', num: true }], rows: L.models.map((m) => ({ model: m, n: cnt((j) => j.model === m) })) }));

  // active / new journals per year
  const [Y0, Y1] = L.years; const ys = []; for (let y = Y0; y <= Y1; y += 1) ys.push(y);
  const ay = (k) => ys.map((y) => L.active.filter((r) => r[1] === y && sel.includes(r[0])).reduce((a, r) => a + r[k], 0));
  chart(canvasIn(body(main, 'j-ac'), '', 'Line chart of active and new journals per year'), { type: 'line',
    data: { labels: ys, datasets: [{ label: 'Active journals', data: ay(2), borderColor: css('--soa-primary'), backgroundColor: 'transparent', tension: 0.2 },
      { label: 'First SEA OA work in this year', data: ay(3), borderColor: '#a8550a', backgroundColor: 'transparent', borderDash: [5, 4], tension: 0.2 }] },
    options: { scales: { y: numberAxis('Journals (count)'), x: { title: { display: true, text: 'Publication year (2026 is partial)' } } } } });
  viewData(main, 'j-ac', () => ({ scope, columns: [{ key: 'year', label: 'Year', num: true }, { key: 'a', label: 'Active journals', num: true }, { key: 'n', label: 'New journals', num: true }],
    rows: ys.map((y, i) => ({ year: y, a: ay(2)[i], n: ay(3)[i] })) }));

  // APC distribution
  const binLbl = (b) => (b[1] === null ? `≥ ${fmt(b[0])}` : `${fmt(b[0])}–${fmt(b[1] - 1)}`);
  const binN = L.apc_bins.map((b) => apc.filter((j) => j.apc_usd >= b[0] && (b[1] === null || j.apc_usd < b[1])).length);
  chart(canvasIn(body(main, 'j-apc'), '', 'Bar chart of APC amounts'), { type: 'bar',
    data: { labels: L.apc_bins.map(binLbl), datasets: [{ label: 'Journals', data: binN, backgroundColor: MODEL_COLORS['APC recorded'] }] },
    options: { plugins: { legend: { display: false } }, scales: { y: numberAxis('Journals (count)'), x: { title: { display: true, text: 'APC (USD)' } } } } });
  const apcSorted = apc.map((j) => j.apc_usd).sort((a, b) => a - b);
  const apcMed = apcSorted.length ? apcSorted[Math.floor(apcSorted.length / 2)] : null;
  body(main, 'j-apc').insertAdjacentHTML('beforeend', `<p class="note">${fmt(apc.length)} journals (${pct(apc.length / n, 1, true)}) record an APC; median ${apcMed === null ? 'n/a' : `USD ${fmt(apcMed)}`}. OpenAlex APC data are incomplete for small journals.</p>`);
  viewData(main, 'j-apc', () => ({ scope, columns: [{ key: 'bin', label: 'APC (USD)' }, { key: 'n', label: 'Journals', num: true }], rows: L.apc_bins.map((b, i) => ({ bin: binLbl(b), n: binN[i] })) }));

  // fields
  const fc = new Map(); rows.forEach((j) => fc.set(j.field, (fc.get(j.field) || 0) + 1));
  const fTop = [...fc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  chart(canvasIn(body(main, 'j-fd'), 'tall', 'Bar chart of journals by field'), { type: 'bar',
    data: { labels: fTop.map(([f]) => L.fields[String(f)] || 'Unclassified'), datasets: [{ label: 'Journals', data: fTop.map(([, v]) => v), backgroundColor: css('--soa-primary') }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: numberAxis('Journals (count)') } } });
  viewData(main, 'j-fd', () => ({ scope, columns: [{ key: 'field', label: 'Field' }, { key: 'n', label: 'Journals', num: true }], rows: [...fc.entries()].map(([f, v]) => ({ field: L.fields[String(f)] || 'Unclassified', n: v })) }));

  // publishers
  const pm = new Map(); L.publishers.filter((p) => sel.includes(p[0])).forEach(([, p, k, w]) => { const r = pm.get(p) || { publisher: p, journals: 0, works: 0 }; r.journals += k; r.works += w; pm.set(p, r); });
  const pubRows = [...pm.values()].sort((a, b) => b.journals - a.journals);
  const noPub = cnt((j) => !j.publisher);
  table(body(main, 'j-pb'), [{ key: 'publisher', label: 'Publisher / host', render: (r) => profileLink('publisher', { id: r.publisher, name: r.publisher }, r.publisher), csv: (r) => r.publisher },
    { key: 'journals', label: 'Journals', num: true, render: (r) => fmt(r.journals) }, { key: 'works', label: 'SEA OA works', num: true, render: (r) => fmt(r.works) }], pubRows, { pageSize: 10, sortKey: 'journals', caption: 'Publishers of SEA-hosted journals' });
  body(main, 'j-pb').insertAdjacentHTML('beforeend', `<p class="note">${fmt(noPub)} journals (${pct(noPub / n, 0, true)}) have no publisher recorded in OpenAlex.</p>`);

  // candidates and explorer
  const jcols = (extra = []) => [
    { key: 'name', label: 'Journal', render: (r) => profileLink('journal', { id: r.id, name: r.name }, r.name) + doajBadge(r.id), csv: (r) => r.name },
    { key: 'host_cc', label: 'Host country', render: (r) => esc(SEA_NAMES[r.host_cc] || r.host_cc), csv: (r) => SEA_NAMES[r.host_cc] || r.host_cc },
    { key: 'status', label: 'Indexing', render: (r) => (r.status === 'SJR quartile' ? badge(r.quartile) : esc(r.status)) },
    { key: 'model', label: 'Model' },
    { key: 'field', label: 'Field', render: (r) => esc(L.fields[String(r.field)] || ''), csv: (r) => L.fields[String(r.field)] || '' },
    { key: 'works', label: 'SEA OA works', num: true, render: (r) => fmt(r.works) },
    { key: 'mean_fwci', label: 'Mean FWCI', num: true, render: (r) => (r.mean_fwci === null ? '–' : fmt(r.mean_fwci, 2)) }, ...extra];
  const cand = rows.filter((j) => j.status !== 'SJR quartile' && j.works >= 100 && (j.mean_fwci ?? 0) >= 1);
  table(body(main, 'j-cd'), jcols([{ key: 'cites', label: 'Citations', num: true, render: (r) => fmt(r.cites) }]), cand, { pageSize: 10, sortKey: 'mean_fwci', caption: 'High-impact journals without an SJR quartile' });
  viewData(main, 'j-cd', () => ({ scope: `${scope}; no SJR quartile, >= 100 works, mean FWCI >= 1`, columns: jcols(), rows: cand }));

  const ex = body(main, 'j-ex');
  ex.innerHTML = `<div class="scope-bar" style="margin:0 0 8px" role="group" aria-label="Explorer filters">
      <label class="field">Indexing<select id="xs"><option value="">All</option>${L.status.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">Model<select id="xm"><option value="">All</option>${L.models.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">Field<select id="xf"><option value="">All</option>${Object.entries(L.fields).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
      <label class="field">Min. SEA OA works<select id="xw">${[0, 20, 100, 500].map((v) => `<option value="${v}">${v}</option>`).join('')}</select></label></div><div id="xt"></div>`;
  const xRows = () => { const s = ex.querySelector('#xs').value; const m = ex.querySelector('#xm').value; const f = ex.querySelector('#xf').value; const w = Number(ex.querySelector('#xw').value);
    return rows.filter((j) => (!s || j.status === s) && (!m || j.model === m) && (!f || String(j.field) === f) && j.works >= w); };
  const xt = table(ex.querySelector('#xt'), jcols([{ key: 'apc_usd', label: 'APC (USD)', num: true, render: (r) => (r.apc_usd ? fmt(r.apc_usd) : '–') }]), xRows(), { pageSize: 15, sortKey: 'works', placeholder: 'Filter by journal or publisher name…', caption: 'SEA-hosted journal explorer' });
  ex.querySelectorAll('select').forEach((x) => x.addEventListener('change', () => xt.update(xRows())));
  viewData(main, 'j-ex', () => ({ scope, columns: [...jcols(), { key: 'publisher', label: 'Publisher' }, { key: 'apc_usd', label: 'APC (USD)', num: true }], rows: xRows() }));

  // computed interpretation
  const neither = st.Neither; const doajOnly = st['DOAJ only'];
  const top = ccs.map((c) => [c, all.filter((j) => j.host_cc === c).length]).sort((a, b) => b[1] - a[1]);
  const last = ys.length - 2; const grow = ay(2); const g10 = grow[last - 10] ? (grow[last] / grow[last - 10]) : null;
  main.querySelector('#j-ins').outerHTML = insight('What this means', `<p>${esc(allSel ? 'Southeast Asia' : selName)} hosts ${fmt(rows.length)} journals with SEA open-access output${top.length > 1 ? `, ${pct(top[0][1] / n, 0, true)} of them in ${esc(SEA_NAMES[top[0][0]])}` : ''}.
    Only ${pct(st['SJR quartile'] / n, 1, true)} carry an SJR quartile, while ${pct(neither / n, 0, true)} are in neither SCImago nor DOAJ; ${pct(doajOnly / n, 1, true)} are recognised by DOAJ but not by SCImago.
    ${pct(diamond / n, 0, true)} are mostly Diamond OA, so the regional journal system is largely free to read and free to publish${apc.length ? `; ${fmt(apc.length)} journals record an APC (median USD ${fmt(apcMed)})` : ''}.</p>
    <ul><li>${fmt(cand.length)} journals without an SJR quartile already reach a mean FWCI of at least 1 with 100 or more SEA OA works (table above).</li>
    ${g10 ? `<li>The number of active journals in ${ys[last]} is ${fmt(g10, 1)}× that of ${ys[last - 10]}.</li>` : ''}
    <li>Indexing status describes visibility in two lists; it is not a quality judgement. Host country and APC come from OpenAlex and are incomplete for small journals.</li></ul>`);

  const again = async () => { destroyCharts(); await render(main); addPngButtons(main); };
  bindCountryChips(main, (v) => { SEL = v; again(); });
  main.querySelector('#ccreset').addEventListener('click', () => { SEL = [...SEA]; again(); });
  setSearchHandler({ kinds: { countries: 'filter by host country' }, run: (k, r) => { SEL = [searchId(k, r)]; setCountryChips(main, SEL); again(); } });
  void C;
}
