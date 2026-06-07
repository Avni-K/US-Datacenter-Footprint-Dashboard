import type { DatacenterCountRow, StateRow } from '../types';

export function selectedStateRows(rows: StateRow[], selectedStates: string[]) {
  return rows.filter(row => selectedStates.includes(row.State));
}

export function selectedStateTotals(rows: StateRow[], selectedStates: string[]) {
  const selectedRows = selectedStateRows(rows, selectedStates);
  return selectedRows.reduce(
    (sum, row) => ({
      energy: sum.energy + row.Scaled_power_consumption_MWh,
      water: sum.water + row.Water_footprint_m3,
      carbon: sum.carbon + row.Carbon_footprint_tonsCO2e,
    }),
    { energy: 0, water: 0, carbon: 0 },
  );
}

export function nationalFootprintTotals(rows: StateRow[]) {
  return rows.reduce(
    (sum, row) => ({
      energy: sum.energy + row.Scaled_power_consumption_MWh,
      water: sum.water + row.Water_footprint_m3,
      carbon: sum.carbon + row.Carbon_footprint_tonsCO2e,
    }),
    { energy: 0, water: 0, carbon: 0 },
  );
}

export function selectedDataCenterTotals(
  rows: StateRow[],
  selectedStates: string[],
  countsByState: Map<string, DatacenterCountRow>,
) {
  return selectedStateRows(rows, selectedStates).reduce(
    (sum, row) => {
      const counts = countsByState.get(row.State);
      return {
        count2021: sum.count2021 + (counts?.datacenter_count_2021 ?? 0),
        count2025: sum.count2025 + (counts?.datacenter_count_2025 ?? 0),
      };
    },
    { count2021: 0, count2025: 0 },
  );
}
