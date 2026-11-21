/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// 6.2 Expert & Topic Mapper. Filters are hierarchical and separate:
// Topic (OpenAlex field) -> Subfield (sub-topic) -> Country, then an explicit ranking basis.
// Routes: #/experts | #/experts/t/<field> | #/experts/t/<field>/s/<subfield> | #/experts/s/<subfield>
//         (legacy #/experts/<subfield>[/a/<author>] still works)
import { load, tryLoad, esc, fmt, compact, kpis, bindKpiDefs, table, chart, canvasIn, numberAxis, SEA, SEA_NAMES, COUNTRY_COLORS, oaLink, css,
  pageHead, panel, body, viewData, provenance, insight, drawer, emptyState, partialWarning, resetRoute , authorUrl, extLink, countryChips, bindCountryChips } from '../lib.js';
import { openProfile, profileLink } from '../lib.js';
import { setSearchHandler, searchId, setCountryChips, openInstitution } from '../lib.js';
import { renderNetwork, legendHtml, metricsHtml } from '../network.js';

const BASES = { h: 'h-index within the selected corpus', works: 'Number of OA works (count)', cites: 'Citations received (cited_by_count)', mean_fwci: 'Mean FWCI' };

function parseArgs(args) {
  const a = { topic: '', sub: '', author: '' };
  if (args[0] && /^\d+$/.test(args[0])) { a.sub = args[0]; if (args[1] === 'a') a.author = args[2] || ''; return a; }
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === 't') a.topic = args[i + 1] || '';
    if (args[i] === 's') a.sub = args[i + 1] || '';
    if (args[i] === 'a') a.author = args[i + 1] || '';
  }
  return a;
}
const route = (topic, sub) => `#/experts${topic ? `/t/${topic}` : ''}${sub ? `/s/${sub}` : ''}`;

export async function render(main, args) {
  const idx = await load('experts/index.json');
  const fields = (idx.fields || []).slice().sort((x, y) => x.name.localeCompare(y.name));
  const subs = idx.subfields;
  const sel = parseArgs(args);
  const subRec = subs.find((s) => String(s.id) === sel.sub) || null;
  if (subRec && !sel.topic) sel.topic = String(subRec.field_id || '');
  const topicRec = fields.find((f) => String(f.id) === sel.topic) || null;
  const level = subRec ? 'subfield' : topicRec ? 'field' : 'all';
  const file = subRec ? `experts/${subRec.id}.json` : topicRec ? `experts/field_${topicRec.id}.json` : 'experts/all.json';
  const [d, net] = await Promise.all([load(file), subRec ? tryLoad(`networks/coauthor_${subRec.id}.json`) : Promise.resolve(null)]);
  const scopeRec = d.scope || d.subfield;
  const scopeName = subRec ? `${subRec.name} (${subRec.field})` : topicRec ? topicRec.name : 'All topics';
  const subOptions = topicRec ? subs.filter((s) => String(s.field_id) === String(topicRec.id)) : subs;
  const scopeKey = subRec ? String(subRec.id) : topicRec ? `field_${topicRec.id}` : 'all';
  const yd = await tryLoad(`experts/years/${scopeKey}.json`);
  const [YA, YB] = (yd && yd.years) || [1990, 2026];
  const WINS = { all: 'All years', w10: `${YB - 9}–${YB} (last 10 years)`, w5: `${YB - 4}–${YB} (last 5 years)` };
  const state = { basis: 'h', ccs: [...SEA], win: 'all', y0: YA, y1: YB, list: d.experts };
  const yOpts = (v) => Array.from({ length: YB - YA + 1 }, (_, k) => YA + k).map((y) => `<option value="${y}" ${y === v ? 'selected' : ''}>${y}</option>`).join('');
  const items = [
    { label: 'SEA OA works', value: compact(scopeRec.works), unit: 'works', sub: esc(scopeRec.domain || ''), def: 'OA works whose OpenAlex primary topic falls in the selected topic / subfield.' },
    { label: 'Citations', value: compact(scopeRec.cites), def: 'Sum of OpenAlex cited_by_count of these works.' },
    { label: 'Mean FWCI', value: fmt(scopeRec.mean_fwci, 2), def: 'Mean field-weighted citation impact of these works (world average = 1).' },
    { label: 'Experts listed', value: fmt(d.experts.length), sub: `top ${idx.experts_per_subfield} by h-index`, def: 'Authors with a SEA affiliation on the work, ranked by h-index within the selected corpus, then citations.' },
  ];
  const scope = `${level === 'all' ? 'All topics' : level === 'field' ? `Topic: ${scopeName}` : `Subfield: ${scopeName}`}; SEA-affiliated authorships on OA works`;
  const unresolved = d.experts.filter((r) => /^A\d+$/.test(r.name)).length;
  main.innerHTML = `
    ${pageHead('Expert & Topic Mapper', 'Who are the leading researchers in a given topic or subfield, and what do their productivity and impact profiles look like?')}
    <div class="scope-bar" role="group" aria-label="Expert filters">
      ${countryChips(state.ccs)}
      <p class="note" style="flex-basis:100%;margin:0">Country filter applies to the expert ranking (expert's main SEA country) and the country contribution chart. The expert ranking is recomputed for the chosen period (h-index from works published in that period); the year range applies to the topic and country charts. KPI totals and the co-authorship network cover all years.</p>
      <label class="field">1. Topic<select id="topic"><option value="">All Topics</option>${fields.map((f) => `<option value="${f.id}" ${topicRec && f.id === topicRec.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
      <label class="field">2. Subfield (sub-topic)<select id="sub"><option value="">All Subfields${topicRec ? ` in ${esc(topicRec.name)}` : ''}</option>${subOptions.slice().sort((x, y) => x.name.localeCompare(y.name)).map((s) => `<option value="${s.id}" ${subRec && s.id === subRec.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">Expert ranking period<select id="win">${Object.entries(WINS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      ${yd ? `<div class="yr-range" role="group" aria-label="Publication years for topics and countries"><span class="lbl">Topics &amp; countries: years</span>
        <select id="ty0" aria-label="From year">${yOpts(YA)}</select><span>to</span><select id="ty1" aria-label="To year">${yOpts(YB)}</select></div>` : ''}
      <label class="field">Ranking basis<select id="basis">${Object.entries(BASES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <button type="button" class="btn ghost" id="reset">Reset filters</button>
    </div>
    <div class="chips" style="margin:-4px 0 16px" aria-label="Active scope"><span class="chip scope">Scope: ${esc(scopeName)}</span>${d.topics.slice(0, 8).map((t) => `<span class="chip">${esc(t.topic)}</span>`).join('')}</div>
    ${unresolved ? partialWarning(`${unresolved} author names could not be resolved from OpenAlex in this build and are shown by their OpenAlex ID.`) : ''}
    ${kpis(items)}
    <div class="grid">
      ${panel('e-ex', 'Leading experts', '<span id="basisLbl"></span>. Click a row for the expert profile.', 'span-12')}
      ${panel('e-net', 'Expert co-authorship communities', subRec ? 'Listed experts linked by co-authored SEA OA works in this subfield; Louvain communities' : 'Available when a single subfield is selected', 'span-7')}
      ${panel('e-side', 'Network summary', 'Community structure of the expert network', 'span-5')}
      ${panel('e-tp', 'Dominant research topics', 'OA works by OpenAlex primary topic within the selected scope (top 15)', 'span-7')}
      ${panel('e-cc', 'Country contribution', 'OA works in the selected scope by SEA country (full counting)', 'span-5')}
      ${insight('Ranking caveats', '<p>Rankings use a single, labelled basis at a time and only authorships carrying a SEA affiliation. Author identities follow OpenAlex disambiguation; a high rank describes visibility in this corpus, not overall scholarly merit.</p>')}
    </div>${provenance(scope)}`;
  bindKpiDefs(main, items);
  main.querySelector('#topic').addEventListener('change', (e) => { location.hash = route(e.target.value, ''); });
  main.querySelector('#sub').addEventListener('change', (e) => {
    const s = subs.find((x) => String(x.id) === e.target.value);
    location.hash = e.target.value ? route(String(s ? s.field_id : sel.topic), e.target.value) : route(sel.topic, '');
  });
  main.querySelector('#reset').addEventListener('click', () => resetRoute('#/experts'));

  const openExpert = (r) => openProfile('author', { id: r.author, name: r.name });
  const cols = [
    { key: 'rank', label: 'Rank', num: true },
    { key: 'name', label: 'Author', render: (r) => `${esc(r.name)}${r.orcid ? ' <span class="chip" title="Has ORCID">ORCID</span>' : ''}` },
    { key: 'inst_name', label: 'Main SEA affiliation', render: (r) => (r.inst_name ? profileLink('institution', { id: r.inst, name: r.inst_name }, r.inst_name) : 'Not available'), csv: (r) => r.inst_name || '' },
    { key: 'cc', label: 'Country', render: (r) => esc(SEA_NAMES[r.cc] || r.cc || ''), csv: (r) => SEA_NAMES[r.cc] || r.cc },
    { key: 'h', label: 'h-index', num: true },
    { key: 'works', label: 'OA works', num: true, render: (r) => fmt(r.works) },
    { key: 'cites', label: 'Citations', num: true, render: (r) => fmt(r.cites) },
    { key: 'mean_fwci', label: 'Mean FWCI', num: true, render: (r) => fmt(r.mean_fwci, 2) },
    { key: 'top10', label: 'Top-10% works', num: true },
    { key: 'last_year', label: 'Active', render: (r) => `${r.first_year}–${r.last_year}`, csv: (r) => `${r.first_year}-${r.last_year}` },
  ];
  const ranked = () => state.list.filter((r) => state.ccs.includes(r.cc)).slice()
    .sort((a, b) => (b[state.basis] ?? -1) - (a[state.basis] ?? -1) || b.cites - a.cites).map((r, i) => ({ ...r, rank: i + 1 }));
  const tbl = table(body(main, 'e-ex'), cols, ranked(), { pageSize: 15, sortKey: 'rank', desc: false, placeholder: 'Filter listed authors or institutions…', onRow: openExpert, caption: 'Leading experts' });
  const relabel = () => { main.querySelector('#basisLbl').textContent = `Ranking basis: ${BASES[state.basis]}; period: ${WINS[state.win]}${state.ccs.length < SEA.length ? `; countries: ${state.ccs.map((c) => SEA_NAMES[c]).join(', ') || 'none'}` : ''}`; };
  relabel();
  const upd = () => { tbl.update(ranked()); relabel(); };
  main.querySelector('#basis').addEventListener('change', (e) => { state.basis = e.target.value; upd(); });
  bindCountryChips(main, (v) => { state.ccs = v; upd(); drawCc(); });
  viewData(main, 'e-ex', () => ({ scope: `${scope}; ranking basis: ${BASES[state.basis]}`, columns: cols, rows: ranked() }));

  // topics within the chosen publication years (from experts/years/<scope>.json); all years = the built top 15
  const fullYears = () => state.y0 === YA && state.y1 === YB;
  const topicRows = () => {
    if (!yd || fullYears()) return d.topics;
    const m = new Map();
    yd.topics.forEach(([t, y, n, fs, fn]) => { if (y < state.y0 || y > state.y1) return; const r = m.get(t) || { topic: t, works: 0, fs: 0, fn: 0 }; r.works += n; r.fs += fs; r.fn += fn; m.set(t, r); });
    return [...m.values()].sort((x, y) => y.works - x.works).slice(0, 15).map((r) => ({ topic: r.topic, works: r.works, mean_fwci: r.fn ? r.fs / r.fn : null }));
  };
  const drawTp = () => {
    const tr = topicRows();
    chart(canvasIn(body(main, 'e-tp'), 'tall', 'Bar chart of dominant topics'), { type: 'bar', data: { labels: tr.map((r) => r.topic),
      datasets: [{ label: 'OA works', data: tr.map((r) => r.works), backgroundColor: css('--soa-primary') }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => `Mean FWCI ${fmt(tr[c.dataIndex].mean_fwci, 2)}` } } },
      scales: { x: numberAxis('OA works (count)'), y: { ticks: { callback(v) { const l = this.getLabelForValue(v); return l.length > 42 ? `${l.slice(0, 40)}…` : l; } } } } } });
  };
  drawTp();
  viewData(main, 'e-tp', () => ({ scope: `${scope}; ${fullYears() ? 'all years' : `${state.y0}–${state.y1}`}`, columns: [{ key: 'topic', label: 'Topic' }, { key: 'works', label: 'OA works', num: true }, { key: 'mean_fwci', label: 'Mean FWCI', num: true }], rows: topicRows() }));
  const ccRows = () => {
    if (!yd || fullYears()) return d.countries.filter((r) => state.ccs.includes(r.cc));
    const m = new Map(); yd.countries.forEach(([c, y, n]) => { if (y >= state.y0 && y <= state.y1) m.set(c, (m.get(c) || 0) + n); });
    return [...m.entries()].map(([cc, works]) => ({ cc, works })).filter((r) => state.ccs.includes(r.cc)).sort((x, y) => y.works - x.works);
  };
  const drawCc = () => {
    chart(canvasIn(body(main, 'e-cc'), 'tall', 'Doughnut chart of country contribution'), { type: 'doughnut', data: { labels: ccRows().map((r) => SEA_NAMES[r.cc] || r.cc),
      datasets: [{ data: ccRows().map((r) => r.works), backgroundColor: ccRows().map((r) => COUNTRY_COLORS[r.cc]) }] },
    options: { plugins: { legend: { position: 'right' } } } });
  };
  drawCc();
  main.querySelector('#win').addEventListener('change', async (e) => {
    state.win = e.target.value;
    state.list = state.win === 'all' ? d.experts : ((await tryLoad(`experts/win/${state.win}/${scopeKey}.json`)) || { experts: [] }).experts;
    upd();
  });
  ['#ty0', '#ty1'].forEach((q) => main.querySelector(q)?.addEventListener('change', () => {
    const a = Number(main.querySelector('#ty0').value); const b = Number(main.querySelector('#ty1').value);
    state.y0 = Math.min(a, b); state.y1 = Math.max(a, b); drawTp(); drawCc();
  }));
  setSearchHandler({ kinds: { countries: 'filter experts by country', institutions: 'institution profile; filter experts' }, run: (k, r) => {
    if (k === 'institutions') {
      const inp = body(main, 'e-ex').querySelector('.table-tools input[type="search"]');
      // filter this subfield's expert table when it has experts from the institution; always open the profile
      // (it lists the institution's experts across all subfields)
      if (inp) {
        const has = d.experts.some((e) => e.inst_name === r.n && state.ccs.includes(e.cc));
        inp.value = has ? r.n : ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      openInstitution(r);
      return;
    }
    const cc = searchId(k, r); state.ccs = [cc]; setCountryChips(main, [cc]); upd(); drawCc(); } });
  viewData(main, 'e-cc', () => ({ scope, columns: [{ key: 'country', label: 'Country' }, { key: 'works', label: 'OA works', num: true }], rows: ccRows().map((r) => ({ country: SEA_NAMES[r.cc] || r.cc, works: r.works })) }));

  let ctl = null;
  const side = body(main, 'e-side');
  if (net && net.nodes.length) {
    side.innerHTML = `${metricsHtml(net.meta, true)}<h3 style="font-size:.8125rem;margin:12px 0 6px">Communities</h3><div class="legend">${legendHtml(net.nodes, 'cluster')}</div>
      <h3 style="font-size:.8125rem;margin:12px 0 6px">Experts on this map <span style="font-weight:400;color:var(--soa-text-muted)">(click a name to find it)</span></h3><ul class="node-list light">${net.nodes.map((n) => `<li><button type="button" data-id="${n.id}">${esc(n.label)}</button></li>`).join('')}</ul>`;
    body(main, 'e-net').innerHTML = '<div class="net-stage"></div>';
    try {
      ctl = renderNetwork(body(main, 'e-net').querySelector('.net-stage'), net, { colorBy: 'cluster', sizeBy: 'h',
        onSelect: (a) => { if (a) { const r = d.experts.find((x) => x.author === a.id); if (r) openExpert({ ...r, rank: r.rk }); } } });
      side.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => ctl.focusNode(b.dataset.id)));
    } catch (e) {
      body(main, 'e-net').innerHTML = emptyState('The interactive graph needs WebGL, which is unavailable here. Use the expert list on the right instead.');
    }
  } else {
    body(main, 'e-net').innerHTML = emptyState(subRec ? 'No co-authorship links among the listed experts for this subfield.' : 'Select a subfield (step 2) to view the expert co-authorship network.');
    side.innerHTML = '<p class="note">Network metrics appear when a subfield with a co-authorship network is selected.</p>';
  }
  if (sel.author) { const r = d.experts.find((x) => String(x.author) === sel.author); if (r) openExpert({ ...r, rank: r.rk }); }
  return () => ctl && ctl.destroy();
}
