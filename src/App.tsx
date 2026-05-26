import { useState } from 'react';
import { useStateData } from './hooks/useStateData';
import { ChoroplethMap } from './components/ChoroplethMap';
import { SummaryCards } from './components/SummaryCards';
import { RankingTable } from './components/RankingTable';
import { SitingRiskTool } from './components/SitingRiskTool';
import { Huc8ScarcityMap } from './components/Huc8ScarcityMap';
import { METRICS } from './constants';
import type { MetricOption } from './types';
import './App.css';

export default function App() {
  const { rows, loading, dataByState } = useStateData();
  const [metric, setMetric] = useState<MetricOption>(METRICS[0]);

  if (loading) {
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
      </div>
    </div>
  );
}
