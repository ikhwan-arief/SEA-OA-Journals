/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Methods, definitions and limitations.
import { load, esc, fmt } from '../lib.js';

export async function render(main) {
  let meta = {};
  try { meta = (await load('overview/sea_macro_summary.json')).meta; } catch (e) { /* data not generated yet */ }
  let gates = null;
  try { gates = await load('reports/quality_gates.json'); } catch (e) { /* optional */ }
  main.innerHTML = `<article class="prose panel">
    <h1>Methodology &amp; Data Coverage</h1>
    <p>The SEA Open Access Observatory (project SEA-OA-Journals) is a research-intelligence observatory for open-access (OA) scholarship from Brunei Darussalam, Cambodia, Indonesia, Laos, Malaysia, Myanmar, the Philippines, Singapore, Thailand, Timor-Leste and Vietnam.</p>
    <h2>Data sources</h2>
    <ul>
      <li><strong>OpenAlex</strong> Parquet snapshot ${esc(meta.snapshot_date || '')} streamed from the public S3 bucket with DuckDB (CC0 licence).</li>
      <li><strong>Scimago Journal &amp; Country Rank 2025</strong> master export, joined by ISSN.</li>
    </ul>
    <h2>Inclusion rules</h2>
    <ul>
      <li>Primary items: works with <code>open_access.is_oa = true</code> and at least one authorship institution whose country code is one of the eleven SEA countries; paratext is excluded.</li>
      <li>Closed SEA works are used only as a contrast group (OA share, citation matrix, Citation Advantage Ratio).</li>
      <li>Country counts use full counting: a multi-country work counts once for each contributing SEA country.</li>
    </ul>
    <h2>OA route definitions (OpenAlex <code>oa_status</code>)</h2>
    <ul>
      <li><strong>Diamond</strong>: free to read in a journal that charges no article processing charge.</li>
      <li><strong>Gold</strong>: published in a fully OA journal (APC may apply).</li>
      <li><strong>Hybrid</strong>: openly licensed article in a subscription journal.</li>
      <li><strong>Bronze</strong>: free to read on the publisher site without an open licence.</li>
      <li><strong>Green</strong>: free copy only in a repository.</li>
    </ul>
    <h2>Journal crosswalk and periodisation</h2>
    <ul>
      <li>OpenAlex sources are matched to Scimago 2025 by ISSN-L and every listed ISSN (normalised NNNN-NNNN); if several SJR records match, the highest SJR is kept.</li>
      <li>Quartile = Scimago “SJR Best Quartile”. <em>Unindexed</em> = no ISSN match; <em>In SJR, no quartile</em> = listed without a best quartile.</li>
      <li>Years are publication years of the works (citing-work year for citation inflow). The most recent year is incomplete in any snapshot.</li>
      <li>Missing values are shown as <em>Not available</em> (absent in source), <em>Not indexed</em> (absent from SJR) or <em>Insufficient data</em> (too few observations); they are never replaced by zero.</li>
    </ul>
    <h2>Indicators</h2>
    <ul>
      <li><strong>Non-OA Inflow Ratio (NIR)</strong> = citations from closed / paywalled works ÷ all citations received × 100%.</li>
      <li><strong>Citation Advantage Ratio (CAR)</strong> = citations per SEA OA work (or per OA route) ÷ citations per SEA closed work, both counted from snapshot citation links.</li>
      <li id="ncs-method"><strong>Normalized Citation Score (NCS)</strong> = citations of a work ÷ mean citations of all SEA works (OA and non-OA together) with the same publication year, OpenAlex primary-topic subfield (field when the subfield cell has fewer than 30 works) and OpenAlex document type. <strong>Normalized citation ratio</strong> = mean NCS (OA) ÷ mean NCS (non-OA). Two observation windows: a 3-year window (citing works dated up to publication year + 2; cohorts up to 2023) and cumulative counts to the snapshot. Works without field or type, in reference cells with fewer than 30 works, or in cells with zero mean citations receive no NCS and are reported as excluded. 95% intervals: publication-level Poisson bootstrap, 1,000 replicates, baselines held fixed. This is an internal SEA baseline, not an official FWCI or CNCI. Full method, counts and validation results: <a href="#/inflow">Citation Inflow → Normalized Citation Impact</a>.</li>
      <li><strong>Scholarly Research Flows country filter</strong>: Flow A counts a work once per selected contributing country (full counting) and also reports the number of unique works; Flows B and C include each work or citation link once when at least one author is affiliated with a selected country. Top-N journals and funders are re-ranked for the selection.</li>
      <li><strong>Citation Inflow country filter</strong>: the matrix, KPI cards, citing-year, OA-route and citing-region panels include each SEA work and citation link once when at least one author is affiliated with a selected country (deduplicated; with one country this equals that country's full-counted NIR). The citing-venue quartile panel and the closed-venue table remain region-wide because the citing venue is not stored per cited work. The interactive normalized-impact table counts each work once for any selection: sum of the single-country tables minus (number of selected countries on the work − 1) × the work's figures for multi-country works.</li>
      <li><strong>Journal Landscape</strong>: journals whose OpenAlex host country is a SEA country and that carry SEA OA works. Indexing status (one per journal): SJR quartile; listed in SCImago without a quartile; DOAJ only; neither. Model: Diamond when at least half of the journal's SEA OA works are Diamond OA, else “APC recorded” when OpenAlex lists an APC. Active journals = journals with at least one SEA OA work in the year. Candidates for wider indexing: no SJR quartile, ≥ 100 SEA OA works and mean FWCI ≥ 1 (young journals can reach this with few citations).</li>
      <li><strong>Year filters</strong>: Citation Inflow filters by the publication year of the cited SEA work (works before 2000 form one group); the citing-venue quartile panel, the closed-venue table and journal tables are not year-filterable. Experts &amp; Topics recomputes the expert ranking for the last 10 or 5 publication years with the same h-index rule on works published in that period only; the year range there applies to the topic and country charts (topics: the scope's 40 largest topics over all years, re-ranked for the range).</li>
      <li><strong>Profile panels</strong> (click a journal, publisher, institution, country, author, subfield or mapped publication): figures are summaries of the dashboard data for that entity (SEA OA works unless labelled “whole journal”). The “What this means” notes are computed from those figures with fixed rules: FWCI against the world average (1.00), and percentiles / medians against peers (journals of the same SJR tier, institutions of the same country, each with at least 20 SEA OA works). They are descriptive, not quality judgements. Author profiles exist for the leading experts only (top 40 per subfield); other authors link to OpenAlex.</li>
      <li><strong>FWCI</strong>, top-1% and top-10% flags are taken from OpenAlex (field-, year- and type-normalised).</li>
      <li><strong>Expert ranking</strong>: h-index computed within the subfield's SEA OA corpus for authorships carrying a SEA affiliation, ties broken by citations.</li>
      <li><strong>Hidden gems</strong>: journals with mean FWCI ≥ 1 and SJR below the median of SJR-indexed SEA OA journals.</li>
    </ul>
    <h2>Networks</h2>
    <ul>
      <li><strong>Bibliographic coupling</strong>: shared cited references, normalised by Salton's cosine <code>s(a,b) = |R(a) ∩ R(b)| / √(|R(a)|·|R(b)|)</code>. Journal level: top 1,000 SEA OA journals; references cited by more than 250 journals are ignored as non-discriminating.</li>
      <li><strong>Direct citation</strong>: directed links citing → cited among the most-cited papers in each subfield.</li>
      <li><strong>Co-citation</strong>: pairs of references cited together by SEA OA works in a field, Salton-normalised. Reference IDs that OpenAlex has since merged into another work are counted under the surviving work (each citing work once); IDs that no longer exist in OpenAlex (deleted records, e.g. W4285719527, which is listed as “cited” by millions of works across every field) are excluded. Also excluded are records to which OpenAlex attaches many unrelated references (verified by sampling their citing works): W2945792041 / W4288400169 (“Yaşlı Kadınlarda Üreme Sağlığı”), W4300009529 (“Summary for Policymakers”, CUP eBooks 2014) and W2033815440 (an eddy-current testing paper, 2014). These are excluded before counting, so clusters, layout and metrics are computed without them.</li>
      <li><strong>Co-authorship / collaboration</strong>: shared SEA OA works between experts or institutions.</li>
      <li>Communities: Louvain (resolution 1, fixed seed); layout: ForceAtlas2; each node keeps its strongest links for legibility.</li>
    </ul>
    <h2>Limitations</h2>
    <ul>
      <li>Affiliation, OA status and citation links inherit OpenAlex coverage and disambiguation errors.</li>
      <li>SJR matching depends on ISSN completeness in both sources; venues without a match are reported as “Unindexed”.</li>
      <li>Citation inflow counts only links resolvable inside the snapshot.</li>
    </ul>
    ${gates ? `<h2>Quality gates (last pipeline run)</h2><ul>${gates.gates.map((g) => `<li>${g.pass ? '✅' : '❌'} <strong>${esc(g.name)}</strong>: ${esc(g.detail)}</li>`).join('')}</ul>` : ''}
    <h2>Attribution</h2>
    <p>Developed by Ikhwan Arief (ikhwan[at]unand.ac.id). Copyright © 2026 Ikhwan Arief. Copyright held by the application developer.</p>
  </article>`;
  void fmt;
}
