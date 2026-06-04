import { useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { DatacenterCountRow } from '../types';
import { STATE_NAMES } from '../constants';

interface Props {
  rows: DatacenterCountRow[];
}

type ChartYear = '2021' | '2025';

const SCATTER_W = 420;
const SCATTER_H = 320;
const SCATTER_PAD = { top: 20, right: 20, bottom: 48, left: 52 };

export function DatacenterComparisonPanel({ rows }: Props) {
  const [chartYear, setChartYear] = useState<ChartYear>('2025');
  const [scatterHovered, setScatterHovered] = useState<DatacenterCountRow | null>(null);

  const total2021 = useMemo(() => d3.sum(rows, r => r.datacenter_count_2021), [rows]);
  const total2025 = useMemo(() => d3.sum(rows, r => r.datacenter_count_2025), [rows]);
  const totalGrowth = total2025 - total2021;
  const totalGrowthPct = total2021 > 0 ? (totalGrowth / total2021) * 100 : null;

  const top10_2021 = useMemo(
    () => [...rows].sort((a, b) => b.datacenter_count_2021 - a.datacenter_count_2021).slice(0, 10),
    [rows],
  );
  const top10_2025 = useMemo(
    () => [...rows].sort((a, b) => b.datacenter_count_2025 - a.datacenter_count_2025).slice(0, 10),
    [rows],
  );
  const top10Growth = useMemo(
    () => [...rows].sort((a, b) => b.datacenter_growth_2021_2025 - a.datacenter_growth_2021_2025).slice(0, 10),
    [rows],
  );

  const chartRows = chartYear === '2021' ? top10_2021 : top10_2025;
  const chartKey = chartYear === '2021' ? 'datacenter_count_2021' : 'datacenter_count_2025';
  const chartMax = d3.max(chartRows, r => r[chartKey]) ?? 1;

  // Scatter plot scales
  const scatterMax2021 = d3.max(rows, r => r.datacenter_count_2021) ?? 1;
  const scatterMax2025 = d3.max(rows, r => r.datacenter_count_2025) ?? 1;
  const xScale = d3.scaleLinear()
    .domain([0, scatterMax2021 * 1.1])
    .range([SCATTER_PAD.left, SCATTER_W - SCATTER_PAD.right]);
  const yScale = d3.scaleLinear()
    .domain([0, scatterMax2025 * 1.1])
    .range([SCATTER_H - SCATTER_PAD.bottom, SCATTER_PAD.top]);

  const kpiCards = [
    { label: 'Total DCs 2021 (OSM)', value: total2021.toLocaleString(), color: '#3b82f6' },
    { label: 'Total DCs 2025 (IM3)', value: total2025.toLocaleString(), color: '#0891b2' },
    { label: 'Net Growth', value: `+${totalGrowth.toLocaleString()}`, color: '#059669' },
    {
      label: 'Growth %',
      value: totalGrowthPct != null ? `+${totalGrowthPct.toFixed(1)}%` : 'n/a',
      color: '#7c3aed',
    },
  ];

  if (rows.length === 0) {
    return (
      <div className="growth-empty">
        <div className="growth-empty-title">No comparison data available</div>
        <p className="growth-empty-body">
          Run the data pipeline to generate the comparison CSV:
        </p>
        <code className="huc8-geo-cmd">python scripts/download_im3_datacenter_atlas_2025.py</code>
        <code className="huc8-geo-cmd">python scripts/compare_datacenter_counts_2021_2025.py</code>
      </div>
    );
  }

  return (
    <div className="growth-panel-inner">
      {/* KPI row */}
      <div className="growth-kpis">
        {kpiCards.map(c => (
          <div key={c.label} className="summary-card">
            <div className="card-label">{c.label}</div>
            <div className="card-value" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <p className="dc-note" style={{ marginTop: 0 }}>
        2021 locations are derived from historical OSM extraction. 2025 locations are from the
        IM3 Open Source Data Center Atlas. Counts are facility-location proxies and should not
        be interpreted as a complete census.
      </p>

      {/* Charts row */}
      <div className="growth-charts-row">
        {/* Bar chart */}
        <div className="growth-chart-panel">
          <div className="growth-chart-header">
            <span className="panel-title" style={{ margin: 0 }}>
              Top 10 States by Count
            </span>
            <div className="metric-selector" style={{ gap: 6 }}>
              {(['2021', '2025'] as ChartYear[]).map(y => (
                <button
                  key={y}
                  type="button"
                  className={`metric-btn${chartYear === y ? ' active' : ''}`}
                  style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => setChartYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="growth-bar-list">
            {chartRows.map((r, i) => {
              const val = r[chartKey];
              const pct = chartMax > 0 ? (val / chartMax) * 100 : 0;
              const color = chartYear === '2021' ? '#3b82f6' : '#0891b2';
              return (
                <div key={r.State} className="growth-bar-row">
                  <span className="rank-num">{i + 1}</span>
                  <div className="rank-state">
                    <span className="state-abbr">{r.State}</span>
                    <span className="state-name">{STATE_NAMES[r.State] ?? ''}</span>
                  </div>
                  <div className="growth-bar-track">
                    <div
                      className="growth-bar-fill"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <span className="rank-val">{val}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Growth ranking */}
        <div className="growth-chart-panel">
          <div className="panel-title">Top 10 States — Net Growth</div>
          <div className="growth-bar-list">
            {top10Growth.map((r, i) => {
              const val = r.datacenter_growth_2021_2025;
              const maxGrowth = top10Growth[0]?.datacenter_growth_2021_2025 ?? 1;
              const pct = maxGrowth > 0 ? Math.max(0, (val / maxGrowth)) * 100 : 0;
              return (
                <div key={r.State} className="growth-bar-row">
                  <span className="rank-num">{i + 1}</span>
                  <div className="rank-state">
                    <span className="state-abbr">{r.State}</span>
                    <span className="state-name">{STATE_NAMES[r.State] ?? ''}</span>
                  </div>
                  <div className="growth-bar-track">
                    <div
                      className="growth-bar-fill"
                      style={{ width: `${pct}%`, background: '#059669' }}
                    />
                  </div>
                  <span className="rank-val" style={{ color: val > 0 ? '#059669' : '#ef4444' }}>
                    {val > 0 ? `+${val}` : val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scatter plot */}
      <div className="growth-chart-panel growth-scatter-panel">
        <div className="panel-title">2021 vs 2025 Count — State Scatter</div>
        <div style={{ position: 'relative' }}>
          <svg
            width="100%"
            viewBox={`0 0 ${SCATTER_W} ${SCATTER_H}`}
            style={{ display: 'block', overflow: 'visible' }}
          >
            {/* Grid lines */}
            {xScale.ticks(5).map(t => (
              <line
                key={`xg-${t}`}
                x1={xScale(t)} x2={xScale(t)}
                y1={SCATTER_PAD.top} y2={SCATTER_H - SCATTER_PAD.bottom}
                stroke="#f1f5f9" strokeWidth={1}
              />
            ))}
            {yScale.ticks(5).map(t => (
              <line
                key={`yg-${t}`}
                x1={SCATTER_PAD.left} x2={SCATTER_W - SCATTER_PAD.right}
                y1={yScale(t)} y2={yScale(t)}
                stroke="#f1f5f9" strokeWidth={1}
              />
            ))}

            {/* Reference line y = x (equal growth) */}
            <line
              x1={xScale(0)} y1={yScale(0)}
              x2={xScale(Math.min(scatterMax2021, scatterMax2025))}
              y2={yScale(Math.min(scatterMax2021, scatterMax2025))}
              stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 3"
            />

            {/* Axes */}
            <line
              x1={SCATTER_PAD.left} x2={SCATTER_W - SCATTER_PAD.right}
              y1={SCATTER_H - SCATTER_PAD.bottom} y2={SCATTER_H - SCATTER_PAD.bottom}
              stroke="#cbd5e1" strokeWidth={1}
            />
            <line
              x1={SCATTER_PAD.left} x2={SCATTER_PAD.left}
              y1={SCATTER_PAD.top} y2={SCATTER_H - SCATTER_PAD.bottom}
              stroke="#cbd5e1" strokeWidth={1}
            />

            {/* Axis ticks + labels */}
            {xScale.ticks(5).map(t => (
              <g key={`xt-${t}`}>
                <line
                  x1={xScale(t)} x2={xScale(t)}
                  y1={SCATTER_H - SCATTER_PAD.bottom}
                  y2={SCATTER_H - SCATTER_PAD.bottom + 4}
                  stroke="#cbd5e1"
                />
                <text
                  x={xScale(t)} y={SCATTER_H - SCATTER_PAD.bottom + 14}
                  textAnchor="middle" fontSize={9} fill="#94a3b8"
                >{t}</text>
              </g>
            ))}
            {yScale.ticks(5).map(t => (
              <g key={`yt-${t}`}>
                <line
                  x1={SCATTER_PAD.left - 4} x2={SCATTER_PAD.left}
                  y1={yScale(t)} y2={yScale(t)}
                  stroke="#cbd5e1"
                />
                <text
                  x={SCATTER_PAD.left - 7} y={yScale(t) + 3}
                  textAnchor="end" fontSize={9} fill="#94a3b8"
                >{t}</text>
              </g>
            ))}

            {/* Axis labels */}
            <text
              x={(SCATTER_PAD.left + SCATTER_W - SCATTER_PAD.right) / 2}
              y={SCATTER_H - 2}
              textAnchor="middle" fontSize={10} fill="#64748b"
            >2021 count (OSM)</text>
            <text
              x={10}
              y={(SCATTER_PAD.top + SCATTER_H - SCATTER_PAD.bottom) / 2}
              textAnchor="middle" fontSize={10} fill="#64748b"
              transform={`rotate(-90, 10, ${(SCATTER_PAD.top + SCATTER_H - SCATTER_PAD.bottom) / 2})`}
            >2025 count (IM3)</text>

            {/* Points */}
            {rows.map(r => {
              const cx = xScale(r.datacenter_count_2021);
              const cy = yScale(r.datacenter_count_2025);
              const isHovered = scatterHovered?.State === r.State;
              return (
                <g key={r.State}>
                  <circle
                    cx={cx} cy={cy} r={isHovered ? 7 : 5}
                    fill={isHovered ? '#1e40af' : '#3b82f6'}
                    fillOpacity={0.75}
                    stroke="#fff" strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setScatterHovered(r)}
                    onMouseLeave={() => setScatterHovered(null)}
                  />
                  {(r.datacenter_count_2025 > scatterMax2025 * 0.5 ||
                    r.datacenter_count_2021 > scatterMax2021 * 0.5) && (
                    <text
                      x={cx + 8} y={cy + 3}
                      fontSize={9} fill="#475569" fontWeight={600}
                    >{r.State}</text>
                  )}
                </g>
              );
            })}
          </svg>

          {scatterHovered && (
            <div className="map-tooltip" style={{ position: 'absolute', top: 8, right: 8, left: 'auto' }}>
              <div className="tt-state">
                {STATE_NAMES[scatterHovered.State] ?? scatterHovered.State}
              </div>
              <div className="tt-row">
                <span className="tt-label">2021 (OSM)</span>
                <span className="tt-val">{scatterHovered.datacenter_count_2021}</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">2025 (IM3)</span>
                <span className="tt-val">{scatterHovered.datacenter_count_2025}</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">Growth</span>
                <span className="tt-val" style={{ color: '#059669' }}>
                  +{scatterHovered.datacenter_growth_2021_2025}
                </span>
              </div>
              {scatterHovered.total_facility_area_sqft_2025 != null && (
                <div className="tt-row">
                  <span className="tt-label">Area 2025</span>
                  <span className="tt-val">
                    {scatterHovered.total_facility_area_sqft_2025.toLocaleString()} sqft
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
