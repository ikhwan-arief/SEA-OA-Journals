/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// 6.6 Sankey Flow Visualizer (d3-sankey, vendored) with threshold, drill-down drawer and stage tables.
import { load, esc, fmt, pct, showTip, hideTip, colorAt, quartileColor, COUNTRY_COLORS, SEA_NAMES, oaColor, css,
  pageHead, panel, body, viewData, provenance, insight, drawer, table, emptyState, downloadCsv, partialWarning, SEA, countryChips, bindCountryChips } from '../lib.js';
import { setSearchHandler, searchId } from '../lib.js';

const FLOWS = {
  a: { file: 'sankey/flow_country_domain_quartile.json', label: 'Country → Scientific domain → OA route → SJR quartile', unit: 'OA works' },
  b: { file: 'sankey/flow_citation_pipeline.json', label: 'Citing access → Citing region → SEA journal → SDG pillar', unit: 'citations' },
  c: { file: 'sankey/flow_funding_impact.json', label: 'Funder → Research field → OA route → Citation impact band', unit: 'OA works' },
};
const NAME_TO_CC = Object.fromEntries(Object.entries(SEA_NAMES).map(([k, v]) => [v, k]));

function nodeColor(n, i) {
  if (NAME_TO_CC[n.name]) return COUNTRY_COLORS[NAME_TO_CC[n.name]];
  if (/^Q[1-4]$/.test(n.name) || n.name === 'Unindexed' || n.name === 'SJR (no quartile)') return quartileColor(n.name);
  const oa = n.name.replace(' OA', '').toLowerCase();
  if (['diamond', 'gold', 'green', 'hybrid', 'bronze'].includes(oa)) return oaColor(oa);
  if (n.name.startsWith('Closed')) return css('--soa-access-closed');
  if (n.name.startsWith('Open-access')) return css('--soa-access-open');
  return colorAt(i);
}

const CFILE = { a: 'sankey/cflow_a.json', b: 'sankey/cflow_b.json', c: 'sankey/cflow_c.json' };
let SEL = null; // selected SEA country codes; kept across presets (module state)
try { const v = JSON.parse(sessionStorage.getItem('soa-sankey-cc') || 'null'); if (Array.isArray(v)) SEL = v; } catch (e) { /* storage unavailable */ }
const saveSel = () => { try { sessionStorage.setItem('soa-sankey-cc', JSON.stringify(SEL)); } catch (e) { /* ignore */ } };

/** Build nodes/links for the selected countries from the per-mask (or per-country) aggregates. */
export function buildFlow(key, cf, sel) {
  const bits = cf.countries.reduce((a, c, i) => (sel.includes(c) ? a | (1 << i) : a), 0);
  const hit = (m) => (m & bits) !== 0;
  const paths = []; const notes = []; let exact = true;
  const topBy = (rows, keyIdx, valIdx, n, bound) => {
    const sums = new Map(); rows.forEach((r) => { if (r[keyIdx]) sums.set(r[keyIdx], (sums.get(r[keyIdx]) || 0) + r[valIdx]); });
    const ranked = [...sums.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const top = new Set(ranked.slice(0, n).map((x) => x[0]));
    const nth = ranked.length >= n ? ranked[n - 1][1] : 0;
    const ub = sel.reduce((a, c) => a + (bound[c] || 0), 0);
    if (ub > nth && ub > 0) exact = false;
    return top;
  };
  if (key === 'a') {
    const D = cf.dicts;
    cf.rows.forEach(([cc, s1, s2, s3, v]) => { const code = D.cc[cc]; if (sel.includes(code)) paths.push([SEA_NAMES[code], D.s1[s1], D.s2[s2], D.s3[s3], v]); });
  } else if (key === 'b') {
    const D = cf.dicts; const rows = cf.rows.filter((r) => hit(r[0]));
    const top = topBy(rows, 3, 5, cf.top_n, cf.bound);
    rows.forEach(([, s0, s1, j, s3, v]) => paths.push([D.s0[s0], D.s1[s1], top.has(j) ? cf.journals[j] : cf.other_label, D.s3[s3], v]));
  } else {
    const D = cf.dicts; const rows = cf.rows.filter((r) => hit(r[0]));
    const top = topBy(rows, 1, 5, cf.top_n, cf.bound);
    const fs = new Map(); cf.field_rank.forEach(([m, f, v]) => { if (hit(m)) fs.set(f, (fs.get(f) || 0) + v); });
    const topF = new Set([...fs.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, cf.top_fields).map((x) => x[0]));
    rows.forEach(([, f, fl, s2, s3, v]) => { if (top.has(f)) paths.push([cf.funders[f] || 'Unknown funder', topF.has(fl) ? cf.fields[fl] : 'Other fields', D.s2[s2], D.s3[s3], v]); });
  }
  const nodes = []; const index = new Map(); const links = new Map();
  paths.forEach((p) => {
    const v = p[p.length - 1]; const ks = p.slice(0, -1).map((lab, depth) => {
      const k = `${depth}\u0000${lab}`; if (!index.has(k)) { index.set(k, nodes.length); nodes.push({ name: String(lab), stage: depth }); } return index.get(k); });
    for (let i = 0; i < ks.length - 1; i += 1) { const lk = `${ks[i]}>${ks[i + 1]}`; links.set(lk, (links.get(lk) || 0) + v); }
  });
  const uniqueWorks = cf.masks.reduce((a, [m, n]) => (hit(m) ? a + n : a), 0);
  if (!exact) notes.push(`The top-${key === 'b' ? cf.top_n + ' journals' : cf.top_n + ' funders'} ranking is taken from per-country top-${cf.cand_k} candidates; for this selection a non-candidate could not be ruled out, so the ranking may be approximate.`);
  return { nodes, links: [...links.entries()].map(([k, value]) => { const [a, b] = k.split('>').map(Number); return { source: a, target: b, value }; }), uniqueWorks, exact, notes };
}

export async function render(main, [which = 'a', ccArg]) {
  const key = FLOWS[which] ? which : 'a';
  const conf = FLOWS[key];
  const [base, cf] = await Promise.all([load(conf.file), load(CFILE[key])]);
  if (ccArg !== undefined) SEL = ccArg === 'none' ? [] : ccArg === 'all' ? [...SEA] : ccArg.split(',').map((x) => x.toUpperCase()).filter((x) => SEA.includes(x));
  if (!SEL) SEL = [...SEA];
  const sel = SEA.filter((c) => SEL.includes(c));
  const all = sel.length === SEA.length;
  const built = sel.length ? buildFlow(key, cf, sel) : { nodes: [], links: [], uniqueWorks: 0, exact: true, notes: [] };
  const d = { ...base, nodes: built.nodes, links: built.links };
  const rawTotal = d.links.filter((l) => d.nodes[l.source].stage === 0).reduce((a, l) => a + l.value, 0);
  const total = rawTotal || 1;
  const state = { minPct: 0.2, focus: null };
  const selTxt = all ? 'All SEA countries' : sel.map((c) => SEA_NAMES[c]).join(', ');
  const denom = key === 'a'
    ? `Denominator: ${fmt(rawTotal)} country-attributed OA works (full counting: a work with authors from k selected countries counts k times) = ${fmt(built.uniqueWorks)} unique works.`
    : key === 'b'
      ? `Denominator: ${fmt(rawTotal)} citation links to OA works with at least one author from the selected countries (each link counted once).`
      : `Denominator: ${fmt(rawTotal)} work–funder pairs of the top ${cf.top_n} funders among OA works with at least one author from the selected countries (each work counted once per funder; ${fmt(built.uniqueWorks)} unique works in the selection overall).`;
  const scope = `${conf.label}; countries: ${selTxt}; values in ${conf.unit}`;
  main.innerHTML = `
    ${pageHead('Scholarly Research Flows', 'Explore how Southeast Asian research publications and citations are distributed across countries, scientific domains, open-access routes, journal quartiles, and research networks.')}
    <div class="scope-bar" role="group" aria-label="Flow controls">
      ${countryChips(sel)}
      <label class="field">Preset<select id="flow">${Object.entries(FLOWS).map(([k, v]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label class="field">Minimum flow (share of selected total): <output id="mout">${state.minPct}%</output><input type="range" id="minf" min="0" max="5" step="0.1" value="${state.minPct}"></label>
      <button class="btn ghost" id="clear" type="button">Clear focus</button>
      <button type="button" class="btn ghost" id="reset">Reset filters</button>
    </div>
    ${built.notes.map((n) => partialWarning(esc(n))).join('')}
    <div class="grid">
      ${panel('k-main', d.title, `${esc(d.stages.join(' → '))} · band width = ${conf.unit}; countries: ${esc(selTxt)}; click a band or node for details`, 'span-12')}
      ${panel('k-stage', 'Stage totals', `Inflow and outflow per node at each stage; shares relative to the selected total (${fmt(rawTotal)} ${esc(conf.unit)})`, 'span-12',
        `<label class="field inline">Stage<select id="stageSel">${d.stages.map((s, i) => `<option value="${i}">${i + 1}. ${esc(s)}</option>`).join('')}</select></label>`)}
      ${insight('Reading the flows', `<p>${esc(d.note)} ${esc(denom)} Column order is fixed from left to right; flows show co-occurrence of categories, not causal effects.</p>`)}
    </div>${provenance(scope, '<span id="hidden"></span>')}`;
  const ccSeg = () => (SEL.length === SEA.length ? '' : `/${SEL.length ? SEL.join(',') : 'none'}`);
  main.querySelector('#flow').addEventListener('change', (e) => { saveSel(); location.hash = `#/sankey/${e.target.value}${ccSeg()}`; });
  const rerender = () => { saveSel(); location.hash = `#/sankey/${key}${ccSeg()}`; };
  setSearchHandler({ kinds: { countries: 'show flows for this country' }, run: (k, r) => { SEL = [searchId(k, r)]; rerender(); } });
  bindCountryChips(main, (v) => { SEL = v; rerender(); });
  main.querySelector('#reset').addEventListener('click', () => { SEL = [...SEA]; rerender(); });
  const host = body(main, 'k-main');
  if (!d.nodes.length || !d.links.length) {
    host.innerHTML = emptyState(sel.length ? 'No flows match the selected countries for this preset.' : 'No country selected. Choose at least one country or reset to all.');
    body(main, 'k-stage').innerHTML = emptyState('No stage data.');
    return null;
  }
  host.innerHTML = '<div class="sankey-scroll"><div class="sankey-host"></div></div>';
  const svgHost = host.querySelector('.sankey-host');

  // stage table
  const inflow = new Map(); const outflow = new Map();
  d.links.forEach((l) => { outflow.set(l.source, (outflow.get(l.source) || 0) + l.value); inflow.set(l.target, (inflow.get(l.target) || 0) + l.value); });
  const stageRows = (si) => d.nodes.map((n, i) => ({ i, name: n.name, stage: n.stage, value: Math.max(inflow.get(i) || 0, outflow.get(i) || 0) }))
    .filter((r) => r.stage === si).map((r) => ({ ...r, share: (100 * r.value) / total }));
  const scols = [{ key: 'name', label: 'Category' }, { key: 'value', label: conf.unit, num: true, render: (r) => fmt(r.value) }, { key: 'share', label: 'Share of total (%)', num: true, render: (r) => pct(r.share, 2) }];
  const st = table(body(main, 'k-stage'), scols, stageRows(0), { pageSize: 15, sortKey: 'value', caption: 'Stage totals' });
  main.querySelector('#stageSel').addEventListener('change', (e) => st.update(stageRows(Number(e.target.value))));
  viewData(main, 'k-main', () => ({ scope: `${scope}; all flows (no threshold)`, columns: [{ key: 's', label: 'From' }, { key: 'sstage', label: 'From stage' }, { key: 't', label: 'To' },
    { key: 'tstage', label: 'To stage' }, { key: 'value', label: conf.unit, num: true }],
  rows: d.links.map((l) => ({ s: d.nodes[l.source].name, sstage: d.stages[d.nodes[l.source].stage], t: d.nodes[l.target].name, tstage: d.stages[d.nodes[l.target].stage], value: l.value })) }));
  void downloadCsv;

  const linkInfo = (l) => drawer.open({ title: `${l.source.name} → ${l.target.name}`, subtitle: `${d.stages[l.source.stage]} → ${d.stages[l.target.stage]}`,
    html: `<dl class="dl"><dt>Value</dt><dd>${fmt(l.value)} ${esc(conf.unit)}</dd><dt>Share of total</dt><dd>${pct((100 * l.value) / total, 2)}</dd>
      <dt>Share of source node</dt><dd>${pct((100 * l.value) / (l.source.value || 1), 1)}</dd><dt>Direction</dt><dd>left → right (${esc(d.stages[l.source.stage])} to ${esc(d.stages[l.target.stage])})</dd>
      <dt>Scope</dt><dd>${esc(scope)}; minimum flow ${state.minPct}%</dd></dl>` });
  const nodeInfo = (n) => drawer.open({ title: n.name, subtitle: d.stages[n.stage], html: `<dl class="dl"><dt>Total</dt><dd>${fmt(n.value)} ${esc(conf.unit)}</dd>
      <dt>Share of total</dt><dd>${pct((100 * n.value) / total, 2)}</dd></dl><h3>Outgoing</h3><ul>${n.sourceLinks.slice().sort((a, b) => b.value - a.value).map((l) => `<li>${esc(l.target.name)}: ${fmt(l.value)}</li>`).join('') || '<li>None</li>'}</ul>
      <h3>Incoming</h3><ul>${n.targetLinks.slice().sort((a, b) => b.value - a.value).map((l) => `<li>${esc(l.source.name)}: ${fmt(l.value)}</li>`).join('') || '<li>None</li>'}</ul>` });

  const draw = () => {
    const minV = (state.minPct / 100) * total;
    const kept = d.links.filter((l) => l.value >= minV);
    const hidden = d.links.filter((l) => l.value < minV);
    const used = new Set(kept.flatMap((l) => [l.source, l.target]));
    const idx = new Map([...used].sort((a, b) => a - b).map((n, i) => [n, i]));
    main.querySelector('#hidden').innerHTML = `<strong>Threshold:</strong> flows below ${state.minPct}% of total (${fmt(minV)} ${esc(conf.unit)}) hidden: ${fmt(hidden.length)} flows, ${fmt(hidden.reduce((a, l) => a + l.value, 0))} ${esc(conf.unit)} (still listed in View data)`;
    if (!kept.length) { svgHost.innerHTML = emptyState('All flows fall below the current threshold. Lower the minimum flow.'); return; }
    const width = Math.max(host.clientWidth, 900);
    const height = Math.max(480, Math.min(1000, idx.size * 18));
    const { sankey, sankeyLinkHorizontal } = window.d3;
    const graph = sankey().nodeWidth(14).nodePadding(9).nodeSort(null).extent([[1, 26], [width - 1, height - 6]])({
      nodes: [...idx.keys()].map((k) => ({ ...d.nodes[k], orig: k })),
      links: kept.map((l) => ({ source: idx.get(l.source), target: idx.get(l.target), value: l.value })) });
    graph.nodes.forEach((n) => { n.color = nodeColor(n, n.orig); });
    const svg = window.d3.create('svg').attr('viewBox', [0, 0, width, height]).attr('width', width).attr('role', 'img').attr('aria-label', `${d.title}. Use the stage table below for an accessible alternative.`);
    const stageX = d.stages.map((s, i) => { const n = graph.nodes.find((x) => x.stage === i); return n ? n.x0 : 0; });
    svg.append('g').selectAll('text').data(d.stages).join('text').attr('class', 'stage-label')
      .attr('x', (s, i) => (i === d.stages.length - 1 ? stageX[i] + 14 : stageX[i])).attr('y', 14)
      .attr('text-anchor', (s, i) => (i === d.stages.length - 1 ? 'end' : 'start')).text((s) => s);
    const link = svg.append('g').selectAll('path').data(graph.links).join('path').attr('class', 'link')
      .attr('d', sankeyLinkHorizontal()).attr('stroke', (l) => l.source.color).attr('stroke-width', (l) => Math.max(1, l.width))
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', (l) => `${l.source.name} to ${l.target.name}: ${fmt(l.value)} ${conf.unit}`)
      .on('mousemove', (e, l) => showTip(e, `${esc(l.source.name)} → ${esc(l.target.name)}<br><strong>${fmt(l.value)}</strong> ${esc(conf.unit)} · ${pct((100 * l.value) / total, 2)} of total`))
      .on('mouseleave', hideTip).on('click', (e, l) => linkInfo(l)).on('keydown', (e, l) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); linkInfo(l); } });
    svg.append('g').selectAll('rect').data(graph.nodes).join('rect')
      .attr('x', (n) => n.x0).attr('y', (n) => n.y0).attr('height', (n) => Math.max(1, n.y1 - n.y0)).attr('width', (n) => n.x1 - n.x0)
      .attr('fill', (n) => n.color).style('cursor', 'pointer').attr('tabindex', 0).attr('role', 'button').attr('aria-label', (n) => `${n.name}: ${fmt(n.value)} ${conf.unit}`)
      .on('mousemove', (e, n) => showTip(e, `<strong>${esc(n.name)}</strong><br>${fmt(n.value)} ${esc(conf.unit)} · ${pct((100 * n.value) / total, 2)}`)).on('mouseleave', hideTip)
      .on('click', (e, n) => {
        const keep = new Set(); const walk = (x, dir) => { (dir > 0 ? x.sourceLinks : x.targetLinks).forEach((l) => { keep.add(l); walk(dir > 0 ? l.target : l.source, dir); }); };
        walk(n, 1); walk(n, -1); link.attr('stroke-opacity', (l) => (keep.has(l) ? 0.6 : 0.05)); nodeInfo(n);
      }).on('keydown', (e, n) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nodeInfo(n); } });
    svg.append('g').selectAll('text').data(graph.nodes.filter((n) => n.y1 - n.y0 > 7)).join('text').attr('class', 'node-label')
      .attr('x', (n) => (n.x0 < width / 2 ? n.x1 + 6 : n.x0 - 6)).attr('y', (n) => (n.y0 + n.y1) / 2).attr('dy', '0.35em')
      .attr('text-anchor', (n) => (n.x0 < width / 2 ? 'start' : 'end')).text((n) => `${n.name.length > 46 ? `${n.name.slice(0, 44)}…` : n.name} (${fmt(n.value)})`);
    svgHost.replaceChildren(svg.node());
    main.querySelector('#clear').onclick = () => link.attr('stroke-opacity', null);
  };
  draw();
  const minf = main.querySelector('#minf');
  minf.addEventListener('change', () => { state.minPct = Number(minf.value); main.querySelector('#mout').textContent = `${state.minPct}%`; draw(); });
  minf.addEventListener('input', () => { main.querySelector('#mout').textContent = `${minf.value}%`; });
  let t;
  const onResize = () => { clearTimeout(t); t = setTimeout(draw, 200); };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}
