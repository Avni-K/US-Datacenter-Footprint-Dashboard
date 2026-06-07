import { Fragment, useMemo, useState } from 'react';
import { useStateData } from './hooks/useStateData';
import { useIm3Locations } from './hooks/useIm3Locations';
import { useDatacenterLocations } from './hooks/useDatacenterLocations';
import { useDatacenterCounts } from './hooks/useDatacenterCounts';
import { ChoroplethMap } from './components/ChoroplethMap';
import { SummaryCards } from './components/SummaryCards';
import { RankingTable } from './components/RankingTable';
import { SitingRiskTool } from './components/SitingRiskTool';
import { Huc8ScarcityMap } from './components/Huc8ScarcityMap';
import { DatacenterMap } from './components/DatacenterMap';
import { StateFlag } from './components/StateFlag';
import type { DatacenterCountRow, MetricKey } from './types';
import type { StateRow } from './types';
import { STATE_NAMES } from './constants';
import { formatFull } from './utils/format';
import './App.css';

type TabId = 'footprint' | 'im3' | 'osm2021';

const TABS: { id: TabId; label: string }[] = [
  { id: 'footprint', label: 'Environmental Footprint' },
  { id: 'im3',       label: 'Data Centers (2025)' },
  { id: 'osm2021',   label: 'Data Centers (2021)' },
];

type StateWeights = Record<MetricKey, number>;

const DEFAULT_STATE_WEIGHTS: StateWeights = {
  Scaled_power_consumption_MWh: 34,
  Water_footprint_m3: 33,
  Carbon_footprint_tonsCO2e: 33,
};

const STATE_WEIGHT_CONTROLS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'Scaled_power_consumption_MWh', label: 'Energy', color: '#c4392c' },
  { key: 'Water_footprint_m3', label: 'Water', color: '#0891b2' },
  { key: 'Carbon_footprint_tonsCO2e', label: 'Carbon', color: '#7c3aed' },
];

const METRIC_LABELS: Record<MetricKey, string> = {
  Scaled_power_consumption_MWh: 'Energy',
  Water_footprint_m3: 'Water',
  Carbon_footprint_tonsCO2e: 'Carbon',
};

const METRIC_UNITS: Record<MetricKey, string> = {
  Scaled_power_consumption_MWh: 'MWh',
  Water_footprint_m3: 'm3',
  Carbon_footprint_tonsCO2e: 'tCO2e',
};

export default function App() {
  const { rows, loading, dataByState } = useStateData();
  const { locations: im3Locations, loading: im3Loading } = useIm3Locations();
  const { locations: osmLocations, loading: osmLoading } = useDatacenterLocations();
  const { dataByState: datacenterCountsByState, loading: countsLoading } = useDatacenterCounts();
  const [tab, setTab] = useState<TabId>('footprint');
  const stateWeights = DEFAULT_STATE_WEIGHTS;
  const stateFocusCount = 15;
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [show2021Centers, setShow2021Centers] = useState(true);
  const [show2025Centers, setShow2025Centers] = useState(true);
  const [drilldownState, setDrilldownState] = useState<string | null>(null);
  const activeState = selectedState ?? hoveredState;
  const selectedStateRow = activeState ? dataByState.get(activeState) ?? null : null;
  const stateScore = useMemo(
    () => buildStateScore(rows, stateWeights),
    [rows, stateWeights],
  );
  const portfolioRows = useMemo(
    () => rows.filter(row => selectedStates.includes(row.State)),
    [rows, selectedStates],
  );
  const combinedCenters = useMemo(
    () => [
      ...(show2025Centers ? im3Locations.map(loc => ({ ...loc, overlayYear: '2025' as const })) : []),
      ...(show2021Centers ? osmLocations.map(loc => ({ ...loc, overlayYear: '2021' as const })) : []),
    ],
    [im3Locations, osmLocations, show2021Centers, show2025Centers],
  );
  const togglePortfolioState = (state: string) => {
    setSelectedStates(current =>
      current.includes(state)
        ? current.filter(item => item !== state)
        : [...current, state],
    );
  };

  if (loading || im3Loading || osmLoading || countsLoading) {
    return (
      <div className="dash-loading">
        <span>Loading data…</span>
      </div>
    );
  }

  return (
    <div className="dash-root">
      <div className="dash-inner">
        <header className="dash-header">
          <h1>U.S. Data Center Environmental Footprint</h1>
          <p>State-level energy demand, water use, and carbon emissions from data center operations</p>
        </header>

        <div className="tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`metric-btn${t.id === tab ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'footprint' && (
          <>
            <SummaryCards data={rows} />

            <StateCommandBar
              rows={rows}
              activeState={activeState}
              selectedState={selectedState}
              selectedStates={selectedStates}
              scoreFor={stateScore}
              countsByState={datacenterCountsByState}
              onSelectState={setSelectedState}
              onTogglePortfolioState={togglePortfolioState}
              onClearPortfolio={() => setSelectedStates([])}
            />

            <div className="dash-main">
              {/* Left column: map + analytics stacked together */}
              <div className="dash-left-col">
                <div className="map-panel">
                  <div className="map-panel-header">
                    <div className="panel-title">Combined Environmental Footprint by State</div>
                    <div className="overlay-controls">
                      <label>
                        <input
                          type="checkbox"
                          checked={show2025Centers}
                          onChange={event => setShow2025Centers(event.target.checked)}
                        />
                        ■ 2025 centers
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={show2021Centers}
                          onChange={event => setShow2021Centers(event.target.checked)}
                        />
                        ★ 2021 centers
                      </label>
                    </div>
                  </div>
                  <ChoroplethMap
                    data={rows}
                    dataByState={dataByState}
                    weights={stateWeights}
                    focusCount={stateFocusCount}
                    selectedState={selectedState}
                    selectedStates={selectedStates}
                    activeState={activeState}
                    onSelectState={setSelectedState}
                    onTogglePortfolioState={togglePortfolioState}
                    datacenterLocations={combinedCenters}
                    datacenterCountsByState={datacenterCountsByState}
                    drilldownState={drilldownState}
                    onSetSelectedStates={setSelectedStates}
                    onDrilldownState={setDrilldownState}
                  />
                </div>
                {selectedStates.length > 0 && (
                  <PortfolioPanel
                    rows={rows}
                    selectedStates={selectedStates}
                    weights={stateWeights}
                    scoreFor={stateScore}
                    countsByState={datacenterCountsByState}
                    onRemoveState={togglePortfolioState}
                    onClear={() => setSelectedStates([])}
                  />
                )}
              </div>

              <div className="insight-rail">
                <SmartInsightsPanel
                  rows={rows}
                  selectedRows={portfolioRows}
                  activeRow={selectedStateRow}
                  scoreFor={stateScore}
                />
                <StateInsightPanel
                  data={rows}
                  row={selectedStateRow}
                  weights={stateWeights}
                  scoreFor={stateScore}
                  countsByState={datacenterCountsByState}
                  onClear={() => setSelectedState(null)}
                />
                <DrilldownPanel
                  row={drilldownState ? dataByState.get(drilldownState) ?? null : null}
                  counts={drilldownState ? datacenterCountsByState.get(drilldownState) ?? null : null}
                  scoreFor={stateScore}
                  onClear={() => setDrilldownState(null)}
                />
                <RankingTable
                  data={rows}
                  weights={stateWeights}
                  selectedState={selectedState}
                  activeState={activeState}
                  selectedStates={selectedStates}
                  countsByState={datacenterCountsByState}
                  onHoverState={setHoveredState}
                  onSelectState={setSelectedState}
                  onTogglePortfolioState={togglePortfolioState}
                />
              </div>
            </div>

            <SitingRiskTool />
            <Huc8ScarcityMap />
          </>
        )}

        {tab === 'im3' && (
          <div className="map-panel">
            <div className="panel-title">
              IM3 Open Source Data Center Atlas — 2025
              <span className="dc-count">{im3Locations.length} facilities</span>
            </div>
            <p className="dc-note">
              Source: IM3 Open Source Data Center Atlas (OSTI DOI: 2550666). Derived from
              OpenStreetMap. Layers: point, building footprint, campus. Hover a dot for details.
            </p>
            <DatacenterMap locations={im3Locations} />
          </div>
        )}

        {tab === 'osm2021' && (
          <div className="map-panel">
            <div className="panel-title">
              OSM-tagged Data Centers — 2021 North America Snapshot
              <span className="dc-count">{osmLocations.length} facilities</span>
            </div>
            <p className="dc-note">
              Sourced from an OpenStreetMap 2021 extract. Coverage is incomplete — only
              explicitly tagged facilities are shown. Hover a dot for details.
            </p>
            <DatacenterMap locations={osmLocations} />
          </div>
        )}
      </div>
    </div>
  );
}

function buildStateScore(
  data: StateRow[],
  weights: StateWeights,
) {
  const keys = STATE_WEIGHT_CONTROLS.map(control => control.key);
  const maxByKey = new Map<MetricKey, number>(
    keys.map(key => [key, Math.max(...data.map(row => row[key])) || 1]),
  );
  const weightTotal = keys.reduce((sum, key) => sum + weights[key], 0);

  return (row: StateRow) =>
    keys.reduce((sum, key) => {
      const normalizedWeight = weightTotal > 0 ? weights[key] / weightTotal : 1 / keys.length;
      return sum + (row[key] / (maxByKey.get(key) || 1)) * normalizedWeight;
    }, 0);
}

function StateCommandBar({
  rows,
  activeState,
  selectedState,
  selectedStates,
  scoreFor,
  countsByState,
  onSelectState,
  onTogglePortfolioState,
  onClearPortfolio,
}: {
  rows: StateRow[];
  activeState: string | null;
  selectedState: string | null;
  selectedStates: string[];
  scoreFor: (row: StateRow) => number;
  countsByState: Map<string, DatacenterCountRow>;
  onSelectState: (state: string | null) => void;
  onTogglePortfolioState: (state: string) => void;
  onClearPortfolio: () => void;
}) {
  const sortedRows = [...rows].sort((a, b) =>
    (STATE_NAMES[a.State] ?? a.State).localeCompare(STATE_NAMES[b.State] ?? b.State),
  );
  const activeRow = activeState ? rows.find(row => row.State === activeState) ?? null : null;
  const selectedRows = rows.filter(row => selectedStates.includes(row.State));
  const benchmarkRows = selectedRows.length > 0 ? selectedRows : activeRow ? [activeRow] : [];
  const benchmarkTitle = selectedRows.length > 0
    ? `${selectedRows.length} selected state${selectedRows.length === 1 ? '' : 's'}`
    : activeRow
      ? STATE_NAMES[activeRow.State] ?? activeRow.State
      : 'Select states';

  return (
    <div className="state-command-shell">
      <div className="state-command-bar">
        <label className="state-picker">
          <span>Jump to State</span>
          <select
            value={selectedState ?? ''}
            onChange={event => onSelectState(event.target.value || null)}
          >
            <option value="">Choose a state</option>
            {sortedRows.map(row => (
                <option key={row.State} value={row.State}>
                  {STATE_NAMES[row.State] ?? row.State}
                </option>
              ))}
          </select>
        </label>
        <div className="state-chip-row">
          {activeState ? (
            <button type="button" className="state-chip active" onClick={() => onSelectState(null)}>
              <StateFlag state={activeState} />
              {STATE_NAMES[activeState] ?? activeState} pinned
            </button>
          ) : (
            <span className="state-chip">Click a state or row to pin details</span>
          )}
        </div>
        {selectedStates.length > 0 && (
          <div className="portfolio-chips">
            {selectedStates.map(state => (
              <button
                key={state}
                type="button"
                className="state-chip active"
                onClick={() => onTogglePortfolioState(state)}
              >
                <StateFlag state={state} />
                {state} ×
              </button>
            ))}
            <button type="button" className="state-chip clear-chip" onClick={onClearPortfolio}>
              Clear
            </button>
          </div>
        )}
      </div>
      <StateAnalyticsPanel
        rows={rows}
        benchmarkRows={benchmarkRows}
        benchmarkTitle={benchmarkTitle}
        activeState={activeState}
        scoreFor={scoreFor}
        countsByState={countsByState}
      />
    </div>
  );
}

function StateAnalyticsPanel({
  rows,
  benchmarkRows,
  benchmarkTitle,
  activeState,
  scoreFor,
  countsByState,
}: {
  rows: StateRow[];
  benchmarkRows: StateRow[];
  benchmarkTitle: string;
  activeState: string | null;
  scoreFor: (row: StateRow) => number;
  countsByState: Map<string, DatacenterCountRow>;
}) {
  // ── Section 1: National benchmark ────────────────────────────────
  const avg = (values: number[]) =>
    values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  const dcRows = rows.map(r => countsByState.get(r.State)).filter(Boolean) as DatacenterCountRow[];
  const benchmarkDcRows = benchmarkRows.map(r => countsByState.get(r.State)).filter(Boolean) as DatacenterCountRow[];
  const national = {
    score:  avg(rows.map(r => scoreFor(r) * 100)),
    dc2021: avg(dcRows.map(r => r.datacenter_count_2021)),
    dc2025: avg(dcRows.map(r => r.datacenter_count_2025)),
    growth: avg(dcRows.map(r => r.datacenter_growth_2021_2025)),
    energy: avg(rows.map(r => r.Scaled_power_consumption_MWh / 1_000_000)),
    water:  avg(rows.map(r => r.Water_footprint_m3 / 1_000_000)),
    carbon: avg(rows.map(r => r.Carbon_footprint_tonsCO2e / 1_000)),
  };
  const selected = benchmarkRows.length > 0 ? {
    score:  avg(benchmarkRows.map(r => scoreFor(r) * 100)),
    dc2021: avg(benchmarkDcRows.map(r => r.datacenter_count_2021)),
    dc2025: avg(benchmarkDcRows.map(r => r.datacenter_count_2025)),
    growth: avg(benchmarkDcRows.map(r => r.datacenter_growth_2021_2025)),
    energy: avg(benchmarkRows.map(r => r.Scaled_power_consumption_MWh / 1_000_000)),
    water:  avg(benchmarkRows.map(r => r.Water_footprint_m3 / 1_000_000)),
    carbon: avg(benchmarkRows.map(r => r.Carbon_footprint_tonsCO2e / 1_000)),
  } : null;

  // ── Section 2: Growth impact ──────────────────────────────────────
  const focusRows = benchmarkRows.length > 0
    ? benchmarkRows
    : activeState ? rows.filter(r => r.State === activeState) : [];
  const estimateRows = focusRows.map(row => {
    const counts = countsByState.get(row.State);
    if (!counts) return null;
    const ratio = counts.datacenter_count_2025 > 0
      ? Math.min(1, counts.datacenter_count_2021 / counts.datacenter_count_2025) : 0;
    return {
      count2021: counts.datacenter_count_2021,
      count2025: counts.datacenter_count_2025,
      growth: counts.datacenter_count_2025 - counts.datacenter_count_2021,
      energy2021: row.Scaled_power_consumption_MWh * ratio,
      water2021:  row.Water_footprint_m3 * ratio,
      carbon2021: row.Carbon_footprint_tonsCO2e * ratio,
      energyAdded: Math.max(0, row.Scaled_power_consumption_MWh * (1 - ratio)),
      waterAdded:  Math.max(0, row.Water_footprint_m3 * (1 - ratio)),
      carbonAdded: Math.max(0, row.Carbon_footprint_tonsCO2e * (1 - ratio)),
      energy2025: row.Scaled_power_consumption_MWh,
      water2025:  row.Water_footprint_m3,
      carbon2025: row.Carbon_footprint_tonsCO2e,
    };
  }).filter(Boolean) as NonNullable<ReturnType<typeof focusRows[0] extends never ? never : (row: StateRow) => unknown>>[];

  const zero = { count2021:0,count2025:0,growth:0,energy2021:0,water2021:0,carbon2021:0,energyAdded:0,waterAdded:0,carbonAdded:0,energy2025:0,water2025:0,carbon2025:0 };
  const totals = (estimateRows as typeof zero[]).reduce((s, r) => ({
    count2021:   s.count2021   + r.count2021,
    count2025:   s.count2025   + r.count2025,
    growth:      s.growth      + r.growth,
    energy2021:  s.energy2021  + r.energy2021,
    water2021:   s.water2021   + r.water2021,
    carbon2021:  s.carbon2021  + r.carbon2021,
    energyAdded: s.energyAdded + r.energyAdded,
    waterAdded:  s.waterAdded  + r.waterAdded,
    carbonAdded: s.carbonAdded + r.carbonAdded,
    energy2025:  s.energy2025  + r.energy2025,
    water2025:   s.water2025   + r.water2025,
    carbon2025:  s.carbon2025  + r.carbon2025,
  }), zero);
  const hasSelection = estimateRows.length > 0;
  const growthPct = totals.count2021 > 0 ? (totals.growth / totals.count2021) * 100 : 0;
  const maxFP = Math.max(totals.energy2025, totals.water2025, totals.carbon2025, 1);
  const stateLabel = selected ? benchmarkTitle : 'Select a state on the map';

  return (
    <div className="analytics-panel">
      {/* ── Header ── */}
      <div className="analytics-panel-header">
        <div className="analytics-panel-titles">
          <span className="analytics-panel-tag">State Analytics</span>
          <strong className="analytics-panel-state">{stateLabel}</strong>
        </div>
      </div>

      {/* ── Section 1: National benchmark cards ── */}
      <div className="analytics-section-label">National Average Comparison</div>

      <div className="benchmark-grid">
        <BenchmarkCard label="Footprint score" value={selected?.score  ?? null} national={national.score}  suffix="" />
        <BenchmarkCard label="★ 2021 DCs"      value={selected?.dc2021 ?? null} national={national.dc2021} suffix="" />
        <BenchmarkCard label="■ 2025 DCs"      value={selected?.dc2025 ?? null} national={national.dc2025} suffix="" />

        {/* DC growth card — expanded with footprint rows inside */}
        <div className="benchmark-card benchmark-card-expanded">
          {/* header: same as BenchmarkCard */}
          <div className="benchmark-card-head">
            <span>DC growth</span>
            <strong>{selected?.growth != null ? `${selected.growth > 0 ? '+' : ''}${selected.growth.toFixed(1)}` : 'Select'}</strong>
          </div>
          <div className="benchmark-bars">
            <div>
              <span>Selected</span>
              <i style={{ width: `${selected?.growth != null ? Math.min(100, (Math.abs(selected.growth) / Math.max(Math.abs(selected.growth), Math.abs(national.growth), 1)) * 100) : 0}%` }} />
            </div>
            <div>
              <span>U.S. avg</span>
              <i style={{ width: `${Math.min(100, (Math.abs(national.growth) / Math.max(Math.abs(selected?.growth ?? 0), Math.abs(national.growth), 1)) * 100)}%` }} />
            </div>
          </div>
          <em className={selected?.growth != null && selected.growth - national.growth > 0 ? 'above' : 'below'}>
            {selected?.growth != null
              ? `${(selected.growth - national.growth) > 0 ? '+' : ''}${(selected.growth - national.growth).toFixed(1)} vs U.S. avg`
              : `U.S. avg +${national.growth.toFixed(1)}`}
          </em>

          {/* Footprint comparison rows inside the card */}
          <div className="benchmark-fp-rows">
            {([
              { label: 'Combined', sel: selected?.score,  nat: national.score,  unit: 'score', color: '#f97316' },
              { label: 'Energy',   sel: selected?.energy, nat: national.energy, unit: 'M MWh', color: '#c4392c' },
              { label: 'Water',    sel: selected?.water,  nat: national.water,  unit: 'M m³',  color: '#0891b2' },
              { label: 'Carbon',   sel: selected?.carbon, nat: national.carbon, unit: 'K tCO₂e', color: '#7c3aed' },
            ] as const).map(({ label, sel, nat, unit, color }) => {
              const max = Math.max(Math.abs(sel ?? 0), Math.abs(nat), 1);
              const selPct = sel != null ? Math.min(100, (Math.abs(sel) / max) * 100) : 0;
              const natPct = Math.min(100, (Math.abs(nat) / max) * 100);
              const delta = sel != null ? sel - nat : null;
              return (
                <div key={label} className="benchmark-fp-row">
                  <span className="benchmark-fp-label">{label}</span>
                  <div className="benchmark-fp-bars">
                    <div className="benchmark-fp-bar-row">
                      <span>Sel.</span>
                      <div className="benchmark-fp-track">
                        <div style={{ width: `${selPct}%`, background: color, height: '100%', borderRadius: 3 }} />
                      </div>
                      <span className="benchmark-fp-val">{sel != null ? sel.toFixed(1) : '—'} {unit}</span>
                    </div>
                    <div className="benchmark-fp-bar-row">
                      <span>Avg</span>
                      <div className="benchmark-fp-track">
                        <div style={{ width: `${natPct}%`, background: '#94a3b8', height: '100%', borderRadius: 3 }} />
                      </div>
                      <span className="benchmark-fp-val">{nat.toFixed(1)} {unit}</span>
                    </div>
                  </div>
                  {delta != null && (
                    <span className={`benchmark-fp-delta ${delta > 0 ? 'above' : 'below'}`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* ── Divider ── */}
      <div className="analytics-panel-divider" />

      {/* ── Section 2: Growth impact ── */}
      <div className="analytics-section-label">
        2021 → 2025 Growth Impact
        {hasSelection && (
          <span className="analytics-growth-summary">
            {totals.count2021}→{totals.count2025} DCs ({totals.growth >= 0 ? '+' : ''}{totals.growth}, {growthPct.toFixed(1)}%)
          </span>
        )}
      </div>

      {!hasSelection && (
        <p className="analytics-empty-hint">
          Select one or more states to see how the 2021→2025 data center increase maps to energy, water, and carbon.
        </p>
      )}

      {hasSelection && (
        <div className="growth-impact-bars">
          <GrowthImpactMetric label="Energy" unit="MWh"   baseline={totals.energy2021} total={totals.energy2025} max={maxFP} color="#c4392c" />
          <GrowthImpactMetric label="Water"  unit="m³"    baseline={totals.water2021}  total={totals.water2025}  max={maxFP} color="#0891b2" />
          <GrowthImpactMetric label="Carbon" unit="tCO₂e" baseline={totals.carbon2021} total={totals.carbon2025} max={maxFP} color="#7c3aed" />
        </div>
      )}

      <p className="analytics-footnote">
        Estimate assumes constant footprint per DC; 2021 baseline back-calculated from count ratio.
      </p>
    </div>
  );
}

function BenchmarkCard({
  label,
  value,
  national,
  suffix,
  signed = false,
}: {
  label: string;
  value: number | null;
  national: number;
  suffix: string;
  signed?: boolean;
}) {
  const available = value != null;
  const max = Math.max(Math.abs(value ?? 0), Math.abs(national), 1);
  const selectedPct = available ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const nationalPct = Math.min(100, (Math.abs(national) / max) * 100);
  const delta = available ? value - national : 0;
  const formatValue = (next: number) => {
    const formatted = Math.abs(next) >= 10 ? next.toFixed(1) : next.toFixed(2);
    return `${signed && next > 0 ? '+' : ''}${formatted}${suffix}`;
  };

  return (
    <div className="benchmark-card">
      <div className="benchmark-card-head">
        <span>{label}</span>
        <strong>{available ? formatValue(value) : 'Select'}</strong>
      </div>
      <div className="benchmark-bars">
        <div>
          <span>Selected</span>
          <i style={{ width: `${selectedPct}%` }} />
        </div>
        <div>
          <span>U.S. avg</span>
          <i style={{ width: `${nationalPct}%` }} />
        </div>
      </div>
      <em className={delta > 0 ? 'above' : delta < 0 ? 'below' : ''}>
        {available ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} vs U.S. avg` : `U.S. avg ${formatValue(national)}`}
      </em>
    </div>
  );
}


function GrowthImpactMetric({
  label,
  unit,
  baseline,
  total,
  max,
  color,
}: {
  label: string;
  unit: string;
  baseline: number;   // estimated 2021 value
  total: number;      // actual 2025 value
  max: number;        // scale denominator
  color: string;
}) {
  const pct2021 = Math.max(2, (baseline / max) * 100);
  const pct2025 = Math.max(2, (total   / max) * 100);
  const delta   = total - baseline;
  const deltaPct = baseline > 0 ? (delta / baseline) * 100 : 0;
  const grew    = delta > 0;
  const fell    = delta < 0;

  return (
    <div className="gim-row">
      {/* metric label */}
      <span className="gim-label">{label}</span>

      {/* two bars: 2021 (faded) then 2025 (solid) */}
      <div className="gim-bars">
        <div className="gim-bar-row">
          <span className="gim-year">★ 2021</span>
          <div className="gim-track">
            <div className="gim-bar gim-bar-2021" style={{ width: `${pct2021}%`, background: color, opacity: 0.28 }} />
          </div>
          <span className="gim-val">{formatFull(baseline)} {unit}</span>
        </div>
        <div className="gim-bar-row">
          <span className="gim-year">■ 2025</span>
          <div className="gim-track">
            <div className="gim-bar gim-bar-2025" style={{ width: `${pct2025}%`, background: color }} />
          </div>
          <span className="gim-val">{formatFull(total)} {unit}</span>
        </div>
      </div>

      {/* delta badge */}
      <span className={`gim-delta ${grew ? 'grew' : fell ? 'fell' : 'flat'}`}>
        {grew ? '▲' : fell ? '▼' : '—'} {grew ? '+' : ''}{formatFull(delta)} {unit}
        <em>{deltaPct !== 0 ? `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%` : ''}</em>
      </span>
    </div>
  );
}

function PortfolioPanel({
  rows,
  selectedStates,
  weights,
  scoreFor,
  countsByState,
  onRemoveState,
  onClear,
}: {
  rows: StateRow[];
  selectedStates: string[];
  weights: StateWeights;
  scoreFor: (row: StateRow) => number;
  countsByState: Map<string, DatacenterCountRow>;
  onRemoveState: (state: string) => void;
  onClear: () => void;
}) {
  const portfolioRows = rows.filter(row => selectedStates.includes(row.State));
  if (portfolioRows.length === 0) {
    return (
      <div className="table-panel portfolio-card head-to-head empty">
        <div className="panel-title">State Head-to-Head</div>
        <p>Select two or more states on the map to compare data centers and environmental footprint side by side.</p>
      </div>
    );
  }

  const totals = {
    energy: portfolioRows.reduce((sum, row) => sum + row.Scaled_power_consumption_MWh, 0),
    water: portfolioRows.reduce((sum, row) => sum + row.Water_footprint_m3, 0),
    carbon: portfolioRows.reduce((sum, row) => sum + row.Carbon_footprint_tonsCO2e, 0),
  };
  const nationalTotals = {
    energy: rows.reduce((sum, row) => sum + row.Scaled_power_consumption_MWh, 0),
    water: rows.reduce((sum, row) => sum + row.Water_footprint_m3, 0),
    carbon: rows.reduce((sum, row) => sum + row.Carbon_footprint_tonsCO2e, 0),
  };
  const avgScore =
    portfolioRows.reduce((sum, row) => sum + scoreFor(row), 0) / Math.max(1, portfolioRows.length);
  const weightTotal = STATE_WEIGHT_CONTROLS.reduce((sum, control) => sum + weights[control.key], 0);
  const dominantWeight = [...STATE_WEIGHT_CONTROLS].sort(
    (a, b) => (weights[b.key] / weightTotal) - (weights[a.key] / weightTotal),
  )[0];

  // Real 2021 and 2025 totals across the portfolio
  const portfolioTotal2021 = portfolioRows.reduce(
    (sum, row) => sum + (countsByState.get(row.State)?.datacenter_count_2021 ?? 0), 0,
  );
  const portfolioTotal2025 = portfolioRows.reduce(
    (sum, row) => sum + (countsByState.get(row.State)?.datacenter_count_2025 ?? 0), 0,
  );
  const portfolioGrowth = portfolioTotal2025 - portfolioTotal2021;

  // Estimated 2021 footprints (back-calculated via DC count ratio)
  const footprint2021 = portfolioRows.reduce((sum, row) => {
    const dc = countsByState.get(row.State);
    const ratio = dc && dc.datacenter_count_2025 > 0
      ? Math.min(1, dc.datacenter_count_2021 / dc.datacenter_count_2025) : 0;
    return {
      energy: sum.energy + row.Scaled_power_consumption_MWh * ratio,
      water:  sum.water  + row.Water_footprint_m3 * ratio,
      carbon: sum.carbon + row.Carbon_footprint_tonsCO2e * ratio,
    };
  }, { energy: 0, water: 0, carbon: 0 });
  const footprintDelta = {
    energy: totals.energy - footprint2021.energy,
    water:  totals.water  - footprint2021.water,
    carbon: totals.carbon - footprint2021.carbon,
  };

  const nationalDcTotals = [...countsByState.values()].reduce(
    (sum, row) => ({
      count2021: sum.count2021 + row.datacenter_count_2021,
      count2025: sum.count2025 + row.datacenter_count_2025,
    }),
    { count2021: 0, count2025: 0 },
  );

  return (
    <div className="table-panel portfolio-card head-to-head">
      <div className="insight-card-header">
        <div>
          <div className="panel-title">State Head-to-Head</div>
          <div className="insight-state">{portfolioRows.length} state{portfolioRows.length === 1 ? '' : 's'} selected</div>
        </div>
        <button type="button" className="weight-reset" onClick={onClear}>Clear</button>
      </div>

      <div className="portfolio-score-grid">
        <div>
          <span className="insight-score">{(avgScore * 100).toFixed(1)}</span>
          <span className="insight-score-label">avg score</span>
        </div>
        <div className="insight-rank">Driver: {dominantWeight.label}</div>
      </div>

      {portfolioRows.length === 1 && (
        <div className="head-to-head-hint">Add another state to make this a direct comparison.</div>
      )}

      <div className="head-to-head-board">
        {portfolioRows.map((row, index) => {
          const dc = countsByState.get(row.State);
          const growth = dc ? dc.datacenter_count_2025 - dc.datacenter_count_2021 : 0;
          return (
            <Fragment key={row.State}>
              {index > 0 && <span className="vs-divider">VS</span>}
              <article className="h2h-card">
                <button type="button" className="h2h-remove" onClick={() => onRemoveState(row.State)}>×</button>
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
                    <strong>{dc?.datacenter_count_2021 ?? 0}</strong>
                  </div>
                  <div>
                    <span>■ 2025</span>
                    <strong>{dc?.datacenter_count_2025 ?? 0}</strong>
                  </div>
                  <em className={growth > 0 ? 'positive' : growth < 0 ? 'negative' : 'neutral'}>
                    {growth > 0 ? '+' : ''}{growth}
                  </em>
                </div>
                <div className="h2h-metrics">
                  <div><span>Energy</span><strong>{formatFull(row.Scaled_power_consumption_MWh)} MWh</strong></div>
                  <div><span>Water</span><strong>{formatFull(row.Water_footprint_m3)} m³</strong></div>
                  <div><span>Carbon</span><strong>{formatFull(row.Carbon_footprint_tonsCO2e)} tCO₂e</strong></div>
                </div>

                {/* Footprint 2021 vs 2025 — two bars per metric */}
                {dc && dc.datacenter_count_2025 > 0 && (
                  (() => {
                    const ratio = Math.min(1, dc.datacenter_count_2021 / dc.datacenter_count_2025);
                    const metrics = [
                      { label: 'Energy', v21: row.Scaled_power_consumption_MWh * ratio, v25: row.Scaled_power_consumption_MWh, unit: 'MWh',   color: '#c4392c' },
                      { label: 'Water',  v21: row.Water_footprint_m3 * ratio,            v25: row.Water_footprint_m3,           unit: 'm³',    color: '#0891b2' },
                      { label: 'Carbon', v21: row.Carbon_footprint_tonsCO2e * ratio,     v25: row.Carbon_footprint_tonsCO2e,    unit: 'tCO₂e', color: '#7c3aed' },
                    ] as const;
                    const maxVal = Math.max(...metrics.map(m => m.v25), 1);
                    return (
                      <div className="h2h-growth">
                        <div className="h2h-growth-title">Footprint change 2021 → 2025 (est.)</div>
                        {metrics.map(m => {
                          const pct21 = Math.max(2, (m.v21 / maxVal) * 100);
                          const pct25 = Math.max(2, (m.v25 / maxVal) * 100);
                          const delta = m.v25 - m.v21;
                          const deltaPct = m.v21 > 0 ? (delta / m.v21) * 100 : 0;
                          return (
                            <div key={m.label} className="h2h-gim-row">
                              <span className="h2h-gim-label">{m.label}</span>
                              <div className="h2h-gim-bars">
                                <div className="h2h-gim-bar-row">
                                  <span>★ 2021</span>
                                  <div className="h2h-gim-track">
                                    <div style={{ width: `${pct21}%`, background: m.color, opacity: 0.28, height: '100%', borderRadius: 3 }} />
                                  </div>
                                  <span className="h2h-gim-val">{formatFull(m.v21)} {m.unit}</span>
                                </div>
                                <div className="h2h-gim-bar-row">
                                  <span>■ 2025</span>
                                  <div className="h2h-gim-track">
                                    <div style={{ width: `${pct25}%`, background: m.color, height: '100%', borderRadius: 3 }} />
                                  </div>
                                  <span className="h2h-gim-val">{formatFull(m.v25)} {m.unit}</span>
                                </div>
                              </div>
                              <span className={`h2h-gim-delta ${delta > 0 ? 'grew' : delta < 0 ? 'fell' : 'flat'}`}>
                                {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {delta > 0 ? '+' : ''}{formatFull(delta)} {m.unit}
                                <em>{deltaPct !== 0 ? `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%` : ''}</em>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </article>
            </Fragment>
          );
        })}
      </div>

      <section className="combined-card">
        <div className="combined-card-title">Combined Selected States</div>
        <div className="combined-score-row">
          <div>
            <strong>{(avgScore * 100).toFixed(1)}</strong>
            <span>avg footprint score</span>
          </div>
          <em>Driver: {dominantWeight.label}</em>
        </div>
        <div className="combined-dc-grid">
          <div>
            <span>★ 2021 DCs</span>
            <strong>{portfolioTotal2021}</strong>
            <em>{nationalDcTotals.count2021 > 0 ? `${((portfolioTotal2021 / nationalDcTotals.count2021) * 100).toFixed(1)}% of U.S.` : 'selected total'}</em>
          </div>
          <div>
            <span>■ 2025 DCs</span>
            <strong>{portfolioTotal2025}</strong>
            <em>{nationalDcTotals.count2025 > 0 ? `${((portfolioTotal2025 / nationalDcTotals.count2025) * 100).toFixed(1)}% of U.S.` : 'selected total'}</em>
          </div>
          <div className="combined-growth-cell">
            <span>Growth</span>
            <strong>{portfolioGrowth > 0 ? '+' : ''}{portfolioGrowth}</strong>
            <em>2021 to 2025</em>
            <div className="combined-fp-delta">
              <div>
                <span>⚡ Energy</span>
                <b className={footprintDelta.energy >= 0 ? 'up' : 'down'}>
                  {footprintDelta.energy >= 0 ? '+' : ''}{formatFull(footprintDelta.energy)} MWh
                </b>
              </div>
              <div>
                <span>💧 Water</span>
                <b className={footprintDelta.water >= 0 ? 'up' : 'down'}>
                  {footprintDelta.water >= 0 ? '+' : ''}{formatFull(footprintDelta.water)} m³
                </b>
              </div>
              <div>
                <span>☁️ Carbon</span>
                <b className={footprintDelta.carbon >= 0 ? 'up' : 'down'}>
                  {footprintDelta.carbon >= 0 ? '+' : ''}{formatFull(footprintDelta.carbon)} tCO₂e
                </b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="portfolio-metrics">
        <PortfolioMetric label="Energy" value={totals.energy} total={nationalTotals.energy} unit="MWh" />
        <PortfolioMetric label="Water" value={totals.water} total={nationalTotals.water} unit="m3" />
        <PortfolioMetric label="Carbon" value={totals.carbon} total={nationalTotals.carbon} unit="tCO2e" />
      </div>
    </div>
  );
}

function SmartInsightsPanel({
  rows,
  selectedRows,
  activeRow,
  scoreFor,
}: {
  rows: StateRow[];
  selectedRows: StateRow[];
  activeRow: StateRow | null;
  scoreFor: (row: StateRow) => number;
}) {
  const topRow = [...rows].sort((a, b) => scoreFor(b) - scoreFor(a))[0];
  const focusRow = activeRow ?? selectedRows[0] ?? topRow;
  const driver = dominantMetric(focusRow, rows);
  const portfolioScore = selectedRows.length
    ? selectedRows.reduce((sum, row) => sum + scoreFor(row), 0) / selectedRows.length
    : null;

  return (
    <div className="table-panel smart-card">
      <div className="panel-title">Smart Insights</div>
      <div className="insight-feed">
        <p>
          <strong>{STATE_NAMES[focusRow.State] ?? focusRow.State}</strong> is currently driven most by {driver.label.toLowerCase()} exposure.
        </p>
        {portfolioScore != null && (
          <p>
            Your selected portfolio averages <strong>{(portfolioScore * 100).toFixed(1)}</strong> on the weighted score.
          </p>
        )}
      </div>
    </div>
  );
}

function DrilldownPanel({
  row,
  counts,
  scoreFor,
  onClear,
}: {
  row: StateRow | null;
  counts: DatacenterCountRow | null;
  scoreFor: (row: StateRow) => number;
  onClear: () => void;
}) {
  if (!row) return null;
  const growth = counts ? counts.datacenter_count_2025 - counts.datacenter_count_2021 : 0;

  return (
    <div className="table-panel drilldown-card">
      <div className="insight-card-header">
        <div>
          <div className="panel-title">State Drilldown</div>
          <div className="insight-state">
            <StateFlag state={row.State} />
            {STATE_NAMES[row.State] ?? row.State}
          </div>
        </div>
        <button type="button" className="weight-reset" onClick={onClear}>Close</button>
      </div>
      <div className="drilldown-grid">
        <div><span>Score</span><strong>{(scoreFor(row) * 100).toFixed(1)}</strong></div>
        <div><span>2021 centers</span><strong>{counts?.datacenter_count_2021 ?? 0}</strong></div>
        <div><span>2025 centers</span><strong>{counts?.datacenter_count_2025 ?? 0}</strong></div>
        <div><span>Growth</span><strong>{growth >= 0 ? '+' : ''}{growth}</strong></div>
      </div>
    </div>
  );
}

function dominantMetric(row: StateRow, rows: StateRow[]) {
  const values = [
    {
      label: 'Energy',
      value: row.Scaled_power_consumption_MWh / Math.max(...rows.map(item => item.Scaled_power_consumption_MWh), 1),
    },
    {
      label: 'Water',
      value: row.Water_footprint_m3 / Math.max(...rows.map(item => item.Water_footprint_m3), 1),
    },
    {
      label: 'Carbon',
      value: row.Carbon_footprint_tonsCO2e / Math.max(...rows.map(item => item.Carbon_footprint_tonsCO2e), 1),
    },
  ];
  return values.sort((a, b) => b.value - a.value)[0];
}

function PortfolioMetric({
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

function StateInsightPanel({
  data,
  row,
  weights,
  scoreFor,
  countsByState,
  onClear,
}: {
  data: StateRow[];
  row: StateRow | null;
  weights: StateWeights;
  scoreFor: (row: StateRow) => number;
  countsByState?: Map<string, DatacenterCountRow>;
  onClear: () => void;
}) {
  const counts = row && countsByState ? countsByState.get(row.State) ?? null : null;

  if (!row) {
    return (
      <div className="table-panel insight-card empty">
        <div className="panel-title">State Intelligence</div>
        <p>Pin a state from the map, ranking, or selector to see weighted score drivers.</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => scoreFor(b) - scoreFor(a));
  const rank = sorted.findIndex(item => item.State === row.State) + 1;
  const keys = STATE_WEIGHT_CONTROLS.map(control => control.key);
  const maxByKey = new Map<MetricKey, number>(
    keys.map(key => [key, Math.max(...data.map(item => item[key])) || 1]),
  );
  const weightTotal = keys.reduce((sum, key) => sum + weights[key], 0);
  const contributions = keys.map(key => {
    const weighted =
      (row[key] / (maxByKey.get(key) || 1)) *
      (weightTotal > 0 ? weights[key] / weightTotal : 1 / keys.length);
    return { key, weighted };
  });
  const totalContribution = contributions.reduce((sum, item) => sum + item.weighted, 0) || 1;

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
        <button type="button" className="weight-reset" onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="insight-score-row">
        <div>
          <span className="insight-score">{(scoreFor(row) * 100).toFixed(1)}</span>
          <span className="insight-score-label">score</span>
        </div>
        <div className="insight-rank">Rank #{rank}</div>
      </div>

      <div className="contribution-list">
        {contributions.map(({ key, weighted }) => {
          const pct = (weighted / totalContribution) * 100;
          const control = STATE_WEIGHT_CONTROLS.find(item => item.key === key)!;
          return (
            <div key={key} className="contribution-row">
              <div className="contribution-label">
                <span className="weight-dot" style={{ background: control.color }} />
                {METRIC_LABELS[key]}
              </div>
              <div className="contribution-track">
                <span style={{ width: `${pct}%`, background: control.color }} />
              </div>
              <div className="contribution-pct">{pct.toFixed(0)}%</div>
            </div>
          );
        })}
      </div>

      <div className="insight-metrics">
        {keys.map(key => (
          <div key={key}>
            <span>{METRIC_LABELS[key]}</span>
            <strong>
              {formatFull(row[key])} {METRIC_UNITS[key]}
            </strong>
          </div>
        ))}
      </div>

      {counts && (
        <div className="insight-dc-counts">
          <div className="insight-dc-title">Data Centers</div>
          <div className="insight-dc-row">
            <div className="insight-dc-cell">
              <span className="insight-dc-year">2021</span>
              <strong className="insight-dc-val">{counts.datacenter_count_2021}</strong>
            </div>
            <div className="insight-dc-arrow">→</div>
            <div className="insight-dc-cell">
              <span className="insight-dc-year">2025</span>
              <strong className="insight-dc-val">{counts.datacenter_count_2025}</strong>
            </div>
            <div className={`insight-dc-growth ${counts.datacenter_growth_2021_2025 > 0 ? 'positive' : counts.datacenter_growth_2021_2025 < 0 ? 'negative' : 'neutral'}`}>
              {counts.datacenter_growth_2021_2025 > 0 ? '+' : ''}{counts.datacenter_growth_2021_2025}
              {counts.datacenter_growth_pct_2021_2025 != null && (
                <span> ({counts.datacenter_growth_pct_2021_2025.toFixed(0)}%)</span>
              )}
            </div>
          </div>
          {counts.total_facility_area_sqft_2025 && (
            <div className="insight-dc-area">
              Total area 2025: {(counts.total_facility_area_sqft_2025 / 1_000_000).toFixed(1)}M sqft
            </div>
          )}
        </div>
      )}
    </div>
  );
}
