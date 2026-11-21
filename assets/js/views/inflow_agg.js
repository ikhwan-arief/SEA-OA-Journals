/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Citation Inflow for a country selection, from web/data/inflow/cinflow.json (scripts/build_inflow_country.py).
// Rows are stored per 11-bit country mask; a row is counted when its mask intersects the selection, so every
// work and citation link is counted once (deduplicated) however many selected countries it involves.
// Returns the same shape as inflow_summary.json for the panels it covers.
export function inflowForSelection(ci, sel) {
  const bits = sel.reduce((a, c) => a | (1 << ci.countries.indexOf(c)), 0);
  const on = (m) => (m & bits) !== 0;
  let oaW = 0; let clW = 0;
  ci.works.forEach(([m, o, c]) => { if (on(m)) { oaW += o; clW += c; } });
  const mx = new Map();
  ci.matrix.forEach(([m, cd, cg, n]) => { if (on(m)) { const k = `${cd}${cg}`; mx.set(k, (mx.get(k) || 0) + n); } });
  const matrix = [[0, 0], [1, 1], [1, 0], [0, 1]].map(([cd, cg]) => ({ cited_oa: !!cd, citing_oa: !!cg, citations: mx.get(`${cd}${cg}`) || 0 }));
  const cit = (cd, cg) => mx.get(`${cd}${cg}`) || 0;
  const toOa = cit(1, 1) + cit(1, 0);
  const oaCpw = oaW ? toOa / oaW : 0; const clCpw = clW ? (cit(0, 1) + cit(0, 0)) / clW : 0;
  const yrs = new Map();
  ci.yearly.forEach(([m, y, o, n]) => { if (on(m)) { const r = yrs.get(y) || { year: y, oa: 0, closed: 0 }; r[o ? 'oa' : 'closed'] += n; yrs.set(y, r); } });
  const st = ci.statuses.map((s) => ({ oa_status: s, works: 0, citations: 0, closed_citations: 0 }));
  ci.status.forEach(([m, k, w, c, cc]) => { if (on(m)) { st[k].works += w; st[k].citations += c; st[k].closed_citations += cc; } });
  st.forEach((r) => { r.cites_per_work = r.works ? r.citations / r.works : 0; r.car_vs_closed = clCpw ? r.cites_per_work / clCpw : null; });
  const rg = ci.regions.map((r) => ({ region: r, oa: 0, closed: 0 }));
  ci.region.forEach(([m, k, o, n]) => { if (on(m)) rg[k][o ? 'oa' : 'closed'] += n; });
  return {
    matrix, sea_oa_works: oaW, sea_closed_works: clW,
    nir_region_pct: toOa ? (100 * cit(1, 0)) / toOa : 0,
    cites_per_oa_work: oaCpw, cites_per_closed_work: clCpw, car_oa_vs_closed: clCpw ? oaCpw / clCpw : null,
    by_oa_status: st.filter((r) => r.works > 0), yearly: [...yrs.values()].sort((a, b) => a.year - b.year),
    regions: rg.filter((r) => r.oa + r.closed > 0).sort((a, b) => b.oa + b.closed - a.oa - a.closed),
  };
}
