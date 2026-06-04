import { useState } from 'react';
import { useStateData } from './hooks/useStateData';
import { useDatacenterCounts } from './hooks/useDatacenterCounts';
import { useIm3Locations } from './hooks/useIm3Locations';
import { useDatacenterLocations } from './hooks/useDatacenterLocations';
import { ChoroplethMap } from './components/ChoroplethMap';
import { SummaryCards } from './components/SummaryCards';
import { RankingTable } from './components/RankingTable';
import { SitingRiskTool } from './components/SitingRiskTool';
import { Huc8ScarcityMap } from './components/Huc8ScarcityMap';
import { DatacenterMap } from './components/DatacenterMap';
import { DatacenterComparisonPanel } from './components/DatacenterComparisonPanel';
import { DatacenterGrowthMap } from './components/DatacenterGrowthMap';
import { METRICS } from './constants';
import type { MetricOption } from './types';
import './App.css';

type TabId = 'footprint' | 'im3' | 'osm2021';

const TABS: { id: TabId; label: string }[] = [
  { id: 'footprint', label: 'Environmental Footprint' },
  { id: 'im3',       label: 'Data Centers (2025)' },
  { id: 'osm2021',   label: 'Data Centers (2021)' },
];

export default function App() {
  const { rows, loading, dataByState } = useStateData();
  const { locations: im3Locations, loading: im3Loading } = useIm3Locations();
  const { locations: osmLocations, loading: osmLoading } = useDatacenterLocations();
  const { rows: countRows, dataByState: countByState, loading: countsLoading } = useDatacenterCounts();
  const [metric, setMetric] = useState<MetricOption>(METRICS[0]);
  const [tab, setTab] = useState<TabId>('footprint');

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

            <div className="metric-selector">
              {METRICS.map(m => (
                <button
                  key={m.key}
                  className={`metric-btn${m.key === metric.key ? ' active' : ''}`}
                  onClick={() => setMetric(m)}
                  type="button"
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="dash-main">
              <div className="map-panel">
                <div className="panel-title">{metric.label} by State</div>
                <ChoroplethMap
                  data={rows}
                  metricKey={metric.key}
                  metricLabel={metric.label}
                  metricUnit={metric.unit}
                  dataByState={dataByState}
                />
              </div>
              <RankingTable data={rows} metric={metric} />
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
