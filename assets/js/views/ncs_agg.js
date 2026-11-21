/*
 * Developed by Ikhwan Arief (ikhwan[at]unand.ac.id).
 * Copyright (c) 2026 Ikhwan Arief. Copyright held by the application developer.
 */
// Interactive NCS table: sums cube rows (inflow/ncs/cube_*.json, scripts/build_ncs.py) for a filter.
// For several countries each work is counted once: the single-country cubes are added and the multi-country
// rows of cube_MULTI (per exact country mask) are subtracted (|mask ∩ selection| − 1) times. All columns are additive.
// Returns [non-OA, OA] accumulators {n, nn, cites, ncs, h[0..H]}.
export function sumCubes(cubes, { countries, sel, wk, y0, y1, field = '', tg = '', tier = '' }) {
  const bits = sel.reduce((x, c) => x | (1 << countries.indexOf(c)), 0);
  const pop = (m) => { let k = 0; for (let v = m & bits; v; v &= v - 1) k += 1; return k; };
  const H = cubes[0].cols.filter((c) => /^h\d+$/.test(c)).length;
  const acc = [0, 1].map(() => ({ n: 0, nn: 0, cites: 0, ncs: 0, h: new Array(H + 1).fill(0) }));
  cubes.forEach((cube) => {
    const ix = Object.fromEntries(cube.cols.map((c, i) => [c, i])); const wi = cube.windows.indexOf(wk); const multi = 'mask' in ix;
    cube.rows.forEach((r) => {
      if (r[ix.win] !== wi || r[ix.year] < y0 || r[ix.year] > y1) return;
      if (field !== '' && String(r[ix.field]) !== String(field)) return; if (tg && r[ix.tg] !== tg) return; if (tier && r[ix.tier] !== tier) return;
      // a multi-country work outside the selection is in none of the added cubes: leave it out (weight 0)
      const k = multi ? pop(r[ix.mask]) : 1; const wgt = multi ? (k ? 1 - k : 0) : 1; if (!wgt) return;
      const s = acc[r[ix.oa]]; s.n += wgt * r[ix.n]; s.nn += wgt * r[ix.n_norm]; s.cites += wgt * r[ix.cites]; s.ncs += wgt * r[ix.ncs_sum];
      for (let k = 0; k < H; k += 1) s.h[k] += wgt * r[ix[`h${k}`]]; s.h[H] += wgt * r[ix.hgt];
    });
  });
  return { acc, H };
}
