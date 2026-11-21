/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// 6.3 Network Explorer: dark full-bleed canvas, filters left, details right, accessible list fallback.
import { load, esc, fmt, badge, oaLink, SEA, SEA_NAMES, OA_LABEL, pageHead, provenance, table, downloadCsv , workUrl, journalUrl, instUrl, authorUrl, extLink, countryChips, bindCountryChips, setCountryChips, csvName } from '../lib.js';
import { doajBadge, inDoaj } from '../lib.js';
import { openProfile } from '../lib.js';
import { setSearchHandler, searchId } from '../lib.js';
import { renderNetwork, legendHtml, metricsHtml, fold, rankMatch } from '../network.js';

const TYPES = {
  journals: { label: 'Bibliographic coupling (journals)', unit: 'Journal', colors: ['cluster', 'quartile', 'country'], sizes: ['works', 'cites', 'sjr'], prefix: 'S' },
  papers: { label: 'Coupling & direct citation (papers)', unit: 'Publication', colors: ['cluster', 'quartile', 'country', 'oa_status'], sizes: ['cited_by', 'fwci'], prefix: 'W', time: true },
  cocitation: { label: 'Co-citation (cited references)', unit: 'Cited reference', colors: ['cluster'], sizes: ['cocited_by'], prefix: 'W', time: true },
  coauthor: { label: 'Co-authorship (experts)', unit: 'Author', colors: ['cluster', 'country'], sizes: ['h', 'works', 'cites'], prefix: 'A' },
  institutions: { label: 'Institutional collaboration', unit: 'Institution', colors: ['cluster', 'country'], sizes: ['works'], prefix: 'I' },
};
const LABEL = { cluster: 'Cluster (Louvain)', quartile: 'SJR quartile', country: 'Country', oa_status: 'OA route', works: 'Document count',
  cites: 'Citation count', sjr: 'SJR score', cited_by: 'Citation count', fwci: 'FWCI', cocited_by: 'Co-citing SEA works', h: 'h-index (subfield)' };

export async function render(main, [type = 'journals', subArg = '', qKey = '', qVal = '', qName = '']) {
  const sub = subArg === '_' ? '' : subArg;
  const t = TYPES[type] ? type : 'journals';
  const conf = TYPES[t];
  let subList = [];
  if (t === 'papers') subList = await load('networks/subfields_index.json');
  if (t === 'cocitation') subList = await load('networks/cocitation_index.json');
  if (t === 'coauthor') subList = (await load('experts/index.json')).subfields.map((s) => ({ id: s.id, name: s.name }));
  subList = subList.slice().sort((a, b) => String(a.name).localeCompare(b.name));
  const ALL_LABEL = { papers: 'All subfields', cocitation: 'All fields', coauthor: 'All subjects' }[t];
  if (ALL_LABEL && subList.length) subList.unshift({ id: 'all', name: ALL_LABEL });
  const subId = subList.length ? (subList.find((s) => String(s.id) === sub) ? sub : String(subList[0].id)) : '';
  const file = { journals: 'networks/journal_coupling.json', institutions: 'networks/institution_collaboration.json', papers: `networks/coupling_${subId}.json`,
    cocitation: `networks/cocitation_${subId}.json`, coauthor: `networks/coauthor_${subId}.json` }[t];
  const data = await load(file);
  const weights = data.edges.map((e) => e[2]).sort((a, b) => a - b);
  const wMax = weights.length ? weights[weights.length - 1] : 0;
  const years = data.nodes.map((n) => n.year).filter(Boolean);
  const yMin = years.length ? Math.min(...years) : null; const yMax = years.length ? Math.max(...years) : null;
  const countries = [...new Set(data.nodes.map((n) => n.country).filter(Boolean))].sort();
  const subLabel = t === 'cocitation' ? 'Field' : 'Subfield';

  main.innerHTML = `
    ${pageHead('Network Explorer', 'Which clusters and relationships appear in the citation, coupling, co-citation and co-authorship structure of SEA open-access research?')}
    <div class="scope-bar" role="group" aria-label="Country filter">${countryChips(SEA)}<button type="button" class="btn ghost" id="ccreset">Reset filters</button>${countries.length ? '' : '<p class="note" style="flex-basis:100%;margin:0">Not available for this network: its nodes are cited references (any country, any year), so they have no SEA country. Choose another network type to filter by country.</p>'}</div>
    <div class="net-shell png-target" id="shell" data-title="${esc(data.meta.title)}">
      <aside class="side" aria-label="Network filters">
        <h2>Filters</h2>
        <label class="field">Network type<select id="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <div class="field">Unit<span style="font-weight:600">${esc(conf.unit)}</span></div>
        ${subList.length ? `<label class="field">${subLabel}<select id="sub">${subList.map((s) => `<option value="${s.id}" ${String(s.id) === subId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
        ${conf.time && yMin ? `<div class="field">Time range (publication year)<span style="display:flex;gap:6px"><input type="number" id="y0" value="${yMin}" min="${yMin}" max="${yMax}" aria-label="From year" style="min-width:0;width:50%">
          <input type="number" id="y1" value="${yMax}" min="${yMin}" max="${yMax}" aria-label="To year" style="min-width:0;width:50%"></span></div>` : ''}
        <label class="field">Minimum link strength: <output id="wout">0</output><input type="range" id="minw" min="0" max="${wMax || 1}" step="${(wMax || 1) / 100}" value="0" ${weights.length ? '' : 'disabled'}></label>
        <label class="field">Node size<select id="size">${conf.sizes.map((c) => `<option value="${c}">${LABEL[c]}</option>`).join('')}</select></label>
        <label class="field">Node colour<select id="color">${conf.colors.map((c) => `<option value="${c}">${LABEL[c]}</option>`).join('')}</select></label>
        <label class="field">Search entity<input type="search" id="q" placeholder="Name or title…"></label><div id="hits"></div>
        <div class="seg" role="group" aria-label="View mode" style="margin:4px 0 10px"><button type="button" aria-pressed="true" data-v="network">Network</button><button type="button" aria-pressed="false" data-v="density">Density</button>${data.citations ? '<button type="button" aria-pressed="false" data-v="cite">Citations</button>' : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ghost small" id="reset" type="button">Reset view</button><button class="btn ghost small" id="clear" type="button">Reset filters</button>
          <button class="btn ghost small" id="fs" type="button" aria-pressed="false">Open full-screen explorer</button></div>
        <h3>Legend</h3><div class="legend" id="legend"></div>
      </aside>
      <div class="net-stage" id="stage"></div>
      <aside class="side" aria-label="Network details">
        <h2>${esc(data.meta.title)}</h2>
        ${metricsHtml(data.meta)}
        <p class="note" id="active"></p>
        <h3>Selected item</h3><div class="info" id="info"><p class="note">Click a circle on the map, hold Shift and drag to select an area, or pick a name from the list below.</p></div>
        <h3>${esc(conf.unit === 'Publication' ? 'Publications' : conf.unit + 's')} on this map</h3><p class="note" style="margin:0 0 6px">Largest first; click a name to find it on the map.</p><ul class="node-list" id="nlist"></ul>
        <div class="png-tools" hidden><button class="btn ghost small" id="csv" type="button" hidden>Download nodes &amp; links (CSV)</button></div>
      </aside>
    </div>
    ${provenance(`${esc(conf.label)}${subId ? `; ${subLabel.toLowerCase()}: ${esc((subList.find((s) => String(s.id) === subId) || {}).name || '')}` : ''}`, '<span><strong>Layout:</strong> ForceAtlas2, Louvain communities, strongest links kept per node</span>')}`;

  const go = (ty, s) => { location.hash = `#/networks/${ty}${s ? `/${s}` : ''}`; };
  main.querySelector('#type').addEventListener('change', (e) => go(e.target.value, ''));
  main.querySelector('#sub')?.addEventListener('change', (e) => go(t, e.target.value));
  const info = main.querySelector('#info'); const legend = main.querySelector('#legend'); const nlist = main.querySelector('#nlist');
  const label = (id) => (data.nodes.find((n) => String(n.id) === String(id)) || {}).label || id;
  const describe = (a, nb = []) => {
    const rows = [];
    if (a.quartile) rows.push(['SJR quartile', badge(a.quartile)]);
    if (a.country) rows.push(['Country', esc(SEA_NAMES[a.country] || a.country)]);
    if (a.journal) rows.push(['Journal', esc(a.journal)]);
    if (a.inst) rows.push(['Institution', esc(a.inst)]);
    if (a.year) rows.push(['Year', esc(a.year)]);
    if (a.oa_status) rows.push(['OA route', esc(OA_LABEL[a.oa_status] || a.oa_status)]);
    ['works', 'cites', 'cited_by', 'cocited_by', 'h'].forEach((k) => { if (a[k] !== undefined && a[k] !== null) rows.push([LABEL[k], fmt(a[k])]); });
    if (a.fwci !== undefined && a.fwci !== null) rows.push(['FWCI', fmt(a.fwci, 2)]);
    if (a.sjr) rows.push(['SJR score', fmt(a.sjr, 3)]);
    rows.push(['Cluster', `Cluster ${(a.cluster ?? 0) + 1}`]);
    const href = conf.prefix === 'W' ? workUrl(a) : conf.prefix === 'S' ? journalUrl(a) : conf.prefix === 'I' ? instUrl(a) : authorUrl({ ...a, author: a.id });
    return `<p><strong>${extLink(href, esc(a.label))}</strong>${conf.prefix === 'S' ? doajBadge(a.id) : ''}${a.doi ? `<br><small>${esc(a.doi.replace('https://doi.org/', 'DOI '))}</small>` : ''}</p>
      <dl class="metrics">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <p><button type="button" class="btn small" data-profile="${esc(String(a.id))}">Open full profile</button></p>
      <p class="note">${fmt(nb.length)} linked items</p><ul class="node-list">${nb.slice(0, 30).map((x) => `<li><button type="button" data-id="${x.id}">${esc(x.label)}</button></li>`).join('')}</ul>`;
  };

  const notHere = (nm) => `<p class="note"><strong>${esc(nm)}</strong> is not in this network: the map shows only the ${esc(conf.unit.toLowerCase())}s selected for it${subList.length ? ` (this ${subLabel.toLowerCase()})` : ''}. Try another network type or ${subList.length ? subLabel.toLowerCase() : 'filter'}.</p>`;
  // In-network search feedback: number of matches and a clickable list (best match is focused by the canvas).
  function showHits(hits, q) {
    const box = main.querySelector('#hits'); if (!box) return;
    if (!String(q || '').trim()) { box.innerHTML = ''; return; }
    box.innerHTML = hits.length
      ? `<p class="note">${fmt(hits.length)} match${hits.length > 1 ? 'es' : ''} on this map${hits.length > 1 ? ' (best match focused)' : ''}</p>${hits.length > 1 ? `<ul class="node-list">${hits.slice(0, 30).map((x) => `<li><button type="button" data-id="${x.id}">${esc(x.label)}</button></li>`).join('')}</ul>` : ''}`
      : `<p class="note">Nothing on this map matches “${esc(q)}”${state.ccs.length < SEA.length || state.minW ? ' with the current filters' : ''}.</p>`;
  }
  let ctl = null;
  const state = { ccs: [...SEA], y0: yMin, y1: yMax, minW: 0, sizeBy: conf.sizes[0] };
  function keep(a) {
    if (countries.length && state.ccs.length < SEA.length && !state.ccs.includes(a.country)) return false;
    if (conf.time && yMin && a.year && (a.year < state.y0 || a.year > state.y1)) return false;
    return true;
  }
  function refreshList() {
    const vis = data.nodes.filter(keep).slice().sort((a, b) => (b[state.sizeBy] || 0) - (a[state.sizeBy] || 0));
    nlist.innerHTML = vis.slice(0, 80).map((n) => `<li><button type="button" data-id="${n.id}">${esc(n.label)} <small>(${fmt(n[state.sizeBy])})</small></button></li>`).join('')
      || '<li class="note">Nothing on this map matches the current filters.</li>';
    const active = [`min. link strength ≥ ${state.minW.toFixed(3)}`];
    if (countries.length && state.ccs.length < SEA.length) active.push(`countries = ${state.ccs.map((c) => SEA_NAMES[c]).join(', ') || 'none'}`);
    if (conf.time && yMin) active.push(`years ${state.y0}–${state.y1}`);
    main.querySelector('#active').textContent = `Active filters: ${active.join('; ')} · items shown ${fmt(vis.length)}${ctl ? ` · visible links ${fmt(ctl.visibleEdges())}` : ''}`;
  }
  const stage = main.querySelector('#stage');
  try {
    ctl = renderNetwork(stage, data, { colorBy: 'cluster', sizeBy: conf.sizes[0],
      onSelect: (a, nb) => { info.innerHTML = a ? describe(a, nb) : '<p class="note">Click a circle on the map, hold Shift and drag to select an area, or pick a name from the list below.</p>'; },
      onBox: (sel) => {
        const cl = new Map(); sel.forEach((x) => cl.set(x.cluster, (cl.get(x.cluster) || 0) + 1));
        info.innerHTML = `<p><strong>${fmt(sel.length)} items selected</strong></p><p class="note">${[...cl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `Cluster ${c + 1}: ${n}`).join(' · ')}</p>
          <ul class="node-list">${sel.slice(0, 40).map((x) => `<li><button type="button" data-id="${x.id}">${esc(x.label)}</button></li>`).join('')}</ul>`;
      } });
    if (qVal && ctl) {
      const node = qKey === 'id' ? data.nodes.find((n) => String(n.id) === qVal) : null;
      if (node) { main.querySelector('#q').value = node.label; showHits(ctl.search(node.label), node.label); ctl.focusNode(node.id); }
      else if (qKey === 'q') { main.querySelector('#q').value = qVal; const h = ctl.search(qVal); showHits(h, qVal); if (!h.length) info.innerHTML = notHere(qVal); }
      else info.innerHTML = notHere(qName || qVal);
    }
  } catch (e) {
    // Accessible non-canvas fallback: top nodes and strongest relationships as tables.
    stage.style.background = 'var(--soa-surface)';
    stage.innerHTML = '<div style="padding:16px;color:var(--soa-text)"><p><strong>Interactive canvas unavailable (WebGL not supported).</strong> Showing the network as tables.</p><div id="fbn"></div><h3>Strongest relationships</h3><div id="fbe"></div></div>';
    table(stage.querySelector('#fbn'), [{ key: 'label', label: conf.unit }, { key: 'cluster', label: 'Cluster', num: true, render: (r) => (r.cluster ?? 0) + 1 },
      { key: state.sizeBy, label: LABEL[state.sizeBy], num: true, render: (r) => fmt(r[state.sizeBy]) }], data.nodes, { pageSize: 15, sortKey: state.sizeBy, caption: 'Network nodes' });
    table(stage.querySelector('#fbe'), [{ key: 'a', label: 'From' }, { key: 'b', label: 'To' }, { key: 'w', label: 'Link strength', num: true, render: (r) => fmt(r.w, 3) }],
      data.edges.map(([a, b, w]) => ({ a: label(a), b: label(b), w })), { pageSize: 15, sortKey: 'w', caption: 'Strongest relationships' });
  }
  const drawLegend = (by) => { legend.innerHTML = legendHtml(data.nodes, by); };
  drawLegend('cluster');
  refreshList();
  const PK = { S: 'journal', I: 'institution', A: 'author', W: 'work' };
  const onPick = (e) => {
    const pb = e.target.closest('button[data-profile]');
    if (pb) { const a = data.nodes.find((n) => String(n.id) === pb.dataset.profile) || {}; openProfile(PK[conf.prefix], { ...a, id: a.id, name: a.label }); return; }
    const b = e.target.closest('button[data-id]'); if (b && ctl) ctl.focusNode(b.dataset.id);
  };
  nlist.addEventListener('click', onPick); info.addEventListener('click', onPick); main.querySelector('#hits').addEventListener('click', onPick);
  main.querySelector('#color').addEventListener('change', (e) => { if (ctl) ctl.setColor(e.target.value); drawLegend(e.target.value); });
  main.querySelector('#size').addEventListener('change', (e) => { state.sizeBy = e.target.value; if (ctl) ctl.setSize(e.target.value); refreshList(); });
  const minw = main.querySelector('#minw');
  minw.addEventListener('input', () => { state.minW = Number(minw.value); main.querySelector('#wout').textContent = state.minW.toFixed(3); if (ctl) ctl.setMinWeight(state.minW); refreshList(); });
  if (!countries.length) main.querySelectorAll('#cchips .chip').forEach((b) => { b.disabled = true; b.setAttribute('aria-disabled', 'true'); });
  bindCountryChips(main, (v) => { state.ccs = v; if (ctl) ctl.setFilter(keep); refreshList(); });
  ['#y0', '#y1'].forEach((s) => main.querySelector(s)?.addEventListener('change', () => {
    state.y0 = Number(main.querySelector('#y0').value) || yMin; state.y1 = Number(main.querySelector('#y1').value) || yMax;
    if (ctl) ctl.setFilter(keep); refreshList();
  }));
  let timer;
  main.querySelector('#q').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { if (ctl) showHits(ctl.search(e.target.value), e.target.value); }, 250); });
  main.querySelector('.seg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !ctl) return;
    main.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ctl.setDensity(b.dataset.v === 'density'); ctl.toggleDirected(b.dataset.v === 'cite');
  });
  main.querySelector('#reset').addEventListener('click', () => { main.querySelector('#q').value = ''; showHits([], ''); if (ctl) ctl.reset(); });
  // Global (top bar) search on this tab. Entities already on the open map are focused in place (matched by
  // OpenAlex id, or exact name for institutions); otherwise the matching map is opened and the node focused.
  const focusHere = (node) => { main.querySelector('#q').value = node.label; showHits(ctl.search(node.label), node.label); ctl.focusNode(node.id);
    main.querySelector('#shell').scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const byId = (id) => data.nodes.find((n) => String(n.id) === String(id));
  const byName = (nm) => data.nodes.find((n) => fold(n.label) === fold(nm));
  const openAt = (ty, sf, id, nm) => { location.hash = `#/networks/${ty}/${sf || '_'}/${id ? 'id' : 'q'}/${encodeURIComponent(id || nm)}${id ? `/${encodeURIComponent(nm)}` : ''}`; };
  setSearchHandler({
    kinds: { here: `focus on this map (${conf.unit.toLowerCase()})`, journals: 'locate in journal network', institutions: 'locate in institution network',
      authors: 'locate in co-authorship network', topics: 'open this subfield’s network', ...(countries.length ? { countries: 'filter the map by country' } : {}) },
    // nodes of the open map that match the query (shown first by the top-bar search, as "On this map")
    extra: (q) => { const nq = fold(q); if (!ctl || nq.length < 2) return [];
      return data.nodes.map((n) => [rankMatch(n.label, nq), n]).filter((x) => x[0] < 4).sort((x, y) => x[0] - y[0] || (y[1][state.sizeBy] || 0) - (x[1][state.sizeBy] || 0))
        .slice(0, 6).map(([, n]) => ({ n: n.label, d: [n.year, n.journal || n.inst || (n.country && SEA_NAMES[n.country])].filter(Boolean).join(' · '), h: `#/networks/${t}/${subId || '_'}/id/${n.id}`, id: n.id })); },
    run: async (k, r) => {
      if (k === 'here') { const n = byId(r.id); if (n && ctl) focusHere(n); return; }
      if (k === 'countries') { const cc = searchId(k, r); state.ccs = [cc]; setCountryChips(main, [cc]); if (ctl) ctl.setFilter(keep); refreshList(); return; }
      if (k === 'topics') {
        const sf = searchId(k, r);
        if (t === 'coauthor') { location.hash = `#/networks/coauthor/${sf}`; return; }
        const idx = await load('networks/subfields_index.json');
        location.hash = idx.some((x) => String(x.id) === String(sf)) ? `#/networks/papers/${sf}` : `#/networks/coauthor/${sf}`; return;
      }
      const id = k === 'journals' || k === 'authors' ? searchId(k, r) : null;
      const want = { journals: 'journals', institutions: 'institutions', authors: 'coauthor' }[k];
      const node = want === t ? (id ? byId(id) : byName(r.n)) : null;
      if (node && ctl) { focusHere(node); return; }
      if (k === 'journals') openAt('journals', '', id, r.n);
      else if (k === 'institutions') openAt('institutions', '', null, r.n);
      else openAt('coauthor', String(r.h).split('/')[2], id, r.n);
    } });
  main.querySelector('#ccreset').addEventListener('click', () => main.querySelector('#clear').click());
  main.querySelector('#clear').addEventListener('click', () => {
    state.ccs = [...SEA]; state.minW = 0; state.y0 = yMin; state.y1 = yMax;
    setCountryChips(main, SEA); minw.value = '0'; main.querySelector('#wout').textContent = '0';
    if (main.querySelector('#y0')) { main.querySelector('#y0').value = yMin; main.querySelector('#y1').value = yMax; }
    if (ctl) { ctl.setFilter(keep); ctl.setMinWeight(0); }
    refreshList();
  });
  const shell = main.querySelector('#shell'); const fsBtn = main.querySelector('#fs');
  const setFs = (on) => { shell.classList.toggle('fs', on); fsBtn.setAttribute('aria-pressed', String(on)); fsBtn.textContent = on ? 'Exit full screen' : 'Open full-screen explorer'; setTimeout(() => ctl && ctl.resize(), 50); };
  fsBtn.addEventListener('click', () => setFs(!shell.classList.contains('fs')));
  const onKey = (e) => { if (e.key === 'Escape' && shell.classList.contains('fs')) setFs(false); };
  document.addEventListener('keydown', onKey);
  main.querySelector('#csv').addEventListener('click', () => {
    const rows = data.edges.filter((e) => e[2] >= state.minW).map(([a, b, w]) => ({ from_id: a, from: label(a), to_id: b, to: label(b), strength: w }));
    const ttl = `${data.meta.title}${subId ? ` – ${(subList.find((x) => String(x.id) === String(subId)) || {}).name || subId}` : ''} (links)`;
    downloadCsv(csvName(ttl), [{ key: 'from_id', label: 'From ID' }, { key: 'from', label: 'From' }, { key: 'to_id', label: 'To ID' },
      { key: 'to', label: 'To' }, { key: 'strength', label: `Link strength (${data.meta.normalization || ''})` }], rows, `${conf.label}; min strength ${state.minW}`, ttl);
  });
  return () => { document.removeEventListener('keydown', onKey); if (ctl) ctl.destroy(); };
}
void SEA;
