import { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { StateRow } from '../types';

export function useStateData() {
  const [rows, setRows] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    d3.csv('/data/state_energy_water_carbon.csv').then(raw => {
      const parsed: StateRow[] = raw
        .map(r => ({
          State: r['State'] ?? '',
          Water_intensity_m3_per_MWh: Number(r['Water_intensity_m3_per_MWh']),
          Carbon_intensity_tonsCO2e_per_MWh: Number(r['Carbon_intensity_tonsCO2e_per_MWh']),
          Scaled_power_consumption_MWh: Number(r['Scaled_power_consumption_MWh']),
          Water_footprint_m3: Number(r['Water_footprint_m3']),
          Carbon_footprint_tonsCO2e: Number(r['Carbon_footprint_tonsCO2e']),
        }))
        .filter(r => r.State.length > 0);
      setRows(parsed);
      setLoading(false);
    });
  }, []);

  const dataByState = useMemo(
    () => new Map<string, StateRow>(rows.map(r => [r.State, r])),
    [rows],
  );

  return { rows, loading, dataByState };
}
