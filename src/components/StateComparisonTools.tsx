import type { DatacenterCountRow, MetricKey, StateRow } from '../types';
import { METRICS, STATE_NAMES } from '../constants';
import { formatFull } from '../utils/format';
import { StateFlag } from './StateFlag';
import {
  nationalFootprintTotals,
  selectedDataCenterTotals,
  selectedStateRows,
  selectedStateTotals,
} from '../tools/stateComparisonUtils';

type StateWeights = Record<MetricKey, number>;

const DEFAULT_COLORS: Record<MetricKey, string> = {
  Scaled_power_consumption_MWh: '#c4392c',
  Water_footprint_m3: '#0891b2',
  Carbon_footprint_tonsCO2e: '#7c3aed',
};

const METRIC_UNITS: Record<MetricKey, string> = {
  Scaled_power_consumption_MWh: 'MWh',
  Water_footprint_m3: 'm3',
  Carbon_footprint_tonsCO2e: 'tCO2e',
};

export interface StateToolCommonProps {
  rows: StateRow[];
  selectedStates: string[];
  countsByState: Map<string, DatacenterCountRow>;
  scoreFor: (row: StateRow) => number;
}

export function StateHeadToHeadComparisonPanel({
  rows,
  selectedStates,
  countsByState,
  scoreFor,
  onRemoveState,
}: StateToolCommonProps & {
  onRemoveState?: (state: string) => void;
}) {
  const selectedRows = selectedStateRows(rows, selectedStates);

  if (selectedRows.length === 0) {
    return (
      <div className="table-panel portfolio-card head-to-head empty">
        <div className="panel-title">State Head-to-Head</div>
        <p>Select two or more states on the map to compare data centers and environmental footprint side by side.</p>
      </div>
    );
  }

  return (
    <div className="head-to-head-board">
      {selectedRows.map((row, index) => {
        const counts = countsByState.get(row.State);
        const growth = (counts?.datacenter_count_2025 ?? 0) - (counts?.datacenter_count_2021 ?? 0);
        return (
          <article key={row.State} className="h2h-card">
            {index > 0 && <span className="vs-divider">VS</span>}
            {onRemoveState && (
              <button type="button" className="h2h-remove" onClick={() => onRemoveState(row.State)}>
                x
              </button>
            )}
            <div className="h2h-card-head">
              <StateFlag state={row.State} size="md" />
              <div>
                <strong>{row.State}</strong>
                <span>{STATE_NAMES[row.State] ?? row.State}</span>
              </div>
            </div>
            <div className="h2h-score">
              <strong>{(scoreFor(row) * 100).toFixed(1)}</strong>
              <span>footprint score</span>
            </div>
            <div className="h2h-dc-row">
              <div>
                <span>★ 2021</span>
                <strong>{counts?.datacenter_count_2021 ?? 0}</strong>
              </div>
              <div>
                <span>■ 2025</span>
                <strong>{counts?.datacenter_count_2025 ?? 0}</strong>
              </div>
              <em className={growth > 0 ? 'positive' : growth < 0 ? 'negative' : 'neutral'}>
                {growth > 0 ? '+' : ''}{growth}
              </em>
            </div>
            <div className="h2h-metrics">
              <div><span>Energy</span><strong>{formatFull(row.Scaled_power_consumption_MWh)} MWh</strong></div>
              <div><span>Water</span><strong>{formatFull(row.Water_footprint_m3)} m3</strong></div>
              <div><span>Carbon</span><strong>{formatFull(row.Carbon_footprint_tonsCO2e)} tCO2e</strong></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function CombinedSelectedStatesSummary({
  rows,
  selectedStates,
  countsByState,
  scoreFor,
}: StateToolCommonProps) {
  const selectedRows = selectedStateRows(rows, selectedStates);
  const totals = selectedStateTotals(rows, selectedStates);
  const dcTotals = selectedDataCenterTotals(rows, selectedStates, countsByState);
  const avgScore = selectedRows.length
    ? selectedRows.reduce((sum, row) => sum + scoreFor(row), 0) / selectedRows.length
    : 0;

  return (
    <section className="combined-card">
      <div className="combined-card-title">Combined Selected States</div>
      <div className="combined-score-row">
        <div>
          <strong>{(avgScore * 100).toFixed(1)}</strong>
          <span>avg footprint score</span>
        </div>
        <em>{selectedRows.length} selected state{selectedRows.length === 1 ? '' : 's'}</em>
      </div>
      <div className="combined-dc-grid">
        <div><span>★ 2021 DCs</span><strong>{dcTotals.count2021}</strong></div>
        <div><span>■ 2025 DCs</span><strong>{dcTotals.count2025}</strong></div>
        <div className="combined-growth-cell">
          <span>Growth</span>
          <strong>{dcTotals.count2025 - dcTotals.count2021 >= 0 ? '+' : ''}{dcTotals.count2025 - dcTotals.count2021}</strong>
        </div>
      </div>
      <div className="portfolio-metrics">
        <NationalShareComparison label="Energy" value={totals.energy} total={nationalFootprintTotals(rows).energy} unit="MWh" />
        <NationalShareComparison label="Water" value={totals.water} total={nationalFootprintTotals(rows).water} unit="m3" />
        <NationalShareComparison label="Carbon" value={totals.carbon} total={nationalFootprintTotals(rows).carbon} unit="tCO2e" />
      </div>
    </section>
  );
}

export function NationalShareComparison({
  label,
  value,
  total,
  unit,
}: {
  label: string;
  value: number;
  total: number;
  unit: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="portfolio-metric">
      <div>
        <span>{label}</span>
        <strong>{formatFull(value)} {unit}</strong>
      </div>
      <div className="contribution-track">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <em>{pct.toFixed(1)}% of U.S.</em>
    </div>
  );
}

export function StateIntelligenceCard({
  rows,
  state,
  weights,
  countsByState,
  scoreFor,
}: {
  rows: StateRow[];
  state: string | null;
  weights: StateWeights;
  countsByState: Map<string, DatacenterCountRow>;
  scoreFor: (row: StateRow) => number;
}) {
  const row = state ? rows.find(item => item.State === state) ?? null : null;

  if (!row) {
    return (
      <div className="table-panel insight-card empty">
        <div className="panel-title">State Intelligence</div>
        <p>Pin a state from the map, ranking, or selector to see weighted score drivers.</p>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => scoreFor(b) - scoreFor(a));
  const rank = sorted.findIndex(item => item.State === row.State) + 1;
  const counts = countsByState.get(row.State);
  const weightTotal = METRICS.reduce((sum, metric) => sum + weights[metric.key], 0) || 1;

  return (
    <div className="table-panel insight-card">
      <div className="insight-card-header">
        <div>
          <div className="panel-title">State Intelligence</div>
          <div className="insight-state">
            <StateFlag state={row.State} size="md" />
            {STATE_NAMES[row.State] ?? row.State}
          </div>
        </div>
        <div className="insight-rank">Rank #{rank}</div>
      </div>
      <div className="insight-score-row">
        <div>
          <span className="insight-score">{(scoreFor(row) * 100).toFixed(1)}</span>
          <span className="insight-score-label">score</span>
        </div>
      </div>
      <div className="contribution-list">
        {METRICS.map(metric => {
          const max = Math.max(...rows.map(item => item[metric.key]), 1);
          const contribution = (row[metric.key] / max) * (weights[metric.key] / weightTotal);
          const pct = Math.min(100, contribution * 100);
          return (
            <div key={metric.key} className="contribution-row">
              <div className="contribution-label">
                <span className="weight-dot" style={{ background: DEFAULT_COLORS[metric.key] }} />
                {metric.label.replace(' Demand', '').replace(' Footprint', '')}
              </div>
              <div className="contribution-track">
                <span style={{ width: `${pct}%`, background: DEFAULT_COLORS[metric.key] }} />
              </div>
              <div className="contribution-pct">{pct.toFixed(0)}%</div>
            </div>
          );
        })}
      </div>
      <div className="insight-metrics">
        {METRICS.map(metric => (
          <div key={metric.key}>
            <span>{metric.label}</span>
            <strong>{formatFull(row[metric.key])} {METRIC_UNITS[metric.key]}</strong>
          </div>
        ))}
      </div>
      {counts && (
        <div className="insight-dc-counts">
          <div className="insight-dc-title">Data Centers</div>
          <div className="insight-dc-row">
            <div className="insight-dc-cell"><span className="insight-dc-year">2021</span><strong className="insight-dc-val">{counts.datacenter_count_2021}</strong></div>
            <div className="insight-dc-arrow">→</div>
            <div className="insight-dc-cell"><span className="insight-dc-year">2025</span><strong className="insight-dc-val">{counts.datacenter_count_2025}</strong></div>
            <div className={`insight-dc-growth ${counts.datacenter_growth_2021_2025 > 0 ? 'positive' : counts.datacenter_growth_2021_2025 < 0 ? 'negative' : 'neutral'}`}>
              {counts.datacenter_growth_2021_2025 > 0 ? '+' : ''}{counts.datacenter_growth_2021_2025}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FacilityGrowthImpactAnalysis({
  rows,
  selectedStates,
  countsByState,
}: Pick<StateToolCommonProps, 'rows' | 'selectedStates' | 'countsByState'>) {
  const selectedRows = selectedStateRows(rows, selectedStates);
  const impacts = selectedRows.map(row => {
    const counts = countsByState.get(row.State);
    const ratio = counts && counts.datacenter_count_2025 > 0
      ? Math.min(1, counts.datacenter_count_2021 / counts.datacenter_count_2025)
      : 0;
    return {
      state: row.State,
      count2021: counts?.datacenter_count_2021 ?? 0,
      count2025: counts?.datacenter_count_2025 ?? 0,
      energy2021: row.Scaled_power_consumption_MWh * ratio,
      energy2025: row.Scaled_power_consumption_MWh,
      water2021: row.Water_footprint_m3 * ratio,
      water2025: row.Water_footprint_m3,
      carbon2021: row.Carbon_footprint_tonsCO2e * ratio,
      carbon2025: row.Carbon_footprint_tonsCO2e,
    };
  });

  return (
    <div className="analytics-panel">
      <div className="analytics-section-label">2021 to 2025 Facility Growth Analysis</div>
      {impacts.map(item => (
        <div key={item.state} className="growth-impact-bars">
          <strong>{item.state}: {item.count2021}→{item.count2025} data centers</strong>
          <GrowthImpactMini label="Energy" value2021={item.energy2021} value2025={item.energy2025} color="#c4392c" unit="MWh" />
          <GrowthImpactMini label="Water" value2021={item.water2021} value2025={item.water2025} color="#0891b2" unit="m3" />
          <GrowthImpactMini label="Carbon" value2021={item.carbon2021} value2025={item.carbon2025} color="#7c3aed" unit="tCO2e" />
        </div>
      ))}
    </div>
  );
}

function GrowthImpactMini({
  label,
  value2021,
  value2025,
  color,
  unit,
}: {
  label: string;
  value2021: number;
  value2025: number;
  color: string;
  unit: string;
}) {
  const max = Math.max(value2021, value2025, 1);
  return (
    <div className="gim-row">
      <span className="gim-label">{label}</span>
      <div className="gim-bars">
        <div className="gim-bar-row">
          <span className="gim-year">★ 2021</span>
          <div className="gim-track"><div className="gim-bar" style={{ width: `${(value2021 / max) * 100}%`, background: color, opacity: 0.3 }} /></div>
          <span className="gim-val">{formatFull(value2021)} {unit}</span>
        </div>
        <div className="gim-bar-row">
          <span className="gim-year">■ 2025</span>
          <div className="gim-track"><div className="gim-bar" style={{ width: `${(value2025 / max) * 100}%`, background: color }} /></div>
          <span className="gim-val">{formatFull(value2025)} {unit}</span>
        </div>
      </div>
    </div>
  );
}

export function RiskCorrelationAnalysis({
  rows,
  countsByState,
}: {
  rows: StateRow[];
  countsByState: Map<string, DatacenterCountRow>;
}) {
  const joined = rows
    .map(row => ({ row, counts: countsByState.get(row.State) }))
    .filter((item): item is { row: StateRow; counts: DatacenterCountRow } => Boolean(item.counts));

  const centers2025 = joined.map(item => item.counts.datacenter_count_2025);
  const growth = joined.map(item => item.counts.datacenter_growth_2021_2025);

  return (
    <div className="analytics-panel">
      <div className="analytics-section-label">Risk / Correlation Analysis</div>
      <div className="benchmark-grid">
        <CorrelationCard label="2025 centers vs energy" value={pearson(centers2025, joined.map(item => item.row.Scaled_power_consumption_MWh))} />
        <CorrelationCard label="2025 centers vs water" value={pearson(centers2025, joined.map(item => item.row.Water_footprint_m3))} />
        <CorrelationCard label="2025 centers vs carbon" value={pearson(centers2025, joined.map(item => item.row.Carbon_footprint_tonsCO2e))} />
        <CorrelationCard label="Growth vs energy" value={pearson(growth, joined.map(item => item.row.Scaled_power_consumption_MWh))} />
      </div>
    </div>
  );
}

function CorrelationCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="benchmark-card">
      <div className="benchmark-card-head">
        <span>{label}</span>
        <strong>{value.toFixed(2)}</strong>
      </div>
      <em>{Math.abs(value) > 0.7 ? 'strong relationship' : Math.abs(value) > 0.4 ? 'moderate relationship' : 'weak relationship'}</em>
    </div>
  );
}

function pearson(xs: number[], ys: number[]) {
  if (xs.length !== ys.length || xs.length === 0) return 0;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  const numerator = xs.reduce((sum, x, index) => sum + ((x - meanX) * (ys[index] - meanY)), 0);
  const denominator = Math.sqrt(
    xs.reduce((sum, x) => sum + ((x - meanX) ** 2), 0) *
    ys.reduce((sum, y) => sum + ((y - meanY) ** 2), 0),
  );
  return denominator === 0 ? 0 : numerator / denominator;
}
