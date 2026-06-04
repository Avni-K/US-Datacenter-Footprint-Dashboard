import { useMemo, useState } from 'react';
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
import { TopStatesBarChart } from './components/TopStatesBarChart';
import { BarChartRace } from './components/BarChartRace';
import { ScatterPlot } from './components/ScatterPlot';
import { StateFlag } from './components/StateFlag';
import type { DatacenterCountRow, MetricKey } from './types';
import type { StateRow } from './types';
import { STATE_NAMES } from './constants';
import { formatFull } from './utils/format';
import './App.css';

type TabId = 'footprint' | 'im3' | 'osm2021';
type MapLens = 'footprint' | 'growth' | 'density' | 'water' | 'carbon' | 'risk';

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

const STATE_PRESETS: { label: string; weights: StateWeights; focus: number; lens?: MapLens }[] = [
  { label: 'Balanced', weights: DEFAULT_STATE_WEIGHTS, focus: 15, lens: 'footprint' },
  {
    label: 'Hyperscaler Expansion',
    weights: {
      Scaled_power_consumption_MWh: 70,
      Water_footprint_m3: 15,
      Carbon_footprint_tonsCO2e: 15,
    },
    focus: 12,
    lens: 'growth',
  },
  {
    label: 'Water-Constrained Planning',
    weights: {
      Scaled_power_consumption_MWh: 15,
      Water_footprint_m3: 70,
      Carbon_footprint_tonsCO2e: 15,
    },
    focus: 12,
    lens: 'water',
  },
  {
    label: 'Carbon-Aware Siting',
    weights: {
      Scaled_power_consumption_MWh: 15,
      Water_footprint_m3: 15,
      Carbon_footprint_tonsCO2e: 70,
    },
    focus: 12,
    lens: 'carbon',
  },
  {
    label: 'Combined Risk',
    weights: {
      Scaled_power_consumption_MWh: 45,
      Water_footprint_m3: 30,
      Carbon_footprint_tonsCO2e: 25,
    },
    focus: 20,
    lens: 'risk',
  },
];

const MAP_LENSES: { id: MapLens; label: string }[] = [
  { id: 'footprint', label: 'Footprint' },
  { id: 'growth', label: 'Growth' },
  { id: 'density', label: 'Density' },
  { id: 'water', label: 'Water' },
  { id: 'carbon', label: 'Carbon' },
  { id: 'risk', label: 'Risk' },
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
  const [stateWeights, setStateWeights] = useState<StateWeights>(DEFAULT_STATE_WEIGHTS);
  const [stateFocusCount, setStateFocusCount] = useState(15);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [show2021Centers, setShow2021Centers] = useState(false);
  const [show2025Centers, setShow2025Centers] = useState(true);
  const [mapLens, setMapLens] = useState<MapLens>('footprint');
  const [timelineYear, setTimelineYear] = useState(2025);
  const [whatIfNewCenters, setWhatIfNewCenters] = useState(0);
  const [whatIfEfficiency, setWhatIfEfficiency] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const [lassoMode, setLassoMode] = useState(false);
  const [drilldownState, setDrilldownState] = useState<string | null>(null);
  const activeState = selectedState ?? hoveredState;
  const selectedStateRow = activeState ? dataByState.get(activeState) ?? null : null;
  const stateScore = useMemo(
    () => buildStateScore(rows, stateWeights, selectedStates, whatIfEfficiency),
    [rows, selectedStates, stateWeights, whatIfEfficiency],
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

            <WeightControls
              title="State Map Weights"
              controls={STATE_WEIGHT_CONTROLS}
              weights={stateWeights}
              presets={STATE_PRESETS}
              onPresetSelect={preset => {
                setStateWeights(preset.weights);
                setStateFocusCount(preset.focus);
                if (preset.lens) setMapLens(preset.lens);
                setSelectedState(null);
                setHoveredState(null);
              }}
              focusLabel="Focus Top States"
              focusValue={stateFocusCount}
              focusMin={5}
              focusMax={51}
              onFocusChange={setStateFocusCount}
              onChange={(key, value) =>
                setStateWeights(current => ({ ...current, [key]: value }))
              }
              onReset={() => {
                setStateWeights(DEFAULT_STATE_WEIGHTS);
                setStateFocusCount(15);
                setSelectedState(null);
                setSelectedStates([]);
                setHoveredState(null);
                setMapLens('footprint');
                setTimelineYear(2025);
                setWhatIfNewCenters(0);
                setWhatIfEfficiency(0);
                setDrilldownState(null);
              }}
            />

            <InteractionStudio
              lens={mapLens}
              lenses={MAP_LENSES}
              onLensChange={setMapLens}
              timelineYear={timelineYear}
              onTimelineYearChange={setTimelineYear}
              whatIfNewCenters={whatIfNewCenters}
              whatIfEfficiency={whatIfEfficiency}
              onWhatIfNewCentersChange={setWhatIfNewCenters}
              onWhatIfEfficiencyChange={setWhatIfEfficiency}
              lassoMode={lassoMode}
              onLassoModeChange={setLassoMode}
              selectedCount={selectedStates.length}
              onOpenCompare={() => setCompareOpen(true)}
              onExport={() => window.print()}
            />

            <StateCommandBar
              rows={rows}
              activeState={activeState}
              selectedState={selectedState}
              selectedStates={selectedStates}
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
                        2025 centers
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={show2021Centers}
                          onChange={event => setShow2021Centers(event.target.checked)}
                        />
                        2021 centers
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
                    lens={mapLens}
                    timelineYear={timelineYear}
                    whatIfNewCenters={whatIfNewCenters}
                    whatIfEfficiency={whatIfEfficiency}
                    drilldownState={drilldownState}
                    lassoMode={lassoMode}
                    onSetSelectedStates={setSelectedStates}
                    onDrilldownState={setDrilldownState}
                  />
                </div>

                {/* Analytics sit directly below the map — no gap */}
                <div className="analytics-section">
                  <TopStatesBarChart
                    data={rows}
                    weights={stateWeights}
                    scoreFor={stateScore}
                    countsByState={datacenterCountsByState}
                    selectedStates={selectedStates}
                    onSelectState={s => { setSelectedState(s); togglePortfolioState(s); }}
                  />
                  <div className="analytics-row">
                    <ScatterPlot
                      rows={[...datacenterCountsByState.values()]}
                      selectedStates={selectedStates}
                      onSelectState={s => { setSelectedState(s); togglePortfolioState(s); }}
                    />
                    <BarChartRace rows={[...datacenterCountsByState.values()]} />
                  </div>
                </div>
              </div>

              <div className="insight-rail">
                <SmartInsightsPanel
                  rows={rows}
                  selectedRows={portfolioRows}
                  activeRow={selectedStateRow}
                  scoreFor={stateScore}
                  lens={mapLens}
                  whatIfNewCenters={whatIfNewCenters}
                  whatIfEfficiency={whatIfEfficiency}
                />
                <PortfolioPanel
                  rows={rows}
                  selectedStates={selectedStates}
                  weights={stateWeights}
                  scoreFor={stateScore}
                  countsByState={datacenterCountsByState}
                  whatIfNewCenters={whatIfNewCenters}
                  onRemoveState={togglePortfolioState}
                  onClear={() => setSelectedStates([])}
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
            <CompareDrawer
              open={compareOpen}
              rows={rows}
              selectedRows={portfolioRows}
              weights={stateWeights}
              scoreFor={stateScore}
              countsByState={datacenterCountsByState}
              timelineYear={timelineYear}
              whatIfNewCenters={whatIfNewCenters}
              whatIfEfficiency={whatIfEfficiency}
              onClose={() => setCompareOpen(false)}
              onExport={() => window.print()}
            />
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

interface WeightControlsProps<K extends string> {
  title: string;
  controls: { key: K; label: string; color: string }[];
  weights: Record<K, number>;
  presets?: { label: string; weights: Record<K, number>; focus: number; lens?: MapLens }[];
  onPresetSelect?: (preset: { label: string; weights: Record<K, number>; focus: number; lens?: MapLens }) => void;
  focusLabel?: string;
  focusValue?: number;
  focusMin?: number;
  focusMax?: number;
  onFocusChange?: (value: number) => void;
  onChange: (key: K, value: number) => void;
  onReset: () => void;
}

function WeightControls<K extends string>({
  title,
  controls,
  weights,
  presets,
  onPresetSelect,
  focusLabel,
  focusValue,
  focusMin,
  focusMax,
  onFocusChange,
  onChange,
  onReset,
}: WeightControlsProps<K>) {
  const total = controls.reduce((sum, control) => sum + weights[control.key], 0);

  return (
    <div className="weight-panel">
      <div className="weight-panel-header">
        <div className="panel-title">{title}</div>
        <button className="weight-reset" type="button" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="weight-grid">
        {controls.map(control => {
          const normalized = total > 0 ? (weights[control.key] / total) * 100 : 0;
          return (
            <label key={control.key} className="weight-control">
              <span className="weight-label">
                <span className="weight-dot" style={{ background: control.color }} />
                {control.label}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[control.key]}
                onChange={event => onChange(control.key, Number(event.target.value))}
                style={{ accentColor: control.color }}
              />
              <span className="weight-value">{normalized.toFixed(0)}%</span>
            </label>
          );
        })}
      </div>
      {presets && onPresetSelect && (
        <div className="scenario-strip">
          {presets.map(preset => (
            <button
              key={preset.label}
              type="button"
              className="scenario-btn"
              onClick={() => onPresetSelect(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      {focusLabel && focusValue != null && focusMin != null && focusMax != null && onFocusChange && (
        <label className="focus-control">
          <span className="weight-label">{focusLabel}</span>
          <input
            type="range"
            min={focusMin}
            max={focusMax}
            value={focusValue}
            onChange={event => onFocusChange(Number(event.target.value))}
          />
          <span className="weight-value">{focusValue}</span>
        </label>
      )}
    </div>
  );
}

function buildStateScore(
  data: StateRow[],
  weights: StateWeights,
  selectedStates: string[] = [],
  whatIfEfficiency = 0,
) {
  const keys = STATE_WEIGHT_CONTROLS.map(control => control.key);
  const maxByKey = new Map<MetricKey, number>(
    keys.map(key => [key, Math.max(...data.map(row => row[key])) || 1]),
  );
  const weightTotal = keys.reduce((sum, key) => sum + weights[key], 0);

  return (row: StateRow) =>
    keys.reduce((sum, key) => {
      const normalizedWeight = weightTotal > 0 ? weights[key] / weightTotal : 1 / keys.length;
      const efficiencyFactor = selectedStates.includes(row.State) ? (1 - whatIfEfficiency / 100) : 1;
      return sum + ((row[key] * efficiencyFactor) / (maxByKey.get(key) || 1)) * normalizedWeight;
    }, 0);
}

function InteractionStudio({
  lens,
  lenses,
  onLensChange,
  timelineYear,
  onTimelineYearChange,
  whatIfNewCenters,
  whatIfEfficiency,
  onWhatIfNewCentersChange,
  onWhatIfEfficiencyChange,
  lassoMode,
  onLassoModeChange,
  selectedCount,
  onOpenCompare,
  onExport,
}: {
  lens: MapLens;
  lenses: { id: MapLens; label: string }[];
  onLensChange: (lens: MapLens) => void;
  timelineYear: number;
  onTimelineYearChange: (year: number) => void;
  whatIfNewCenters: number;
  whatIfEfficiency: number;
  onWhatIfNewCentersChange: (value: number) => void;
  onWhatIfEfficiencyChange: (value: number) => void;
  lassoMode: boolean;
  onLassoModeChange: (enabled: boolean) => void;
  selectedCount: number;
  onOpenCompare: () => void;
  onExport: () => void;
}) {
  return (
    <div className="interaction-studio">
      {/* Row 1: Risk Lens takes the full width with no clipping */}
      <div className="studio-row studio-row-lens">
        <span className="studio-label">Risk Lens</span>
        <div className="segmented-control">
          {lenses.map(item => (
            <button
              key={item.id}
              type="button"
              className={item.id === lens ? 'active' : ''}
              onClick={() => onLensChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: all the scenario controls */}
      <div className="studio-row studio-row-controls">
        <div className="studio-group studio-timeline">
          <span className="studio-label">Timeline</span>
          <div className="segmented-control">
            {[2021, 2025].map(yr => (
              <button
                key={yr}
                type="button"
                className={timelineYear === yr ? 'active' : ''}
                onClick={() => onTimelineYearChange(yr)}
              >
                {yr}
              </button>
            ))}
          </div>
          <span className="studio-data-tag">real data</span>
        </div>

        <label className="studio-range">
          <span className="studio-label">New Centers</span>
          <input
            type="range"
            min={0}
            max={50}
            value={whatIfNewCenters}
            onChange={event => onWhatIfNewCentersChange(Number(event.target.value))}
          />
          <strong>+{whatIfNewCenters}</strong>
        </label>

        <label className="studio-range">
          <span className="studio-label">Efficiency Gain</span>
          <input
            type="range"
            min={0}
            max={40}
            value={whatIfEfficiency}
            onChange={event => onWhatIfEfficiencyChange(Number(event.target.value))}
          />
          <strong>{whatIfEfficiency}%</strong>
        </label>

        <div className="studio-actions">
          <label className="lasso-toggle">
            <input
              type="checkbox"
              checked={lassoMode}
              onChange={event => onLassoModeChange(event.target.checked)}
            />
            Lasso
          </label>
          <button type="button" className="weight-reset" onClick={onOpenCompare} disabled={selectedCount < 2}>
            Compare {selectedCount > 0 ? selectedCount : ''}
          </button>
          <button type="button" className="weight-reset" onClick={onExport}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

function StateCommandBar({
  rows,
  activeState,
  selectedState,
  selectedStates,
  onSelectState,
  onTogglePortfolioState,
  onClearPortfolio,
}: {
  rows: StateRow[];
  activeState: string | null;
  selectedState: string | null;
  selectedStates: string[];
  onSelectState: (state: string | null) => void;
  onTogglePortfolioState: (state: string) => void;
  onClearPortfolio: () => void;
}) {
  const sortedRows = [...rows].sort((a, b) =>
    (STATE_NAMES[a.State] ?? a.State).localeCompare(STATE_NAMES[b.State] ?? b.State),
  );

  return (
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
      <label className="state-picker portfolio-add">
        <span>Add to Portfolio</span>
        <select value="" onChange={event => event.target.value && onTogglePortfolioState(event.target.value)}>
          <option value="">Choose states</option>
          {sortedRows.map(row => (
            <option key={row.State} value={row.State}>
              {selectedStates.includes(row.State) ? '✓ ' : ''}{STATE_NAMES[row.State] ?? row.State}
            </option>
          ))}
        </select>
      </label>
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
          <button type="button" className="state-chip" onClick={onClearPortfolio}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function PortfolioPanel({
  rows,
  selectedStates,
  weights,
  scoreFor,
  countsByState,
  whatIfNewCenters,
  onRemoveState,
  onClear,
}: {
  rows: StateRow[];
  selectedStates: string[];
  weights: StateWeights;
  scoreFor: (row: StateRow) => number;
  countsByState: Map<string, DatacenterCountRow>;
  whatIfNewCenters: number;
  onRemoveState: (state: string) => void;
  onClear: () => void;
}) {
  const portfolioRows = rows.filter(row => selectedStates.includes(row.State));
  if (portfolioRows.length === 0) {
    return (
      <div className="table-panel portfolio-card empty">
        <div className="panel-title">State Portfolio</div>
        <p>Add 2 or more states to compare a combined footprint portfolio.</p>
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
  const whatIfTotal = whatIfNewCenters * portfolioRows.length;

  return (
    <div className="table-panel portfolio-card">
      <div className="insight-card-header">
        <div>
          <div className="panel-title">State Portfolio</div>
          <div className="insight-state">{portfolioRows.length} states selected</div>
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

      {/* ── Real datacenter counts ── */}
      <div className="portfolio-dc-block">
        <div className="portfolio-dc-label">Data Centers</div>
        <div className="portfolio-dc-row">
          <div className="portfolio-dc-cell">
            <span className="portfolio-dc-year">2021</span>
            <strong className="portfolio-dc-val">{portfolioTotal2021}</strong>
          </div>
          <span className="portfolio-dc-arrow">→</span>
          <div className="portfolio-dc-cell">
            <span className="portfolio-dc-year">2025</span>
            <strong className="portfolio-dc-val">{portfolioTotal2025}</strong>
          </div>
          <span className={`portfolio-dc-badge ${portfolioGrowth > 0 ? 'positive' : portfolioGrowth < 0 ? 'negative' : 'neutral'}`}>
            {portfolioGrowth > 0 ? '+' : ''}{portfolioGrowth}
          </span>
          {whatIfTotal > 0 && (
            <span className="portfolio-dc-whatif">+{whatIfTotal} modeled</span>
          )}
        </div>
      </div>

      {/* ── Per-state chips with counts ── */}
      <div className="portfolio-state-list">
        {portfolioRows.map(row => {
          const dc = countsByState.get(row.State);
          return (
            <button key={row.State} type="button" onClick={() => onRemoveState(row.State)} className="portfolio-state-chip">
              <span className="chip-left">
                <StateFlag state={row.State} />
                <span className="chip-abbr">{row.State}</span>
                <span className="chip-score">{(scoreFor(row) * 100).toFixed(1)}</span>
              </span>
              {dc && (
                <span className="chip-dc">
                  {dc.datacenter_count_2021}→{dc.datacenter_count_2025}
                  <span className={dc.datacenter_growth_2021_2025 > 0 ? 'chip-up' : dc.datacenter_growth_2021_2025 < 0 ? 'chip-down' : ''}>
                    {dc.datacenter_growth_2021_2025 > 0 ? ` +${dc.datacenter_growth_2021_2025}` : dc.datacenter_growth_2021_2025 < 0 ? ` ${dc.datacenter_growth_2021_2025}` : ''}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="portfolio-metrics">
        <PortfolioMetric label="Energy" value={totals.energy} total={nationalTotals.energy} unit="MWh" />
        <PortfolioMetric label="Water" value={totals.water} total={nationalTotals.water} unit="m3" />
        <PortfolioMetric label="Carbon" value={totals.carbon} total={nationalTotals.carbon} unit="tCO2e" />
      </div>
    </div>
  );
}

function centerCountAtYear(counts: DatacenterCountRow | null | undefined, year: number) {
  if (!counts) return 0;
  const ratio = Math.max(0, Math.min(1, (year - 2021) / 4));
  return counts.datacenter_count_2021 +
    (counts.datacenter_count_2025 - counts.datacenter_count_2021) * ratio;
}

function SmartInsightsPanel({
  rows,
  selectedRows,
  activeRow,
  scoreFor,
  lens,
  whatIfNewCenters,
  whatIfEfficiency,
}: {
  rows: StateRow[];
  selectedRows: StateRow[];
  activeRow: StateRow | null;
  scoreFor: (row: StateRow) => number;
  lens: MapLens;
  whatIfNewCenters: number;
  whatIfEfficiency: number;
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
        <p>
          The active lens is <strong>{lens}</strong>, so ranking color is based on that operating question, not only raw footprint.
        </p>
        {portfolioScore != null && (
          <p>
            Your selected portfolio averages <strong>{(portfolioScore * 100).toFixed(1)}</strong> on the weighted score.
          </p>
        )}
        {(whatIfNewCenters > 0 || whatIfEfficiency > 0) && (
          <p>
            Scenario applied: <strong>+{whatIfNewCenters}</strong> centers and <strong>{whatIfEfficiency}%</strong> efficiency gain on selected states.
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

function CompareDrawer({
  open,
  rows,
  selectedRows,
  weights,
  scoreFor,
  countsByState,
  timelineYear,
  whatIfNewCenters,
  whatIfEfficiency,
  onClose,
  onExport,
}: {
  open: boolean;
  rows: StateRow[];
  selectedRows: StateRow[];
  weights: StateWeights;
  scoreFor: (row: StateRow) => number;
  countsByState: Map<string, DatacenterCountRow>;
  timelineYear: number;
  whatIfNewCenters: number;
  whatIfEfficiency: number;
  onClose: () => void;
  onExport: () => void;
}) {
  if (!open) return null;

  const totals = selectedRows.reduce(
    (acc, row) => ({
      energy: acc.energy + row.Scaled_power_consumption_MWh,
      water: acc.water + row.Water_footprint_m3,
      carbon: acc.carbon + row.Carbon_footprint_tonsCO2e,
      centers: acc.centers + centerCountAtYear(countsByState.get(row.State), timelineYear) + whatIfNewCenters,
    }),
    { energy: 0, water: 0, carbon: 0, centers: 0 },
  );
  const national = rows.reduce(
    (acc, row) => ({
      energy: acc.energy + row.Scaled_power_consumption_MWh,
      water: acc.water + row.Water_footprint_m3,
      carbon: acc.carbon + row.Carbon_footprint_tonsCO2e,
    }),
    { energy: 0, water: 0, carbon: 0 },
  );
  const dominant = STATE_WEIGHT_CONTROLS.reduce((winner, item) =>
    weights[item.key] > weights[winner.key] ? item : winner,
  );

  return (
    <div className="drawer-backdrop">
      <aside className="compare-drawer">
        <div className="drawer-header">
          <div>
            <span className="drawer-kicker">Executive Compare</span>
            <h2>{selectedRows.length} selected states</h2>
          </div>
          <button type="button" className="weight-reset" onClick={onClose}>Close</button>
        </div>
        <div className="drawer-summary-grid">
          <CompareKpi label="Energy" value={totals.energy} total={national.energy} unit="MWh" />
          <CompareKpi label="Water" value={totals.water} total={national.water} unit="m3" />
          <CompareKpi label="Carbon" value={totals.carbon} total={national.carbon} unit="tCO2e" />
          <div className="drawer-kpi">
            <span>Centers</span>
            <strong>{totals.centers.toFixed(0)}</strong>
            <em>{timelineYear} + scenario</em>
          </div>
        </div>
        <div className="drawer-callout">
          Driver: <strong>{dominant.label}</strong>. Scenario: +{whatIfNewCenters} centers, {whatIfEfficiency}% efficiency gain.
        </div>
        <div className="drawer-state-table">
          {selectedRows
            .sort((a, b) => scoreFor(b) - scoreFor(a))
            .map(row => (
              <div key={row.State}>
                <span><StateFlag state={row.State} /> {STATE_NAMES[row.State] ?? row.State}</span>
                <strong>{(scoreFor(row) * 100).toFixed(1)}</strong>
              </div>
            ))}
        </div>
        <button type="button" className="drawer-export" onClick={onExport}>Export Executive Summary</button>
      </aside>
    </div>
  );
}

function CompareKpi({ label, value, total, unit }: { label: string; value: number; total: number; unit: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="drawer-kpi">
      <span>{label}</span>
      <strong>{formatFull(value)}</strong>
      <em>{pct.toFixed(1)}% of U.S. {unit}</em>
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
