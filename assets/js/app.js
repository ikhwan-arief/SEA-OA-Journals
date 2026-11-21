/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Command Center shell: hash router, responsive sidebar, breadcrumbs, snapshot badge and global search.
import { addPngButtons, destroyCharts, drawer, errorState, esc, hideTip, load, setMeta, skeleton, tryLoad, fmt, openInstitution, setSearchHandler, getSearchHandler } from './lib.js';

const routes = {
  overview: { label: 'Regional Overview', mod: () => import('./views/overview.js') },
  country: { label: 'Country Comparator', mod: () => import('./views/country.js') },
  experts: { label: 'Experts & Topics', mod: () => import('./views/experts.js') },
  networks: { label: 'Network Explorer', mod: () => import('./views/networks.js') },
  inflow: { label: 'Citation Inflow', mod: () => import('./views/inflow.js') },
  sjr: { label: 'SJR Matrix', mod: () => import('./views/sjr.js') },
  sankey: { label: 'Research Flows', title: 'Scholarly Research Flows', mod: () => import('./views/sankey.js') },
  about: { label: 'Methodology & Data Coverage', mod: () => import('./views/about.js') },
};
const STALE_DAYS = 120;
let cleanup = null;
let token = 0;
const app = document.getElementById('app');

function parse() {
  const [name = 'overview', ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { route: routes[name] ? name : 'overview', args: args.map(decodeURIComponent) };
}

async function render() {
  const { route, args } = parse();
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.getElementById('crumbs').innerHTML = `<span>SEA-OA-Journals</span><span aria-hidden="true">/</span><strong>${esc(routes[route].label)}</strong>`;
  document.title = `${routes[route].title || routes[route].label} · SEA-OA-Journals`;
  closeNav();
  drawer.close();
  const main = document.getElementById('main');
  const my = ++token;
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  destroyCharts();
  hideTip();
  setSearchHandler(null);
  skeleton(main);
  try {
    const mod = await routes[route].mod();
    if (my !== token) return;
    // Views await their data first (skeleton stays visible), then replace main's content.
    cleanup = (await mod.render(main, args, () => my !== token)) || null;
    if (my === token) addPngButtons(main);
  } catch (err) {
    if (my !== token) return;
    errorState(main, err, render);
    console.error(err);
  }
}

// ---------------------------------------------------------------- sidebar
function closeNav() { app.classList.remove('nav-open'); document.getElementById('menuBtn').setAttribute('aria-expanded', 'false'); document.querySelector('.scrim')?.remove(); }
function initShell() {
  const collapse = document.getElementById('collapseBtn');
  let collapsed = false;
  try { collapsed = localStorage.getItem('soa-sidebar') === 'collapsed'; } catch (e) { /* storage unavailable */ }
  const apply = () => { app.classList.toggle('collapsed', collapsed); collapse.setAttribute('aria-pressed', String(collapsed)); collapse.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar'); };
  apply();
  collapse.addEventListener('click', () => { collapsed = !collapsed; apply(); try { localStorage.setItem('soa-sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (e) { /* ignore */ } });
  const menu = document.getElementById('menuBtn');
  menu.addEventListener('click', () => {
    if (app.classList.contains('nav-open')) { closeNav(); return; }
    app.classList.add('nav-open'); menu.setAttribute('aria-expanded', 'true');
    const s = document.createElement('div'); s.className = 'scrim'; s.addEventListener('click', closeNav); document.body.appendChild(s);
    document.querySelector('.nav a')?.focus();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && app.classList.contains('nav-open')) { closeNav(); menu.focus(); } });
}

async function initSnapshot() {
  const el = document.getElementById('snapshot');
  const ov = await tryLoad('overview/sea_macro_summary.json');
  if (!ov) { el.textContent = 'Data snapshot: not built yet'; return; }
  setMeta(ov.meta);
  const d = ov.meta.snapshot_date;
  const age = d ? (Date.now() - Date.parse(d)) / 864e5 : null;
  el.textContent = `Data snapshot: ${d || 'unknown'}`;
  if (age !== null && age > STALE_DAYS) { el.classList.add('stale'); el.textContent += ' (stale)'; el.title = `Snapshot is ${Math.round(age)} days old; indicators are not real-time.`; }
}

// ---------------------------------------------------------------- global search (debounced, grouped by entity type)
function initSearch() {
  const input = document.getElementById('globalSearch');
  const box = document.getElementById('searchResults');
  let index = null; let timer = null; let items = []; let active = -1;
  const groups = [['journals', 'Journals'], ['authors', 'Authors'], ['institutions', 'Institutions'], ['topics', 'Topics & subfields'], ['countries', 'Countries']];
  async function ensure() { if (!index) index = await load('search_index.json'); return index; }
  function hide() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
  async function run() {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { hide(); return; }
    let ix;
    try { ix = await ensure(); } catch (e) { box.innerHTML = '<div class="none">Search index not available yet.</div>'; box.hidden = false; return; }
    const hd = getSearchHandler(); const here = { institutions: 'open institution profile', ...((hd && hd.kinds) || {}) };
    const cur = routes[parse().route].label;
    // kinds the active tab can show come first
    const ordered = [...groups].sort((a, b) => (here[b[0]] ? 1 : 0) - (here[a[0]] ? 1 : 0));
    const res = ordered.map(([k, label]) => [k, label, (ix[k] || []).filter((r) => r.n.toLowerCase().includes(q) || (r.x && r.x.toLowerCase().includes(q))).slice(0, 6)]).filter(([, , r]) => r.length);
    // a group holding an exact name match (e.g. the country "Indonesia") goes before partial matches
    const exact = (rs) => rs.some((r) => r.n.toLowerCase() === q);
    res.sort((a, b) => (here[b[0]] ? 1 : 0) - (here[a[0]] ? 1 : 0) || exact(b[2]) - exact(a[2]));
    // entities drawn on the active tab itself (e.g. the nodes of the open network map) come first
    if (hd && hd.extra) { let ex = []; try { ex = hd.extra(input.value) || []; } catch (e) { ex = []; } if (ex.length) res.unshift(['here', 'On this map', ex]); }
    items = [];
    const dest = (k, r) => (k === 'here' ? here.here : here[k] ? `${here[k]} · ${cur}` : `opens ${(routes[String(r.h).replace(/^#\//, '').split('/')[0]] || {}).label || ''}`);
    box.innerHTML = res.length ? res.map(([k, label, rs]) => `<h3>${esc(label)}${here[k] && k !== 'here' ? ' <span class="here">on this tab</span>' : ''}</h3>${rs.map((r) => { items.push({ k, r }); return `<a role="option" href="${esc(r.h)}" data-i="${items.length - 1}" id="sr-${items.length - 1}">${esc(r.n)}${r.d ? `<small>${esc(r.d)}</small>` : ''}<small class="dest">${esc(dest(k, r))}</small></a>`; }).join('')}`).join('')
      : '<div class="none">No matching journals, authors, institutions, topics or countries.</div>';
    // author search covers only the named expert set; say so when no author matched, and point to OpenAlex
    if (q.length >= 3 && !res.length) {
      box.insertAdjacentHTML('beforeend', `<div class="none author-note"><strong>No matching author among the listed experts.</strong>
        Author search covers only the leading experts (top 40 per subfield, ${fmt(new Set((ix.authors || []).map((r) => String(r.h).split('/').pop())).size)} people); other authors are counted in the statistics but not listed by name.
        <a class="ext" href="https://openalex.org/authors?search=${encodeURIComponent(input.value.trim())}" target="_blank" rel="noopener">Search all authors on OpenAlex ↗</a></div>`);
    }
    box.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 220); });
  input.addEventListener('keydown', (e) => {
    const links = [...box.querySelectorAll('a[role="option"]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!links.length) return; e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((a, i) => a.classList.toggle('on', i === active));
      input.setAttribute('aria-activedescendant', links[active].id);
    } else if (e.key === 'Enter' && active >= 0 && links[active]) { e.preventDefault(); go(links[active]); hide(); input.blur(); } else if (e.key === 'Escape') hide();
  });
  // run the active tab's handler when it accepts the kind; otherwise follow the default link
  function go(a) {
    const it = items[Number(a.dataset.i)]; const hd = getSearchHandler();
    if (it && hd && hd.kinds && hd.kinds[it.k]) { hd.run(it.k, it.r); return true; }
    if (it && it.k === 'institutions') { openInstitution(it.r); return true; }
    location.hash = a.getAttribute('href'); return true;
  }
  box.addEventListener('click', (e) => { const a = e.target.closest('a[role="option"]'); if (!a) return; e.preventDefault(); go(a); hide(); input.blur(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) hide(); });
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', async () => { initShell(); initSearch(); await initSnapshot(); render(); });
