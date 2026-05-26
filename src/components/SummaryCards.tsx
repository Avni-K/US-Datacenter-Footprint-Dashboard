import * as d3 from 'd3';
import type { StateRow } from '../types';
import { formatCompact } from '../utils/format';

interface Props {
  data: StateRow[];
}

export function SummaryCards({ data }: Props) {
  const totalEnergy = d3.sum(data, d => d.Scaled_power_consumption_MWh);
  const totalWater  = d3.sum(data, d => d.Water_footprint_m3);
  const totalCarbon = d3.sum(data, d => d.Carbon_footprint_tonsCO2e);

  const cards = [
    { label: 'Total Energy Demand',    value: totalEnergy, unit: 'MWh',    accent: '#2563eb' },
    { label: 'Total Water Footprint',  value: totalWater,  unit: 'm³',     accent: '#0891b2' },
    { label: 'Total Carbon Footprint', value: totalCarbon, unit: 'tCO₂e',  accent: '#dc2626' },
  ];

  return (
    <div className="dash-cards">
      {cards.map(c => (
        <div key={c.label} className="summary-card">
          <div className="card-label">{c.label}</div>
          <div className="card-value" style={{ color: c.accent }}>
            {formatCompact(c.value)}
          </div>
          <div className="card-unit">{c.unit}</div>
        </div>
      ))}
    </div>
  );
}
