import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { StateRow, MetricKey, DatacenterCountRow } from '../types';
import { STATE_NAMES } from '../constants';
import { formatFull } from '../utils/format';

const COMPOSITE_KEYS: MetricKey[] = [
  'Scaled_power_consumption_MWh',
  'Water_footprint_m3',
  'Carbon_footprint_tonsCO2e',
];

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; unit: string }> = {
  Scaled_power_consumption_MWh: { label: 'Energy', color: '#c4392c', unit: 'MWh' },
  Water_footprint_m3:           { label: 'Water',  color: '#0891b2', unit: 'm³'  },
  Carbon_footprint_tonsCO2e:    { label: 'Carbon', color: '#7c3aed', unit: 'tCO₂e' },
};

type ViewMode = 'composite' | MetricKey;

interface Props {
  data: StateRow[];
  weights: Record<MetricKey, number>;
  scoreFor: (row: StateRow) => number;
  countsByState: Map<string, DatacenterCountRow>;
  selectedStates: string[];
  onSelectState: (state: string) => void;
}

export function TopStatesBarChart({
  data,
  weights,
  scoreFor,
  countsByState,
  selectedStates,
  onSelectState,
}: Props) {
  const [view, setView] = useState<ViewMode>('composite');
  const [topN, setTopN] = useState(10);

  const { sorted, maxVal, dominantColor } = useMemo(() => {
    const dominant = COMPOSITE_KEYS.reduce((best, k) =>
      weights[k] > weights[best] ? k : best,
    );
    const dominantColor = METRIC_CONFIG[dominant].color;

    let sorted: { row: StateRow; value: number }[];
    let maxVal: number;

    if (view === 'composite') {
      sorted = [...data]
        .map(row => ({ row, value: scoreFor(row) * 100 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topN);
      maxVal = sorted[0]?.value || 1;
    } else {
      const key = view as MetricKey;
      const max = d3.max(data, r => r[key]) || 1;
      sorted = [...data]
        .map(row => ({ row, value: row[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topN);
      maxVal = max;
    }

    return { sorted, maxVal, dominantColor };
  }, [data, weights, scoreFor, view, topN]);

  const barColor = view === 'composite' ? dominantColor : METRIC_CONFIG[view as MetricKey].color;

  return (
    <div className="top-bar-panel">
      <div className="top-bar-header">
        <div className="panel-title">Top States — Bar Chart</div>
        <div className="top-bar-controls">
          <div className="segmented-control">
            <button
              type="button"
              className={view === 'composite' ? 'active' : ''}
              onClick={() => setView('composite')}
            >
              Combined
            </button>
            {COMPOSITE_KEYS.map(k => (
              <button
                key={k}
                type="button"
                className={view === k ? 'active' : ''}
                onClick={() => setView(k)}
                style={view === k ? { background: METRIC_CONFIG[k].color, color: '#fff', borderColor: METRIC_CONFIG[k].color } : {}}
              >
                {METRIC_CONFIG[k].label}
              </button>
            ))}
          </div>
          <label className="top-bar-n-control">
            <span>Top</span>
            <input
              type="range"
              min={5}
              max={51}
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
            />
            <span>{topN}</span>
          </label>
        </div>
      </div>

      <div className="top-bar-list">
        {sorted.map(({ row, value }, i) => {
          const pct = (value / maxVal) * 100;
          const isSelected = selectedStates.includes(row.State);
          const label =
            view === 'composite'
              ? `${value.toFixed(1)} score`
              : `${formatFull(value)} ${METRIC_CONFIG[view as MetricKey].unit}`;

          return (
            <div
              key={row.State}
              className={`top-bar-row${isSelected ? ' top-bar-selected' : ''}`}
              onClick={() => onSelectState(row.State)}
            >
              <div className="top-bar-rank">{i + 1}</div>
              <div className="top-bar-state">
                <span className="state-abbr">{row.State}</span>
                <span className="state-name-sm">{STATE_NAMES[row.State] ?? row.State}</span>
              </div>
              <div className="top-bar-track">
                <div
                  className="top-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: isSelected
                      ? '#0f172a'
                      : barColor,
                    transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              </div>
              <div className="top-bar-val">{label}</div>
              <div className="top-bar-dc">
                {countsByState.get(row.State)
                  ? `${countsByState.get(row.State)!.datacenter_count_2025} DCs`
                  : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
