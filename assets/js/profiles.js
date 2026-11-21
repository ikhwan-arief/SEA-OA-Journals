/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Entity profile panel (right-hand drawer) for journals, publishers, institutions, countries, authors,
// subfields and works. Facts come from the pre-built data in web/data (OpenAlex snapshot 2026-10-14 +
// SCImago 2025); the "What this means" section is computed from those numbers with fixed rules and peer
// medians (web/data/profiles/benchmarks.json). No sentence is written without a number behind it.
import { load, tryLoad, esc, fmt, pct, badge, drawer, extLink, SEA, SEA_NAMES, OA_LABEL, doajBadge, inDoaj, oaLink } from './lib.js';

const SNAP = 'OpenAlex snapshot 2026-10-14';
const http = (u) => (u && /^https?:\/\//i.test(u) ? u : null);
const n2 = (v) => (v === null || v === undefined ? 'Not available' : fmt(v, 2));
const share = (v) => (v === null || v === undefined ? 'Not available' : pct(v, 1, true));
const ord = (p) => { const k = Math.round(p); const s = (k % 100 >= 11 && k % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[k % 10] || 'th'); return `${k}${s}`; };
const dl = (rows) => `<dl class="dl">${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
const btn = (href, text) => (href ? extLink(href, `${esc(text)} ↗`).replace('<a ', '<a class="btn ghost small" ') : '');
const inner = (kind, ref, text) => `<a href="#" class="plink" data-pk="${kind}" data-pid="${esc(ref.id ?? '')}" data-pname="${esc(ref.name ?? '')}">${esc(text)}</a>`;

/** FWCI relative to the world average (1.0 = world average for papers of the same field, year and type). */
function fwciPhrase(v) {
  if (v === null || v === undefined) return null;
  if (v >= 1.5) return `well above the world average (FWCI ${fmt(v, 2)}; 1.00 = world average for comparable papers)`;
  if (v >= 1.05) return `above the world average (FWCI ${fmt(v, 2)})`;
  if (v >= 0.95) return `close to the world average (FWCI ${fmt(v, 2)})`;
  if (v >= 0.5) return `below the world average (FWCI ${fmt(v, 2)})`;
  return `far below the world average (FWCI ${fmt(v, 2)})`;
}
const vsMedian = (v, m, unit = '') => {
  if (v === null || v === undefined || m === null || m === undefined || !m) return null;
  const r = v / m;
  return r >= 1.1 ? `higher than the peer median (${fmt(m, 2)}${unit})` : r <= 0.9 ? `lower than the peer median (${fmt(m, 2)}${unit})` : `about the peer median (${fmt(m, 2)}${unit})`;
};

function section(title, html) { return html ? `<h3>${esc(title)}</h3>${html}` : ''; }
function means(points, narrative) {
  const pts = points.filter(Boolean);
  if (!pts.length && !narrative) return '';
  return `<div class="profile-means">${narrative ? `<p>${narrative}</p>` : ''}${pts.length ? `<ul>${pts.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
    <p class="note">Computed from the figures above with fixed rules; descriptive, not a quality judgement.</p></div>`;
}
function open(title, subtitle, html) {
  drawer.open({ title, subtitle, html, onMount: (b) => b.addEventListener('click', (e) => { if (e.target.closest('a[data-nav]')) drawer.close(); }) });
}
function missing(kind, ref, link) {
  open(ref.name || 'Profile', kind, `<p class="note">No profile is available for this ${esc(kind.toLowerCase())} in the dashboard data${kind === 'Author' ? ' (profiles cover the leading experts: top 40 per subfield)' : ''}.</p>
    ${link ? `<p>${btn(link, 'View on OpenAlex')}</p>` : ''}`);
}

// ---------------------------------------------------------------- journal
async function journal(ref) {
  const id = Number(ref.id);
  const [b, bench] = await Promise.all([tryLoad(`profiles/journals/${id % 64}.json`), tryLoad('profiles/benchmarks.json')]);
  const j = b && b[String(id)];
  if (!j) { missing('Journal', ref, id ? oaLink('S', id) : null); return; }
  const tb = (bench && bench.journal_tier[j.quartile]) || {};
  const g = j.global || {};
  const small = (j.works || 0) < ((bench && bench.min_works) || 20);
  const facts = dl([
    ['Publisher', j.publisher ? inner('publisher', { id: j.publisher, name: j.publisher }, j.publisher) : 'Not available'],
    ['ISSN-L', esc(j.issn_l || 'Not available')],
    ['Lead SEA country', j.lead_cc ? inner('country', { id: j.lead_cc, name: SEA_NAMES[j.lead_cc] }, SEA_NAMES[j.lead_cc] || j.lead_cc) : 'Not available'],
    ['SJR 2025 quartile', `${badge(j.quartile)}${j.sjr ? ` · SJR ${fmt(j.sjr, 3)}` : ''}`],
    ['In DOAJ', inDoaj(j.id) ? `Yes${doajBadge(j.id)}` : 'No / not available'],
    ['Main OA route', esc(OA_LABEL[j.main_oa] || j.main_oa || 'Not available')],
    ['Diamond share of works', share(j.diamond_share)],
    ['APC (USD, OpenAlex)', j.apc_usd ? fmt(j.apc_usd) : 'None recorded'],
    ['SEA OA works', `${fmt(j.works)} (${j.first_year || '?'}–${j.last_year || '?'})`],
    ['Citations to them', fmt(j.cites_in ?? j.cites)],
    ['Mean FWCI', n2(j.mean_fwci)],
    ['Top 10% cited share', share(j.top10_share)],
    ['Citations from non-OA works (NIR)', j.nir === null || j.nir === undefined ? 'Not available' : pct(j.nir, 1)],
    g.works ? ['Whole journal in OpenAlex', `${fmt(g.works)} works · ${fmt(g.cites)} citations${g.h_index ? ` · h-index ${fmt(g.h_index)}` : ''}`] : null,
  ]);
  const seaShare = g.works ? j.works / g.works : null;
  const pts = [
    !small && j.pctl && j.pctl.mean_fwci !== null ? `Citation impact: ${fwciPhrase(j.mean_fwci)}; ${ord(j.pctl.mean_fwci)} percentile among ${fmt(tb.n)} SEA OA journals in the same tier (${esc(j.quartile)}), ${vsMedian(j.mean_fwci, tb.mean_fwci)}.` : null,
    !small && j.nir !== null && j.nir !== undefined ? `Reach beyond open access: ${pct(j.nir, 1)} of the citations come from non-OA (paywalled) literature, ${vsMedian(j.nir, tb.nir, '%')}.` : null,
    (j.diamond_share ?? 0) >= 0.5 ? `Publishing model: mostly Diamond OA (${share(j.diamond_share)} of works), i.e. free to read and free to publish.` : j.apc_usd ? `Publishing model: OpenAlex records an article processing charge of USD ${fmt(j.apc_usd)}.` : null,
    j.rank_in_country ? `Size: ${ord(100 * (1 - (j.rank_in_country - 1) / Math.max(1, j.journals_in_country)))} percentile by SEA OA works among ${fmt(j.journals_in_country)} journals led by ${esc(SEA_NAMES[j.lead_cc] || j.lead_cc)} (rank ${fmt(j.rank_in_country)}).` : null,
    seaShare !== null ? `SEA weight: SEA-affiliated OA works are ${pct(Math.min(1, seaShare), 1, true)} of everything this journal has published in OpenAlex.` : null,
    small ? `Caution: fewer than ${(bench && bench.min_works) || 20} SEA OA works, so averages are unstable and no peer comparison is shown.` : null,
  ];
  const narrative = `${esc(j.name)} is ${j.quartile === 'Unindexed' ? 'a venue not indexed in SCImago' : j.quartile === 'SJR (no quartile)' ? 'an SJR-listed venue without a quartile' : `an SJR ${esc(j.quartile)} journal`}${j.publisher ? ` published by ${esc(j.publisher)}` : ''}${j.lead_cc ? `, with most of its SEA output coming from ${esc(SEA_NAMES[j.lead_cc] || j.lead_cc)}` : ''}. `
    + (small ? 'It has only a small SEA open-access footprint in this snapshot.' : `Its ${fmt(j.works)} SEA open-access works are cited ${fwciPhrase(j.mean_fwci) || 'at an unknown rate'}${seaShare !== null && seaShare > 0.5 ? ', and SEA authors make up most of its output' : ''}.`);
  const links = [btn(http(j.url), 'Journal website'), j.issn_l ? btn(`https://portal.issn.org/resource/ISSN/${j.issn_l}`, 'ISSN Portal') : '', btn(oaLink('S', j.id), 'OpenAlex'),
    inDoaj(j.id) && j.issn_l ? btn(`https://doaj.org/toc/${j.issn_l}`, 'DOAJ') : ''].join(' ');
  open(j.name, `Journal · ISSN-L ${j.issn_l || 'not available'}`, `${facts}${section('What this means', means(pts, narrative))}
    ${section('Links', `<p class="plinks">${links}</p>`)}
    <p class="note">Scope: SEA OA works = open-access works with at least one author affiliated in a Southeast Asian country (${SNAP}). “Whole journal” = all works of the journal in OpenAlex. Peer medians: journals of the same SJR tier with ≥ ${(bench && bench.min_works) || 20} SEA OA works.</p>`);
}

// ---------------------------------------------------------------- publisher
async function publisher(ref) {
  const d = await tryLoad('profiles/publishers.json');
  const p = d && d.publishers[ref.name || ref.id];
  if (!p) { missing('Publisher', ref, null); return; }
  const q = p.quartiles || {};
  const indexed = ['Q1', 'Q2', 'Q3', 'Q4'].reduce((a, k) => a + (q[k] || 0), 0);
  const cc = Object.entries(p.countries || {});
  const ccTot = cc.reduce((a, [, v]) => a + v, 0) || 1;
  const facts = dl([
    ['Journals (SEA OA)', fmt(p.journals)],
    ['SEA OA works', `${fmt(p.works)} (${p.first_year || '?'}–${p.last_year || '?'})`],
    ['Rank by SEA OA works', `${fmt(p.rank)} of ${fmt(d.n)} publishers`],
    ['Citations to them', fmt(p.cites_in || p.cites)],
    ['Works-weighted mean FWCI', n2(p.mean_fwci)],
    ['Journals by SJR tier', ['Q1', 'Q2', 'Q3', 'Q4', 'SJR (no quartile)', 'Unindexed'].filter((k) => q[k]).map((k) => `${badge(k)} ${fmt(q[k])}`).join(' ')],
    ['Journals in DOAJ', `${fmt(p.doaj_journals)} of ${fmt(p.journals)}`],
    ['Mostly-Diamond journals', `${fmt(p.diamond_journals)} of ${fmt(p.journals)}`],
    ['Lead countries (by works)', cc.slice(0, 4).map(([c, v]) => `${esc(SEA_NAMES[c] || c)} ${pct(v / ccTot, 0, true)}`).join(', ') || 'Not available'],
  ]);
  const pts = [
    p.mean_fwci !== null ? `Citation impact across its journals: ${fwciPhrase(p.mean_fwci)}.` : null,
    `Indexing: ${fmt(indexed)} of ${fmt(p.journals)} journals (${pct(indexed / Math.max(1, p.journals), 0, true)}) have an SJR quartile; ${fmt(p.doaj_journals)} are in DOAJ.`,
    p.diamond_journals ? `${fmt(p.diamond_journals)} journal${p.diamond_journals > 1 ? 's are' : ' is'} mostly Diamond OA (free to read and to publish).` : null,
    cc.length ? `Geography: ${pct(cc[0][1] / ccTot, 0, true)} of its SEA OA works sit in journals led by ${esc(SEA_NAMES[cc[0][0]] || cc[0][0])}.` : null,
  ];
  const narrative = `${esc(p.name)} publishes ${fmt(p.journals)} journal${p.journals > 1 ? 's' : ''} carrying SEA open-access research (${fmt(p.works)} works), placing it ${p.rank <= 10 ? 'among the ten largest' : p.rank <= 100 ? 'among the hundred largest' : 'outside the hundred largest'} publishers of SEA OA output in this dashboard.`;
  const top = `<ul class="plain">${(p.top || []).map((j) => `<li>${inner('journal', { id: j.id, name: j.name }, j.name)}${doajBadge(j.id)} <small>${badge(j.quartile)} ${fmt(j.works)} works</small></li>`).join('')}</ul>`;
  open(p.name, 'Publisher', `${facts}${section('What this means', means(pts, narrative))}${section('Largest journals', top)}
    ${section('Links', `<p class="plinks">${btn(`https://openalex.org/publishers?search=${encodeURIComponent(p.name)}`, 'Search on OpenAlex')}</p>`)}
    <p class="note">Scope: aggregated over the publisher's venues in the SEA OA journal crosswalk (journals, book series and conference series with SEA OA works). Venues without publisher data in OpenAlex, and some proceedings series, are not included.</p>`);
}

// ---------------------------------------------------------------- institution
async function institution(ref) {
  const [d, bench] = await Promise.all([tryLoad('institutions/profiles.json'), tryLoad('profiles/benchmarks.json')]);
  const all = (d && d.institutions) || {};
  const p = all[String(ref.id)] || Object.values(all).find((x) => x.name === ref.name);
  if (!p) { missing('Institution', ref, ref.id ? oaLink('I', ref.id) : null); return; }
  const cb = (bench && bench.institution[p.cc]) || {};
  const cname = SEA_NAMES[p.cc] || p.cc;
  const oaTot = Object.values(p.oa || {}).reduce((a, x) => a + x, 0) || 1;
  const main = Object.entries(p.oa || {}).sort((a, b) => b[1] - a[1])[0];
  const sfTop = (p.subfields || [])[0];
  const facts = dl([
    ['Country', `${inner('country', { id: p.cc, name: cname }, cname)} <small>(rank ${fmt(p.rank_in_country)} by OA works)</small>`],
    ['SEA OA works', `${fmt(p.works)} (${p.first_year}–${p.last_year})`],
    ['Citations to these works', fmt(p.cites)],
    ['Mean FWCI', n2(p.mean_fwci)],
    ['Top 10% cited share', share(p.top10_share)],
    ['OA route mix', Object.entries(p.oa || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(OA_LABEL[k] || k)} ${pct(n / oaTot, 0, true)}`).join(', ')],
    ['Main subfields', (p.subfields || []).map((s) => `${esc(s.name)} <small>(${fmt(s.works)})</small>`).join('; ') || 'Not available'],
  ]);
  const pts = [
    `Citation impact: ${fwciPhrase(p.mean_fwci)}, ${vsMedian(p.mean_fwci, cb.mean_fwci) || ''} among ${fmt(cb.n)} profiled ${esc(cname)} institutions.`.replace(', among', ' among'),
    p.top10_share !== null ? `Highly cited work: ${share(p.top10_share)} of its papers are in the world's top 10% most cited (10% would be the world norm).` : null,
    main ? `Open-access route: mainly ${esc(OA_LABEL[main[0]] || main[0])} (${pct(main[1] / oaTot, 0, true)} of works).` : null,
    sfTop ? `Specialisation: its largest subfield, ${esc(sfTop.name)}, accounts for ${pct(sfTop.works / Math.max(1, p.works), 1, true)} of its SEA OA works.` : null,
    `Size: rank ${fmt(p.rank_in_country)} in ${esc(cname)} by SEA OA works; ${fmt(p.works)} works vs a median of ${fmt(cb.works)} among profiled institutions there.`,
  ];
  const narrative = `${esc(p.name)} is ${p.rank_in_country <= 10 ? `one of the ten largest producers of open-access research in ${esc(cname)}` : `a ${esc(cname)} institution ranked ${fmt(p.rank_in_country)} by open-access output`}. Its work is cited ${fwciPhrase(p.mean_fwci) || 'at an unknown rate'}${main ? `, and most of it is published as ${esc((OA_LABEL[main[0]] || main[0]).toLowerCase())} open access` : ''}.`;
  const ex = p.experts && p.experts.length ? `<ul class="plain">${p.experts.map((e) => `<li>${inner('author', { id: e.author, name: e.name }, e.name)} <small>h-index ${fmt(e.h)} (within a subfield)</small></li>`).join('')}</ul>
      ${p.n_experts > p.experts.length ? `<p class="note">${fmt(p.n_experts)} listed experts in total; the 10 with the highest h-index are shown.</p>` : ''}`
    : '<p class="note">None of the listed experts (top 40 per subfield) has this as main SEA affiliation.</p>';
  const links = [btn(http(p.url), 'Website'), btn(http(p.ror), 'ROR'), btn(oaLink('I', p.id), 'OpenAlex'),
    p.in_network ? `<a class="btn ghost small" href="#/networks/institutions/_/id/${p.id}" data-nav>Locate in institution network</a>` : '',
    `<a class="btn ghost small" href="#/country/${p.cc}," data-nav>${esc(cname)} in Country Comparator</a>`].join(' ');
  open(p.name, `Institution · ${cname}`, `${facts}${section('What this means', means(pts, narrative))}${section('Leading experts affiliated here', ex)}
    ${section('Links', `<p class="plinks">${links}</p>`)}
    <p class="note">Counts: distinct SEA OA works with at least one author whose first SEA affiliation is this institution (${SNAP}). Peer medians: profiled institutions in the same country with ≥ ${(bench && bench.min_works) || 20} works.</p>`);
}

// ---------------------------------------------------------------- country
async function country(ref) {
  const cc = String(ref.id || '').toUpperCase();
  if (!SEA.includes(cc)) { missing('Country', ref, null); return; }
  const [ov, c, inf] = await Promise.all([load('overview/sea_macro_summary.json'), tryLoad(`countries/${cc}.json`), tryLoad('inflow/inflow_summary.json')]);
  const rows = ov.countries; const s = rows.find((r) => r.cc === cc);
  if (!s) { missing('Country', ref, null); return; }
  const rk = (k) => 1 + rows.filter((r) => (r[k] ?? -1) > (s[k] ?? -1)).length;
  const nir = inf && inf.country_nir.find((r) => r.cc === cc);
  const partner = c && c.partners && c.partners[0];
  const sf = c && c.subfields && c.subfields[0];
  const facts = dl([
    ['OA works', `${fmt(s.oa_works)} <small>(rank ${rk('oa_works')} of 11)</small>`],
    ['OA share of all works', pct(s.oa_share, 1)],
    ['OA growth (CAGR, 10 years)', pct(s.cagr_10y, 1)],
    ['Mean FWCI', `${n2(s.mean_fwci)} <small>(rank ${rk('mean_fwci')} of 11)</small>`],
    ['Top 10% cited share', share(s.top10_share)],
    ['International co-authorship', share(s.intl_share)],
    nir ? ['Citations from non-OA works (NIR)', pct(nir.nir, 1)] : null,
    partner ? ['Main co-authoring country', `${esc(SEA_NAMES[partner.cc] || partner.cc)} <small>(${fmt(partner.works)} works)</small>`] : null,
    sf ? ['Largest subfield', `${esc(sf.name)} <small>(${fmt(sf.works)} works)</small>`] : null,
  ]);
  const pts = [
    `Scale: rank ${rk('oa_works')} of 11 by open-access output; ${pct(s.oa_share, 1)} of its works are open access.`,
    `Growth: open-access output grew ${pct(s.cagr_10y, 1)} per year on average over the last ten years.`,
    `Citation impact: ${fwciPhrase(s.mean_fwci)}; ${share(s.top10_share)} of papers are in the world's top 10% (10% = world norm).`,
    `Collaboration: ${share(s.intl_share)} of OA works have a co-author outside Southeast Asia${partner ? `; the most frequent partner country is ${esc(SEA_NAMES[partner.cc] || partner.cc)}` : ''}.`,
    nir ? `Use beyond open access: ${pct(nir.nir, 1)} of the citations its OA works receive come from paywalled literature.` : null,
  ];
  const narrative = `${esc(SEA_NAMES[cc])} contributes ${fmt(s.oa_works)} open-access works to the SEA corpus (rank ${rk('oa_works')} of 11). `
    + `${s.mean_fwci >= 1 ? 'On average these works are cited at or above the world average' : 'On average these works are cited below the world average'} (FWCI ${fmt(s.mean_fwci, 2)}), `
    + `${s.intl_share >= 0.3 ? 'and a large share involves international co-authors.' : 'and most are produced without co-authors from outside the region.'}`;
  open(SEA_NAMES[cc], 'Country', `${facts}${section('What this means', means(pts, narrative))}
    ${section('Links', `<p class="plinks"><a class="btn ghost small" href="#/country/${cc}," data-nav>Open in Country Comparator</a> <a class="btn ghost small" href="#/overview" data-nav>Regional Overview</a> ${btn(`https://openalex.org/works?filter=authorships.countries:countries/${cc.toLowerCase()},open_access.is_oa:true`, 'OpenAlex works')}</p>`)}
    <p class="note">Full counting: a co-authored work counts for every SEA country involved (${SNAP}).</p>`);
}

// ---------------------------------------------------------------- author (leading experts only)
async function author(ref) {
  const id = Number(ref.id);
  const b = id ? await tryLoad(`profiles/authors/${id % 32}.json`) : null;
  const a = b && b[String(id)];
  if (!a) { missing('Author', ref, id ? oaLink('A', id) : (ref.name ? `https://openalex.org/authors?search=${encodeURIComponent(ref.name)}` : null)); return; }
  const best = a.subfields[0];
  const cname = SEA_NAMES[a.cc] || a.cc;
  const facts = dl([
    ['Main SEA affiliation', a.inst ? (a.inst_id ? inner('institution', { id: a.inst_id, name: a.inst }, a.inst) : esc(a.inst)) : 'Not available'],
    ['Country', a.cc ? inner('country', { id: a.cc, name: cname }, cname) : 'Not available'],
    ['ORCID', http(a.orcid) ? extLink(a.orcid, esc(a.orcid.replace('https://orcid.org/', ''))) : 'Not available'],
    ['Listed as leading expert in', `${fmt(a.subfields.length)} subfield${a.subfields.length > 1 ? 's' : ''}`],
  ]);
  const tbl = `<div class="table-wrap"><table><thead><tr><th>Subfield</th><th class="num">Rank</th><th class="num">h-index</th><th class="num">Works</th><th class="num">FWCI</th></tr></thead><tbody>
    ${a.subfields.map((s) => `<tr><td><a href="#/experts/${s.id}/a/${a.id}" data-nav>${esc(s.name)}</a></td><td class="num">${fmt(s.rank)}</td><td class="num">${fmt(s.h)}</td><td class="num">${fmt(s.works)}</td><td class="num">${n2(s.mean_fwci)}</td></tr>`).join('')}</tbody></table></div>`;
  const pts = [
    `Standing: rank ${fmt(best.rank)} of 40 listed experts in ${esc(best.name)} (h-index ${fmt(best.h)} within that subfield's SEA OA works).`,
    best.mean_fwci !== null ? `Citation impact in ${esc(best.name)}: ${fwciPhrase(best.mean_fwci)}.` : null,
    best.top10 ? `Highly cited work: ${fmt(best.top10)} of ${fmt(best.works)} works (${pct(best.top10 / Math.max(1, best.works), 0, true)}) are in the world's top 10% most cited.` : null,
    best.first_year ? `Activity: SEA OA works from ${best.first_year} to ${best.last_year}.` : null,
    a.subfields.length > 1 ? `Breadth: also listed in ${a.subfields.slice(1, 4).map((s) => esc(s.name)).join(', ')}${a.subfields.length > 4 ? ' and more' : ''}.` : null,
  ];
  const narrative = `${esc(a.name)}${a.inst ? ` (${esc(a.inst)})` : ''} is one of the leading SEA-affiliated authors in ${esc(best.name)}, ranked ${fmt(best.rank)} by h-index among open-access works in that subfield.`;
  const links = [btn(http(a.orcid), 'ORCID'), btn(oaLink('A', a.id), 'OpenAlex'), `<a class="btn ghost small" href="#/experts/${best.id}/a/${a.id}" data-nav>Open in Experts &amp; Topics</a>`].join(' ');
  open(a.name, `Author · ${a.inst || cname || ''}`, `${facts}${section('What this means', means(pts, narrative))}${section('Subfields', tbl)}${section('Links', `<p class="plinks">${links}</p>`)}
    <p class="note">h-index, works and FWCI are computed within each subfield's SEA OA works with a SEA affiliation, not over the author's whole career (${SNAP}).</p>`);
}

// ---------------------------------------------------------------- subfield
async function subfield(ref) {
  const [d, ix] = await Promise.all([tryLoad(`experts/${ref.id}.json`), load('experts/index.json')]);
  if (!d) { missing('Subfield', ref, null); return; }
  const s = d.scope; const subs = ix.subfields;
  const rk = 1 + subs.filter((x) => (x.works || 0) > (s.works || 0)).length;
  const tot = d.countries.reduce((a, r) => a + r.works, 0) || 1;
  const lead = d.countries[0];
  const facts = dl([
    ['Field / domain', `${esc(s.field)} · ${esc(s.domain)}`],
    ['SEA OA works', `${fmt(s.works)} <small>(rank ${rk} of ${subs.length} subfields)</small>`],
    ['Citations', fmt(s.cites)],
    ['Mean FWCI', n2(s.mean_fwci)],
    ['Countries (full counting)', d.countries.slice(0, 5).map((r) => `${esc(SEA_NAMES[r.cc] || r.cc)} ${pct(r.works / tot, 0, true)}`).join(', ')],
    ['Leading expert', d.experts[0] ? inner('author', { id: d.experts[0].author, name: d.experts[0].name }, d.experts[0].name) : 'Not available'],
  ]);
  const pts = [
    `Size: rank ${rk} of ${subs.length} subfields by SEA open-access output.`,
    `Citation impact: ${fwciPhrase(s.mean_fwci)}.`,
    lead ? `Concentration: ${esc(SEA_NAMES[lead.cc] || lead.cc)} accounts for ${pct(lead.works / tot, 0, true)} of country contributions.` : null,
    d.topics[0] ? `Main topic: ${esc(d.topics[0].topic)} (${fmt(d.topics[0].works)} works, FWCI ${n2(d.topics[0].mean_fwci)}).` : null,
  ];
  const narrative = `${esc(s.name)} is ${rk <= 25 ? 'one of the larger research areas' : rk <= 100 ? 'a mid-sized research area' : 'a smaller research area'} in SEA open-access output${lead ? `, led by ${esc(SEA_NAMES[lead.cc] || lead.cc)}` : ''}, and its works are cited ${fwciPhrase(s.mean_fwci) || 'at an unknown rate'}.`;
  open(s.name, `Subfield · ${s.field}`, `${facts}${section('What this means', means(pts, narrative))}
    ${section('Links', `<p class="plinks"><a class="btn ghost small" href="#/experts/${s.id}" data-nav>Experts &amp; topics</a> <a class="btn ghost small" href="#/networks/papers/${s.id}" data-nav>Paper network</a> <a class="btn ghost small" href="#/networks/coauthor/${s.id}" data-nav>Co-authorship network</a> ${btn(`https://openalex.org/subfields/${s.id}`, 'OpenAlex')}</p>`)}`);
}

// ---------------------------------------------------------------- work (from a network map node)
function work(ref) {
  const w = ref;
  const doi = w.doi ? (http(w.doi) || `https://doi.org/${w.doi}`) : null;
  const facts = dl([
    ['Year', esc(w.year || 'Not available')],
    ['Venue', esc(w.journal || 'Not available')],
    w.cited_by !== undefined ? ['Citations (OpenAlex)', fmt(w.cited_by)] : null,
    w.cocited_by !== undefined ? ['Co-citing SEA OA works', fmt(w.cocited_by)] : null,
    w.fwci !== undefined && w.fwci !== null ? ['FWCI', n2(w.fwci)] : null,
    w.oa_status ? ['OA route', esc(OA_LABEL[w.oa_status] || w.oa_status)] : null,
    w.country ? ['Lead SEA country', esc(SEA_NAMES[w.country] || w.country)] : null,
  ]);
  const pts = [
    w.fwci !== undefined && w.fwci !== null ? `Citation impact: ${fwciPhrase(w.fwci)}.` : null,
    w.cocited_by ? `Influence on SEA research: cited together with other references by ${fmt(w.cocited_by)} SEA open-access works in this field.` : null,
    w.year && w.cited_by ? `Pace: about ${fmt(w.cited_by / Math.max(1, 2026 - w.year), 0)} citations per year since publication.` : null,
  ];
  open(w.name || w.label || 'Work', 'Publication', `${facts}${section('What this means', means(pts, null))}
    ${section('Links', `<p class="plinks">${btn(doi, 'DOI')} ${btn(http(w.url), 'Publisher page')} ${w.id ? btn(oaLink('W', w.id), 'OpenAlex') : ''}</p>`)}`);
}

const KINDS = { journal, publisher, institution, country, author, subfield, work };
/** Opens the profile panel. kind: journal | publisher | institution | country | author | subfield | work; ref: {id, name, ...}. */
export async function openProfile(kind, ref = {}) {
  const f = KINDS[kind];
  if (!f) return;
  try { await f(ref); } catch (e) { missing(kind[0].toUpperCase() + kind.slice(1), ref, null); }
}
