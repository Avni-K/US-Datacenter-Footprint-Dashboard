import * as d3 from 'd3';

const fmtComma = d3.format(',.0f');

export function formatFull(v: number): string {
  return fmtComma(v);
}

export function formatCompact(v: number): string {
  if (v >= 1e9) return `${d3.format('.2f')(v / 1e9)}B`;
  if (v >= 1e6) return `${d3.format('.2f')(v / 1e6)}M`;
  if (v >= 1e3) return `${d3.format('.1f')(v / 1e3)}K`;
  return fmtComma(v);
}
