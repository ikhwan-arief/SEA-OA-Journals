# SEA Open Access Observatory

Research, journals and citation flows in Southeast Asia: an interactive dashboard of open-access research from the
11 Southeast Asian countries (Brunei, Cambodia, Indonesia, Laos, Malaysia, Myanmar, the Philippines, Singapore,
Thailand, Timor-Leste and Vietnam).

**Live site:** https://ikhwan-arief.github.io/SEA-OA-Journals/

## Contents

- Regional Overview and Country Comparator
- Experts & Topics and Network Explorer (journal, paper, co-citation, co-authorship and institutional networks)
- OA Citation Inflow, including a Normalized Citation Impact analysis (field-, year- and document-type-normalized,
  with bootstrap intervals and venue-tier stratification)
- Journal Landscape (the ecosystem of journals hosted in Southeast Asia: indexing, DOAJ, Diamond OA, APCs, growth)
- SJR Matrix and Scholarly Research Flows
- Profile panels for journals, publishers, institutions, countries, expert authors, subfields and publications
- Methodology page describing every indicator

## Data sources

- OpenAlex snapshot of 2026-10-14 (CC0), https://openalex.org
- SCImago Journal & Country Rank 2025, https://www.scimagojr.com

This repository holds only the static web application and its pre-aggregated JSON data. The extraction and
processing pipeline runs offline and is not part of this repository. Figures describe OpenAlex records and are
not an official ranking.

## Running locally

Any static web server works, for example:

```sh
python3 -m http.server 8000
```

then open http://localhost:8000/.

## Third-party components

Chart.js, D3, d3-sankey, Graphology, Sigma.js, flag-icons and the UN SDG icons are included under their own
licences; see `assets/vendor/`.

## Author

Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
