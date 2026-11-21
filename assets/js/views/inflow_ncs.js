/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Normalized Citation Impact: OA vs. non-OA (section of the Citation Inflow page).
// All numbers come from web/data/inflow/ncs_summary.json and inflow/ncs/cube_*.json (scripts/build_ncs.py).
import { sumCubes } from './ncs_agg.js';
import { load, tryLoad, esc, fmt, pct, kpis, bindKpiDefs, table, chart, canvasIn, css, panel, body, viewData, SEA, SEA_NAMES, emptyState } from '../lib.js';

const r2 = (v) => (v === null || v === undefined ? 'Not available' : fmt(v, 2));
const ciTxt = (ci) => (ci ? `95% CI ${fmt(ci[0], 2)}–${fmt(ci[1], 2)}` : 'CI not computed');
const ratioTxt = (v) => (v === null || v === undefined ? 'Not available' : `${fmt(v, 2)}×`);

/** Reference line at value 1 on the value axis. */
const refLine = (axis) => ({ id: 'ref1', afterDatasetsDraw(c) {
  const s = c.scales[axis]; if (!s) return; const p = s.getPixelForValue(1); const { ctx, chartArea: a } = c;
  ctx.save(); ctx.strokeStyle = css('--soa-text-muted') || '#667085'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.beginPath();
  if (axis === 'y') { ctx.moveTo(a.left, p); ctx.lineTo(a.right, p); } else { ctx.moveTo(p, a.top); ctx.lineTo(p, a.bottom); }
  ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle; ctx.font = '11px sans-serif';
  if (axis === 'y') ctx.fillText('parity = 1.00', a.right - 76, p - 4); else ctx.fillText('parity = 1.00', p + 4, a.top + 10);
  ctx.restore(); } });
/** 95% CI whiskers for one dataset; cis[i] = [lo, hi] or null. */
const whiskers = (di, cis, horizontal) => ({ id: `ci${di}`, afterDatasetsDraw(c) {
  const meta = c.getDatasetMeta(di); if (meta.hidden) return; const vs = c.scales[horizontal ? 'x' : 'y']; const { ctx } = c;
  ctx.save(); ctx.strokeStyle = '#24313a'; ctx.lineWidth = 1.3;
  meta.data.forEach((b, i) => { const ci = cis[i]; if (!ci) return; const p0 = vs.getPixelForValue(ci[0]); const p1 = vs.getPixelForValue(ci[1]); const cap = 4;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(p0, b.y); ctx.lineTo(p1, b.y); ctx.moveTo(p0, b.y - cap); ctx.lineTo(p0, b.y + cap); ctx.moveTo(p1, b.y - cap); ctx.lineTo(p1, b.y + cap); }
    else { ctx.moveTo(b.x, p0); ctx.lineTo(b.x, p1); ctx.moveTo(b.x - cap, p0); ctx.lineTo(b.x + cap, p0); ctx.moveTo(b.x - cap, p1); ctx.lineTo(b.x + cap, p1); }
    ctx.stroke(); });
  ctx.restore(); } });

export async function renderNcs(main, host, sel = SEA) {
  const S = await tryLoad('inflow/ncs_summary.json');
  if (!S) { host.innerHTML = `<section class="panel span-12"><div class="panel-head"><div><h2>Normalized Citation Impact: OA vs. Non-OA</h2></div></div><div class="panel-body">${emptyState('Normalized citation data have not been built yet (run scripts/build_ncs.py).')}</div></section>`; return; }
  const OA = css('--soa-access-open') || '#0f766e'; const NON = css('--soa-access-closed') || '#b42318';
  const fieldName = (id) => S.fields[String(id)] || `Field ${id}`;
  let win = 'w3';
  host.innerHTML = `
    <div class="ncs-head span-12"><div><h2 class="sec-title">Normalized Citation Impact: OA vs. Non-OA</h2>
      <p class="sub"><em>Citation comparisons adjusted for publication year, research field, and document type.</em></p></div>
      <div class="field inline">Citation window <div class="seg" role="group" aria-label="Citation observation window" id="ncs-win">
        ${Object.entries(S.windows).map(([k, w]) => `<button type="button" data-w="${k}" aria-pressed="${k === win}">${esc(w.label)}</button>`).join('')}</div></div></div>
    ${S.validation && !S.validation.all_pass ? `<div class="warn span-12" role="note"><strong>Validation incomplete.</strong> <span>${S.validation.tests.filter((t) => !t.pass).map((t) => esc(t.name)).join('; ')} — figures below must not be cited until all checks pass.</span></div>` : ''}
    <div class="span-12" id="ncs-kpis"></div>
    ${panel('n-a', 'Raw vs. normalized citation ratio', 'OA ÷ non-OA for the same normalized works; dashed line = parity (1.00)', 'span-5')}
    ${panel('n-b', 'Normalized citation impact by publication year', 'Mean NCS of OA and non-OA works per publication cohort', 'span-7',
      '<label class="field inline">From <select id="nb-from"></select></label><label class="field inline">to <select id="nb-to"></select></label>')}
    ${panel('n-c', 'Normalized citation impact by research field', 'Normalized OA/non-OA ratio per OpenAlex field (primary topic), with 95% bootstrap CI', 'span-12',
      '<input type="search" id="nc-q" placeholder="Filter fields…" aria-label="Filter fields"><label class="field inline">Sort <select id="nc-sort"><option value="ncr">Normalized ratio</option><option value="n">OA works</option><option value="name">Field name</option></select></label>')}
    ${panel('n-d', 'Country-level normalized citation comparison', 'Full counting: a work co-authored by two SEA countries counts for both; rows are not additive', 'span-7')}
    ${panel('n-e', 'Normalized citation impact by document type', 'Mean NCS by OpenAlex work type (grouped for display; baselines use the raw type)', 'span-5')}
    ${panel('n-f', 'Within venue tier: OA vs. non-OA', 'Mean NCS by SJR 2025 quartile of the publishing venue — compares OA and non-OA works published in venues of the same tier', 'span-12')}
    ${panel('n-t', 'OA vs. Non-OA Citation Comparison', 'Interactive comparison for a selected population', 'span-12')}
    <section class="insight span-12" aria-label="Interpretation of normalized results" id="ncs-int"></section>
    <details class="def span-12" id="ncs-meth"><summary>Method and data provenance (normalized citation impact)</summary><div></div></details>`;

  const draw = () => {
    const W = S.windows[win];
    const o = W.overall;
    const ra = S.raw_all;
    const covAll = (k) => (100 * o[k].n_norm) / (ra[k].n || 1);
    // ---------------- KPI cards
    const items = [
      { label: 'Raw citation ratio', value: ratioTxt(ra.ratio), sub: `${fmt(ra.oa.cpw, 2)} ÷ ${fmt(ra.non.cpw, 2)} citations per work · all SEA works, cumulative`,
        def: `Average citations per OA work ÷ average citations per non-OA work. Numerator: ${fmt(ra.oa.cites)} citations ÷ ${fmt(ra.oa.n)} OA works. Denominator: ${fmt(ra.non.cites)} citations ÷ ${fmt(ra.non.n)} non-OA works. Citation links counted in the ${S.snapshot} snapshot, no time window, no adjustment for field, year or type (same basis as the CAR card above).` },
      { label: 'Normalized citation ratio', value: ratioTxt(o.ncr), sub: `${esc(W.label)} · ${ciTxt(o.ci)}`,
        def: `Mean NCS (OA) ÷ Mean NCS (non-OA) = ${r2(o.oa.mean_ncs)} ÷ ${r2(o.non.mean_ncs)}. NCS = citations of a work ÷ mean citations of all SEA works (OA and non-OA together) with the same publication year, OpenAlex subfield (or field) and document type. ${W.desc} 95% interval: publication-level Poisson bootstrap, ${S.bootstrap.replicates} replicates, baselines held fixed. Not an official FWCI/CNCI.` },
      { label: 'Mean normalized citation score', value: `${r2(o.oa.mean_ncs)} / ${r2(o.non.mean_ncs)}`, sub: 'OA / non-OA (1.00 = SEA reference average)',
        def: `Average NCS over normalized works: OA ${fmt(o.oa.n_norm)} works, non-OA ${fmt(o.non.n_norm)} works. Because baselines are computed on the combined population, the citation-weighted average over both groups equals 1.` },
      { label: 'Normalization coverage', value: `${pct(covAll('oa'), 1)} / ${pct(covAll('non'), 1)}`, sub: `OA ${fmt(o.oa.n_norm)} of ${fmt(ra.oa.n)} · non-OA ${fmt(o.non.n_norm)} of ${fmt(ra.non.n)}`,
        def: `Share of ALL SEA works (OA / non-OA) that received an NCS in this window. Excluded: works outside cohorts ${W.y0}–${W.y1} (OA ${fmt(W.excluded_out_of_period.oa)}, non-OA ${fmt(W.excluded_out_of_period.non)}), works without field or type, works in reference cells with fewer than ${S.min_n} works at both subfield and field level, and works in cells whose mean citation count is 0.` },
    ];
    const kh = main.querySelector('#ncs-kpis'); kh.innerHTML = kpis(items); bindKpiDefs(kh, items);

    // ---------------- Chart A
    const aCis = [null, o.ci, W.tier_standardized.ci];
    const aBox = canvasIn(body(main, 'n-a'), '', 'Bar chart comparing raw and normalized OA/non-OA citation ratios');
    chart(aBox, { type: 'bar', plugins: [refLine('y'), whiskers(0, aCis, false)],
      data: { labels: ['Raw citation ratio', 'Normalized citation ratio', 'Venue-tier standardized'], datasets: [{ label: 'OA ÷ non-OA', data: [o.raw_ratio_norm, o.ncr, W.tier_standardized.ratio], backgroundColor: ['#94a3b8', OA, '#0369a1'] }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (x) => (x.dataIndex === 2 ? ciTxt(W.tier_standardized.ci) : x.dataIndex ? ciTxt(o.ci) : `citations per work ${fmt(o.oa.norm_cpw, 2)} ÷ ${fmt(o.non.norm_cpw, 2)}`) } } },
        scales: { y: { beginAtZero: true, suggestedMax: Math.max(1.2, (o.ci || [0, 0])[1] * 1.1, (W.tier_standardized.ci || [0, 0])[1] * 1.1), title: { display: true, text: 'OA ÷ non-OA (1 = parity)' } } } } });
    const an = document.createElement('p'); an.className = 'note';
    an.textContent = `Both bars use the same ${fmt(o.oa.n_norm + o.non.n_norm)} normalized works (${W.label.toLowerCase()}). Dashboard-wide raw ratio (all works, cumulative): ${ratioTxt(ra.ratio)}. Venue-tier standardized: within-tier means weighted by each tier's share of normalized works.`;
    body(main, 'n-a').appendChild(an);
    viewData(main, 'n-a', () => ({ scope: W.label, columns: [{ key: 'm', label: 'Measure' }, { key: 'v', label: 'OA ÷ non-OA', num: true }, { key: 'lo', label: 'CI low', num: true }, { key: 'hi', label: 'CI high', num: true }],
      rows: [{ m: 'Raw citation ratio (normalized works)', v: o.raw_ratio_norm }, { m: 'Normalized citation ratio', v: o.ncr, lo: o.ci?.[0], hi: o.ci?.[1] }, { m: 'Venue-tier standardized ratio', v: W.tier_standardized.ratio, lo: W.tier_standardized.ci?.[0], hi: W.tier_standardized.ci?.[1] }, { m: 'Raw citation ratio (all SEA works, cumulative)', v: ra.ratio }] }));

    // ---------------- Chart B
    const yrs = W.by_year.map((r) => r.year);
    const fSel = main.querySelector('#nb-from'); const tSel = main.querySelector('#nb-to');
    const opts = (v) => yrs.map((y) => `<option value="${y}" ${y === v ? 'selected' : ''}>${y}</option>`).join('');
    fSel.innerHTML = opts(yrs[0]); tSel.innerHTML = opts(yrs[yrs.length - 1]);
    const bHost = body(main, 'n-b');
    const drawB = () => {
      const a = Number(fSel.value); const b = Number(tSel.value);
      const rows = W.by_year.filter((r) => r.year >= Math.min(a, b) && r.year <= Math.max(a, b));
      bHost.innerHTML = '';
      const recent = win === 'cum' ? rows.filter((r) => r.year >= S.recent_from).map((r) => r.year) : [];
      const box = canvasIn(bHost, '', 'Line chart of mean NCS by publication year for OA and non-OA works');
      const ds = (k, label, color) => ({ label, data: rows.map((r) => r[k].mean_ncs), borderColor: color, backgroundColor: color, tension: 0.2, spanGaps: false,
        pointStyle: rows.map((r) => (recent.includes(r.year) ? 'triangle' : 'circle')), pointRadius: rows.map((r) => (recent.includes(r.year) ? 5 : 3)) });
      chart(box, { type: 'line', plugins: [refLine('y')], data: { labels: rows.map((r) => r.year), datasets: [ds('oa', 'OA works', OA), ds('non', 'Non-OA works', NON)] },
        options: { interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Mean NCS (1 = SEA reference)' } }, x: { title: { display: true, text: 'Publication year' } } },
          plugins: { tooltip: { callbacks: { label: (x) => { const r = rows[x.dataIndex]; const s = x.datasetIndex ? r.non : r.oa; return `${x.dataset.label}: mean NCS ${fmt(s.mean_ncs, 3)} · ${fmt(s.n_norm)} of ${fmt(s.n)} works normalized (${pct(s.coverage_pct, 1)}) · ${fmt(s.cites)} citations`; },
            footer: (xs) => { const r = rows[xs[0].dataIndex]; return `Normalized ratio ${ratioTxt(r.ncr)} (${ciTxt(r.ci)})${r.small ? ' · small sample' : ''}${recent.includes(r.year) ? ' · incomplete recent cohort' : ''}`; } } } } } });
      const w = document.createElement('div');
      w.innerHTML = win === 'cum'
        ? `<div class="warn" role="note"><strong>Incomplete cohorts.</strong> <span>Cumulative counts: cohorts from ${S.recent_from} (triangles) have had little time to be cited; within-year matching keeps the comparison fair, but estimates are less stable. Prefer the ${S.window_years}-year window.</span></div>`
        : `<p class="note">${S.window_years}-year window: cohorts ${W.y0}–${W.y1} only; later cohorts have not completed the window and are excluded.</p>`;
      bHost.appendChild(w);
    };
    fSel.onchange = drawB; tSel.onchange = drawB; drawB();
    const sideCols = (pfx, lab) => [{ key: `${pfx}_n`, label: `${lab} works`, num: true }, { key: `${pfx}_nn`, label: `${lab} normalized`, num: true }, { key: `${pfx}_ncs`, label: `Mean NCS ${lab}`, num: true }, { key: `${pfx}_cov`, label: `${lab} coverage (%)`, num: true }];
    const flat = (r, extra) => ({ ...extra, oa_n: r.oa.n, oa_nn: r.oa.n_norm, oa_ncs: r.oa.mean_ncs, oa_cov: r.oa.coverage_pct, non_n: r.non.n, non_nn: r.non.n_norm, non_ncs: r.non.mean_ncs, non_cov: r.non.coverage_pct,
      raw: r.raw_ratio, ncr: r.ncr, lo: r.ci?.[0], hi: r.ci?.[1], small: r.small ? 'yes' : '' });
    const tailCols = [{ key: 'raw', label: 'Raw ratio', num: true }, { key: 'ncr', label: 'Normalized ratio', num: true }, { key: 'lo', label: 'CI low', num: true }, { key: 'hi', label: 'CI high', num: true }, { key: 'small', label: `Fewer than ${S.min_n} normalized works in a group` }];
    viewData(main, 'n-b', () => ({ scope: W.label, columns: [{ key: 'year', label: 'Publication year', num: true }, ...sideCols('oa', 'OA'), ...sideCols('non', 'Non-OA'), ...tailCols], rows: W.by_year.map((r) => flat(r, { year: r.year })) }));

    // ---------------- Chart C
    const cHost = body(main, 'n-c'); const qIn = main.querySelector('#nc-q'); const sortSel = main.querySelector('#nc-sort');
    const fieldsAll = W.by_field.filter((r) => r.field !== 0);
    const drawC = () => {
      const qv = qIn.value.trim().toLowerCase();
      let rows = fieldsAll.filter((r) => !qv || r.name.toLowerCase().includes(qv));
      const key = sortSel.value;
      rows = [...rows].sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name) : key === 'n' ? b.oa.n - a.oa.n : (b.ncr ?? -1) - (a.ncr ?? -1)));
      cHost.innerHTML = '';
      if (!rows.length) { cHost.innerHTML = emptyState('No field matches the filter.'); return; }
      const box = canvasIn(cHost, '', 'Horizontal bar chart of the normalized OA/non-OA ratio by research field');
      cHost.querySelector('.chart-box').style.height = `${Math.max(260, rows.length * 26 + 60)}px`;
      chart(box, { type: 'bar', plugins: [refLine('x'), whiskers(0, rows.map((r) => r.ci), true)],
        data: { labels: rows.map((r) => r.name), datasets: [{ label: 'Normalized OA/non-OA ratio', data: rows.map((r) => r.ncr), backgroundColor: rows.map((r) => (r.small ? '#cbd5e1' : (r.ncr >= 1 ? OA : NON))) }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: (x) => { const r = rows[x.dataIndex]; return [`Normalized ratio ${ratioTxt(r.ncr)} (${ciTxt(r.ci)})`, `Mean NCS OA ${fmt(r.oa.mean_ncs, 3)} · non-OA ${fmt(r.non.mean_ncs, 3)}`,
            `OA works ${fmt(r.oa.n)} (${pct(r.oa.coverage_pct, 1)} normalized) · non-OA ${fmt(r.non.n)} (${pct(r.non.coverage_pct, 1)})`, `Raw ratio ${ratioTxt(r.raw_ratio)}${r.small ? ' · small sample' : ''}`]; } } } },
          scales: { x: { beginAtZero: true, title: { display: true, text: 'Mean NCS (OA) ÷ Mean NCS (non-OA)' } } } } });
      const n = document.createElement('p'); n.className = 'note';
      n.textContent = `Teal: OA higher; red: non-OA higher; grey: fewer than ${S.min_n} normalized works on one side. Whiskers = 95% bootstrap interval; overlap is not a formal test.`;
      cHost.appendChild(n);
    };
    qIn.oninput = drawC; sortSel.onchange = drawC; drawC();
    viewData(main, 'n-c', () => ({ scope: W.label, columns: [{ key: 'name', label: 'Field' }, ...sideCols('oa', 'OA'), ...sideCols('non', 'Non-OA'), ...tailCols], rows: W.by_field.map((r) => flat(r, { name: r.name })) }));

    // ---------------- Chart D (country table)
    const dCols = [
      { key: 'name', label: 'Country' },
      { key: 'oa_n', label: 'OA publications', num: true, render: (r) => fmt(r.oa_n) },
      { key: 'non_n', label: 'Non-OA publications', num: true, render: (r) => fmt(r.non_n) },
      { key: 'raw', label: 'Raw citation ratio', num: true, render: (r) => ratioTxt(r.raw) },
      { key: 'oa_ncs', label: 'Mean NCS (OA)', num: true, render: (r) => r2(r.oa_ncs) },
      { key: 'non_ncs', label: 'Mean NCS (non-OA)', num: true, render: (r) => r2(r.non_ncs) },
      { key: 'ncr', label: 'Normalized citation ratio', num: true, render: (r) => `${ratioTxt(r.ncr)}<br><small>${ciTxt(r.lo !== undefined && r.lo !== null ? [r.lo, r.hi] : null)}</small>${r.small ? ' <span class="badge">small sample</span>' : ''}` },
      { key: 'cov', label: 'Normalization coverage', num: true, render: (r) => `${pct(r.oa_cov, 1)} / ${pct(r.non_cov, 1)}`, csv: (r) => `${r.oa_cov} / ${r.non_cov}` },
    ];
    const dRows = W.by_country.filter((r) => sel.includes(r.cc)).map((r) => flat(r, { name: r.name, cov: r.oa.coverage_pct }));
    table(body(main, 'n-d'), dCols, dRows, { pageSize: 11, search: false, sortKey: 'ncr', caption: 'Country-level normalized citation comparison' });
    const dn = document.createElement('p'); dn.className = 'note'; dn.textContent = 'Coverage = normalized ÷ works in window cohorts (OA / non-OA). Raw ratio uses the same window. Country figures are full-counted and must not be summed to a regional total.';
    body(main, 'n-d').appendChild(dn);
    viewData(main, 'n-d', () => ({ scope: `${W.label}; full counting`, columns: [{ key: 'name', label: 'Country' }, ...sideCols('oa', 'OA'), ...sideCols('non', 'Non-OA'), ...tailCols], rows: dRows }));

    // ---------------- Chart E (document type)
    const T = W.by_type;
    chart(canvasIn(body(main, 'n-e'), '', 'Grouped bars of mean NCS by document type'), { type: 'bar', plugins: [refLine('y')],
      data: { labels: T.map((r) => r.type), datasets: [{ label: 'OA works', data: T.map((r) => r.oa.mean_ncs), backgroundColor: OA }, { label: 'Non-OA works', data: T.map((r) => r.non.mean_ncs), backgroundColor: NON }] },
      options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Mean NCS' } } }, plugins: { tooltip: { callbacks: {
        label: (x) => { const r = T[x.dataIndex]; const s = x.datasetIndex ? r.non : r.oa; return `${x.dataset.label}: ${fmt(s.mean_ncs, 3)} (${fmt(s.n_norm)} of ${fmt(s.n)} works)`; },
        footer: (xs) => { const r = T[xs[0].dataIndex]; return `Normalized ratio ${ratioTxt(r.ncr)} (${ciTxt(r.ci)})${r.small ? ' · small sample' : ''}`; } } } } } });
    const en = document.createElement('p'); en.className = 'note'; en.textContent = 'Types present in the data only. “Other” groups the remaining OpenAlex types (dataset, dissertation, editorial, letter…); each is normalized against its own type.';
    body(main, 'n-e').appendChild(en);
    viewData(main, 'n-e', () => ({ scope: W.label, columns: [{ key: 'type', label: 'Document type' }, ...sideCols('oa', 'OA'), ...sideCols('non', 'Non-OA'), ...tailCols], rows: T.map((r) => flat(r, { type: r.type })) }));

    // ---------------- Chart F (venue tier)
    const TR = W.by_tier; const fHost = body(main, 'n-f');
    chart(canvasIn(fHost, '', 'Grouped bars of mean NCS by venue tier for OA and non-OA works'), { type: 'bar', plugins: [refLine('y')],
      data: { labels: TR.map((r) => r.tier), datasets: [{ label: 'OA works', data: TR.map((r) => r.oa.mean_ncs), backgroundColor: OA }, { label: 'Non-OA works', data: TR.map((r) => r.non.mean_ncs), backgroundColor: NON }] },
      options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Mean NCS' } }, x: { title: { display: true, text: 'SJR 2025 quartile of the venue' } } }, plugins: { tooltip: { callbacks: {
        label: (x) => { const r = TR[x.dataIndex]; const s2 = x.datasetIndex ? r.non : r.oa; return `${x.dataset.label}: ${fmt(s2.mean_ncs, 3)} (${fmt(s2.n_norm)} of ${fmt(s2.n)} works)`; },
        footer: (xs) => { const r = TR[xs[0].dataIndex]; return `Within-tier ratio ${ratioTxt(r.ncr)} (${ciTxt(r.ci)})${r.small ? ' · small sample' : ''}`; } } } } } });
    const ts = W.tier_standardized;
    const fn = document.createElement('p'); fn.className = 'note';
    fn.textContent = `Venue-tier standardized ratio ${ratioTxt(ts.ratio)} (${ciTxt(ts.ci)}). Tier = SJR 2025 quartile of the work's primary venue (current ranking applied to all years); “Unindexed” = venue not in SJR; “No venue” = no source recorded. Baselines are not re-estimated per tier.`;
    fHost.appendChild(fn);
    const ctCols = [{ key: 'name', label: 'Country' }, { key: 'tier', label: 'Venue tier' }, ...sideCols('oa', 'OA'), ...sideCols('non', 'Non-OA'), { key: 'raw', label: 'Raw ratio', num: true }, { key: 'ncr', label: 'Normalized ratio', num: true }, { key: 'small', label: `Fewer than ${S.min_n} normalized works in a group` }];
    viewData(main, 'n-f', () => ({ scope: `${W.label}; tier and country × tier (full counting)`, columns: ctCols,
      rows: [...TR.map((r) => flat(r, { name: 'All SEA (each work once)', tier: r.tier })), ...W.by_country_tier.map((r) => flat(r, { name: SEA_NAMES[r.cc], tier: r.tier }))] }));

    // ---------------- Interpretation (generated from data)
    const dir = (v) => (v > 1 ? 'higher for OA works' : v < 1 ? 'higher for non-OA works' : 'equal');
    const ciHas1 = o.ci && o.ci[0] <= 1 && o.ci[1] >= 1;
    const fr = fieldsAll.filter((r) => !r.small && r.ncr !== null);
    const fUp = fr.filter((r) => r.ci && r.ci[0] > 1).length; const fDn = fr.filter((r) => r.ci && r.ci[1] < 1).length;
    const change = (o.raw_ratio_norm < 1) !== (o.ncr < 1) ? 'changes direction' : (Math.abs(Math.log(o.ncr)) < Math.abs(Math.log(o.raw_ratio_norm)) ? 'becomes smaller' : 'becomes larger');
    main.querySelector('#ncs-int').innerHTML = `<h2>Interpretation of normalized citation impact</h2><ol>
      <li><strong>Raw citation ratio.</strong> Across all SEA works and all citations to the snapshot date, an OA work receives on average ${fmt(ra.oa.cpw, 2)} citations and a non-OA work ${fmt(ra.non.cpw, 2)}: a raw ratio of ${ratioTxt(ra.ratio)}. This mixes citation intensity with differences in age, field and document type between the two groups.</li>
      <li><strong>Why normalize.</strong> Citation rates differ strongly by field, by document type (reviews are cited more than articles) and by publication year (older works have had more time). If the OA and non-OA groups are composed differently on these dimensions, the raw ratio reflects composition as well as access.</li>
      <li><strong>Reading the normalized ratio.</strong> Each work is compared with SEA works of the same year, subfield (or field) and type. A ratio above 1 means OA works are cited more than comparable non-OA works; below 1, less. In the ${W.label.toLowerCase()} the normalized ratio is ${ratioTxt(o.ncr)} (${ciTxt(o.ci)}): normalized impact is ${dir(o.ncr)}${ciHas1 ? ', and the interval includes 1, so the data do not separate the groups clearly' : ', and the 95% interval excludes 1'}.</li>
      <li><strong>Effect of normalization.</strong> For the same works the raw ratio is ${ratioTxt(o.raw_ratio_norm)}; after normalization the OA/non-OA difference ${change}. Among ${fr.length} fields with sufficient samples, ${fUp} show an interval entirely above 1 and ${fDn} entirely below 1, so aggregate figures ${fUp && fDn ? 'conceal opposite patterns in different fields' : 'are broadly consistent with the field-level pattern'}.</li>
      <li><strong>Venue tier.</strong> In this dataset OA and non-OA works sit in very different venues (OA: ${pct((100 * (TR.find((r) => r.tier === 'Unindexed')?.oa.n || 0)) / (o.oa.n || 1), 1)} in venues not indexed by SJR; non-OA: ${pct((100 * (TR.find((r) => r.tier === 'Unindexed')?.non.n || 0)) / (o.non.n || 1), 1)}). Field/year/type normalization does not remove this. Comparing within the same SJR quartile and weighting tiers equally for both groups gives a venue-tier standardized ratio of ${ratioTxt(ts.ratio)} (${ciTxt(ts.ci)}), versus ${ratioTxt(o.ncr)} without it${ts.ratio !== null && o.ncr ? ` — ${Math.abs(Math.log(ts.ratio)) < Math.abs(Math.log(o.ncr)) ? 'the gap narrows, so part of it reflects where works are published' : 'the gap does not narrow'}` : ''}.</li>
      <li><strong>No causal claim.</strong> Citation normalization improves comparability but does not establish that open access status causes an increase or decrease in citations. Authors choose where and how to publish; venue prestige, language, funding, collaboration and self-archiving behaviour are not controlled.</li>
      <li><strong>Composition matters.</strong> Uncited works: OA ${pct(o.oa.zero_pct, 1)}, non-OA ${pct(o.non.zero_pct, 1)}; median citations OA ${fmt(o.oa.median, 1)}, non-OA ${fmt(o.non.median, 1)}. Means are sensitive to a few highly cited works, so medians and uncited shares should be read alongside them.</li></ol>
      <p><strong>Citation volume, citation intensity, and normalized citation impact describe different aspects of scholarly communication and should not be interpreted as direct measurements of research quality.</strong></p>`;

    // ---------------- Method / provenance
    const basis = (k) => W.basis.filter((b) => b.basis === k).reduce((a, b) => a + b.n, 0);
    main.querySelector('#ncs-meth div').innerHTML = `<dl class="dl">
      <dt>Source snapshot</dt><dd>OpenAlex Parquet snapshot ${esc(S.snapshot)} (same as the rest of the dashboard); built ${esc(S.generated)}.</dd>
      <dt>Publications</dt><dd>All SEA works of the dashboard (≥ 1 SEA-affiliated author, paratext excluded): ${fmt(ra.oa.n)} OA, ${fmt(ra.non.n)} non-OA. OA status: OpenAlex <code>open_access.is_oa</code>.</dd>
      <dt>Citations</dt><dd>Links in <code>referenced_works</code> of every work in the snapshot pointing to a SEA work (self-links excluded), the same rule as the cross-access matrix. Not OpenAlex <code>cited_by_count</code>.</dd>
      <dt>Observation window</dt><dd>${esc(S.windows.w3.label)}: ${esc(S.windows.w3.desc)} ${esc(S.windows.cum.label)}: ${esc(S.windows.cum.desc)}</dd>
      <dt>Field</dt><dd>OpenAlex primary topic (one per work, no fractional counting): subfield level when the reference cell has ≥ ${S.min_n} works, otherwise field level, otherwise excluded.</dd>
      <dt>Document type</dt><dd>OpenAlex <code>type</code>; baselines per raw type; display groups ${esc(S.type_groups.join(', '))}.</dd>
      <dt>Publication year</dt><dd>OpenAlex <code>publication_year</code>.</dd>
      <dt>Reference population</dt><dd>SEA OA and non-OA works combined, same window (internal SEA baseline; not a global baseline).</dd>
      <dt>Formula</dt><dd>NCS<sub>i</sub> = C<sub>i</sub> ÷ E(C | subfield-or-field, year, type); Normalized ratio = mean NCS(OA) ÷ mean NCS(non-OA).</dd>
      <dt>Missing values</dt><dd>No field or type: excluded. Cell mean = 0: excluded (zero baseline). Uncited works in valid cells: NCS = 0, included.</dd>
      <dt>Counts (this window)</dt><dd>Subfield baseline ${fmt(basis('subfield'))}; field fallback ${fmt(basis('field'))}; sparse ${fmt(basis('sparse'))}; zero baseline ${fmt(basis('zero_baseline'))}; unclassified ${fmt(basis('unclassified'))}; outside cohorts ${fmt(W.excluded_out_of_period.oa + W.excluded_out_of_period.non)}.</dd>
      <dt>Uncertainty</dt><dd>${S.bootstrap.replicates} Poisson bootstrap replicates (seed ${S.bootstrap.seed}), unit: ${esc(S.bootstrap.unit)}; ${esc(S.bootstrap.interval)}; ${esc(S.bootstrap.assumption)}.</dd>
      <dt>Countries</dt><dd>Full counting by author-affiliation country; regional figures count each work once.</dd>
      <dt>Validation</dt><dd>${S.validation.tests.map((t) => `${t.pass ? '✓' : '✗'} ${esc(t.name)}`).join('<br>')}<br>Citation links without citing year: ${fmt(S.validation.links_without_citing_year)} (cumulative only).</dd></dl>`;
  };

  // ---------------- Interactive comparison table (cube)
  const tHost = body(main, 'n-t');
  const fieldOpts = Object.entries(S.fields).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  tHost.innerHTML = `<div class="scope-bar" role="group" aria-label="Population filters">
      <label class="field">Year from<select id="nt-y0"></select></label><label class="field">to<select id="nt-y1"></select></label>
      <label class="field">Research field<select id="nt-f"><option value="">All fields</option>${fieldOpts}</select></label>
      <label class="field">Document type<select id="nt-t"><option value="">All types</option>${S.type_groups.map((g) => `<option>${esc(g)}</option>`).join('')}</select></label>
      <label class="field">Venue tier<select id="nt-v"><option value="">All tiers</option>${S.tiers.map((g) => `<option>${esc(g)}</option>`).join('')}</select></label>
      <label class="field">Citation window<select id="nt-w">${Object.entries(S.windows).map(([k, w]) => `<option value="${k}">${esc(w.label)}</option>`).join('')}</select></label>
      <button type="button" class="btn ghost" id="nt-reset">Reset filters</button></div><div id="nt-out"></div>`;
  const $ = (id) => tHost.querySelector(`#${id}`);
  const setYears = () => {
    const W = S.windows[$('nt-w').value]; const ys = []; for (let y = W.y0; y <= W.y1; y += 1) ys.push(y);
    const keep0 = Number($('nt-y0').value) || W.y0; const keep1 = Number($('nt-y1').value) || W.y1;
    $('nt-y0').innerHTML = ys.map((y) => `<option ${y === Math.max(W.y0, Math.min(keep0, W.y1)) ? 'selected' : ''}>${y}</option>`).join('');
    $('nt-y1').innerHTML = ys.map((y) => `<option ${y === Math.max(W.y0, Math.min(keep1, W.y1)) ? 'selected' : ''}>${y}</option>`).join('');
  };
  let lastRows = []; let lastScope = '';
  const compute = async () => {
    const cc = sel.length === SEA.length ? 'ALL' : sel.length === 1 ? sel[0] : 'MANY'; const wk = $('nt-w').value; const W = S.windows[wk];
    if (!sel.length) { $('nt-out').innerHTML = emptyState('No country is selected. Select at least one country or reset to all.'); lastRows = []; return; }
    // Several countries: works are counted once. Sum of the single-country cubes minus (|mask ∩ selection| − 1) × the
    // multi-country rows (cube_MULTI, works with ≥ 2 SEA countries per exact mask); every column is additive.
    const cubes = cc === 'MANY' ? [...await Promise.all(sel.map((c) => load(`inflow/ncs/cube_${c}.json`))), await load('inflow/ncs/cube_MULTI.json')]
      : [await load(`inflow/ncs/cube_${cc}.json`)];
    const a = Number($('nt-y0').value); const b = Number($('nt-y1').value);
    const y0 = Math.min(a, b); const y1 = Math.max(a, b); const f = $('nt-f').value; const tg = $('nt-t').value; const vt = $('nt-v').value;
    const { acc, H } = sumCubes(cubes, { countries: SEA, sel, wk, y0, y1, field: f, tg, tier: vt });
    const med = (s) => { if (!s.n) return null; const pos = Math.ceil(s.n / 2); let cum = 0; for (let k = 0; k <= H; k += 1) { cum += s.h[k]; if (cum >= pos) return k < H ? String(k) : `> ${H - 1}`; } return null; };
    const [N, O] = acc;
    const ind = [
      ['Number of publications', (s) => s.n, (v) => fmt(v)],
      ['Total received citations', (s) => s.cites, (v) => fmt(v)],
      ['Citations per publication', (s) => (s.n ? s.cites / s.n : null), (v) => r2(v)],
      ['Mean normalized citation score', (s) => (s.nn ? s.ncs / s.nn : null), (v) => (v === null ? 'Not available' : fmt(v, 3))],
      ['Median citation count', (s) => med(s), (v) => v ?? 'Not available'],
      ['Zero-citation publications (%)', (s) => (s.n ? (100 * s.h[0]) / s.n : null), (v) => (v === null ? 'Not available' : pct(v, 1))],
      ['Normalization coverage (%)', (s) => (s.n ? (100 * s.nn) / s.n : null), (v) => (v === null ? 'Not available' : `${pct(v, 1)}`)],
    ];
    lastRows = ind.map(([k, g, f2]) => ({ indicator: k, oa: g(O), non: g(N), oa_t: f2(g(O)), non_t: f2(g(N)) }));
    const mo = O.nn ? O.ncs / O.nn : null; const mn = N.nn ? N.ncs / N.nn : null;
    lastScope = `${cc === 'ALL' ? 'All SEA countries (each work once)' : cc === 'MANY' ? `${sel.map((c) => SEA_NAMES[c]).join(', ')} (each work once)` : SEA_NAMES[cc]} · ${y0}–${y1} · ${f === '' ? 'all fields' : S.fields[f]} · ${tg || 'all types'} · ${vt || 'all venue tiers'} · ${W.label}`;
    const out = $('nt-out');
    if (!O.n && !N.n) { out.innerHTML = emptyState('No publications match this combination of filters.', false); return; }
    const small = O.nn < S.min_n || N.nn < S.min_n;
    out.innerHTML = `<p class="note">Population: ${esc(lastScope)}</p>${small ? `<div class="warn" role="note"><strong>Small sample.</strong> <span>Fewer than ${S.min_n} normalized works on at least one side; treat the ratios as unreliable.</span></div>` : ''}
      <div class="table-wrap"><table><thead><tr><th>Indicator</th><th class="num">OA</th><th class="num">Non-OA</th></tr></thead><tbody>
      ${lastRows.map((r) => `<tr><td>${esc(r.indicator)}</td><td class="num">${esc(r.oa_t)}</td><td class="num">${esc(r.non_t)}</td></tr>`).join('')}
      <tr><td><strong>Raw citation ratio (OA ÷ non-OA)</strong></td><td class="num" colspan="2">${O.n && N.n && N.cites ? ratioTxt((O.cites / O.n) / (N.cites / N.n)) : 'Not available'}</td></tr>
      <tr><td><strong>Normalized citation ratio</strong></td><td class="num" colspan="2">${mo !== null && mn ? ratioTxt(mo / mn) : 'Not available'} <small>(no interval for custom filters)</small></td></tr>
      </tbody></table></div><p class="note">Median from exact counts 0–${H - 1}; above that shown as “> ${H - 1}”. Bootstrap intervals are available for the predefined breakdowns above, not for custom combinations.</p>`;
  };
  ['nt-y0', 'nt-y1', 'nt-f', 'nt-t', 'nt-v'].forEach((id) => { $(id).onchange = compute; });
  $('nt-w').onchange = () => { setYears(); compute(); };
  $('nt-reset').onclick = () => { $('nt-f').value = ''; $('nt-t').value = ''; $('nt-v').value = ''; $('nt-w').value = 'w3'; $('nt-y0').value = ''; $('nt-y1').value = ''; setYears();
    const W = S.windows.w3; $('nt-y0').value = String(W.y0); $('nt-y1').value = String(W.y1); compute(); };
  setYears(); compute();
  viewData(main, 'n-t', () => ({ scope: lastScope, columns: [{ key: 'indicator', label: 'Indicator' }, { key: 'oa', label: 'OA', num: true }, { key: 'non', label: 'Non-OA', num: true }], rows: lastRows }));

  // window toggle redraws the predefined breakdowns (charts are rebuilt inside their panels)
  main.querySelector('#ncs-win').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; win = b.dataset.w;
    main.querySelectorAll('#ncs-win button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ['n-a', 'n-b', 'n-c', 'n-d', 'n-e', 'n-f'].forEach((id) => { main.querySelectorAll(`#${id} .panel-tools > button.btn.ghost.small`).forEach((x) => { if (x.textContent === 'View data') x.remove(); }); });
    draw();
  });
  draw();
}
