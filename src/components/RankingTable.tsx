import * as d3 from 'd3';
import type { StateRow, MetricKey, DatacenterCountRow } from '../types';
import { STATE_NAMES } from '../constants';

interface Props {
  data: StateRow[];
  weights: Record<MetricKey, number>;
  selectedState: string | null;
  activeState: string | null;
  selectedStates: string[];
  countsByState?: Map<string, DatacenterCountRow>;
  onHoverState: (state: string | null) => void;
  onSelectState: (state: string | null) => void;
  onTogglePortfolioState: (state: string) => void;
}

function Sparkline({ count2021, count2025 }: { count2021: number; count2025: number }) {
  const w = 44, h = 20;
  const max = Math.max(count2021, count2025, 1);
  const x1 = 2, y1 = h - 2 - ((count2021 / max) * (h - 8));
  const x2 = w - 2, y2 = h - 2 - ((count2025 / max) * (h - 8));
  const rising = count2025 > count2021;
  const color = rising ? '#16a34a' : count2025 < count2021 ? '#dc2626' : '#94a3b8';
  const label = rising ? `+${count2025 - count2021}` : count2025 < count2021 ? `${count2025 - count2021}` : 'no change';
  return (
    <svg width={w} height={h} className="sparkline-svg" aria-label={`2021: ${count2021} → 2025: ${count2025} (${label})`}>
      <title>{`2021: ${count2021} → 2025: ${count2025} (${label})`}</title>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={x1} cy={y1} r={2.5} fill={color} fillOpacity={0.5} />
      <circle cx={x2} cy={y2} r={3} fill={color} />
    </svg>
  );
}

const COMPOSITE_KEYS: MetricKey[] = [
  'Scaled_power_consumption_MWh',
  'Water_footprint_m3',
  'Carbon_footprint_tonsCO2e',
];

function buildScore(data: StateRow[], weights: Record<MetricKey, number>) {
  const maxByKey = new Map<MetricKey, number>(
    COMPOSITE_KEYS.map(key => [key, d3.max(data, d => d[key]) ?? 1]),
  );
  const weightTotal = d3.sum(COMPOSITE_KEYS, key => weights[key]);
  const normalizedWeightFor = (key: MetricKey) =>
    weightTotal > 0 ? weights[key] / weightTotal : 1 / COMPOSITE_KEYS.length;

  return (row: StateRow) =>
    d3.sum(
      COMPOSITE_KEYS,
      key => (row[key] / (maxByKey.get(key) || 1)) * normalizedWeightFor(key),
    );
}

export function RankingTable({
  data,
  weights,
  selectedState,
  activeState,
  selectedStates,
  countsByState,
  onHoverState,
  onSelectState,
  onTogglePortfolioState,
}: Props) {
  const scoreFor = buildScore(data, weights);
  const sorted = [...data]
    .sort((a, b) => scoreFor(b) - scoreFor(a))
    .slice(0, 10);

  const maxVal = sorted.length > 0 ? scoreFor(sorted[0]) || 1 : 1;

  return (
    <div className="table-panel">
      <div className="panel-title">Top 10 — Combined Footprint</div>
      <table className="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>State</th>
            <th style={{ textAlign: 'right' }}>Score</th>
            <th></th>
            {countsByState && <th title="2021→2025 growth trend">Trend</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const score = scoreFor(row);
            const pct = (score / maxVal) * 100;
            return (
              <tr
                key={row.State}
                className={`${row.State === activeState ? 'linked-row selected' : 'linked-row'}${selectedStates.includes(row.State) ? ' portfolio-row' : ''}`}
                onMouseEnter={() => onHoverState(row.State)}
                onMouseLeave={() => onHoverState(null)}
                onClick={() => onSelectState(row.State === selectedState ? null : row.State)}
              >
                <td className="rank-num">{i + 1}</td>
                <td className="rank-state">
                  <span className="state-abbr">{row.State}</span>
                  <span className="state-name">{STATE_NAMES[row.State] ?? row.State}</span>
                </td>
                <td className="rank-val">{(score * 100).toFixed(1)}</td>
                <td className="rank-bar-cell">
                  <div className="rank-bar-bg">
                    <div className="rank-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </td>
                {countsByState && (
                  <td className="rank-sparkline-cell">
                    {(() => {
                      const counts = countsByState.get(row.State);
                      return counts ? (
                        <Sparkline
                          count2021={counts.datacenter_count_2021}
                          count2025={counts.datacenter_count_2025}
                        />
                      ) : null;
                    })()}
                  </td>
                )}
                <td>
                  <button
                    type="button"
                    className="row-add-btn"
                    onClick={event => {
                      event.stopPropagation();
                      onTogglePortfolioState(row.State);
                    }}
                  >
                    {selectedStates.includes(row.State) ? '−' : '+'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
