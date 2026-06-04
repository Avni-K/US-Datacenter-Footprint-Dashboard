import { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { DatacenterCountRow } from '../types';

export function useDatacenterCounts() {
  const [rows, setRows] = useState<DatacenterCountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not-found' | 'parse-error' | null>(null);

  useEffect(() => {
    d3.csv('/data/datacenter_counts_2021_2025.csv')
      .then(raw => {
        const parsed: DatacenterCountRow[] = raw
          .map(r => ({
            State: r['State'] ?? '',
            datacenter_count_2021: Number(r['datacenter_count_2021'] ?? 0),
            datacenter_count_2025: Number(r['datacenter_count_2025'] ?? 0),
            total_facility_area_sqft_2025:
              r['total_facility_area_sqft_2025'] && r['total_facility_area_sqft_2025'] !== ''
                ? Number(r['total_facility_area_sqft_2025'])
                : null,
            datacenter_growth_2021_2025: Number(r['datacenter_growth_2021_2025'] ?? 0),
            datacenter_growth_pct_2021_2025:
              r['datacenter_growth_pct_2021_2025'] && r['datacenter_growth_pct_2021_2025'] !== ''
                ? Number(r['datacenter_growth_pct_2021_2025'])
                : null,
          }))
          .filter(r => r.State.length > 0);
        setRows(parsed);
        setLoading(false);
      })
      .catch(() => {
        setError('not-found');
        setLoading(false);
      });
  }, []);

  const dataByState = useMemo(
    () => new Map<string, DatacenterCountRow>(rows.map(r => [r.State, r])),
    [rows],
  );

  return { rows, dataByState, loading, error };
}
