import { useState, useEffect } from 'react';
import * as d3 from 'd3';
import type { DatacenterLocation } from '../types';

export function useDatacenterLocations() {
  const [locations, setLocations] = useState<DatacenterLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    d3.csv('/data/datacenters_2021_locations.csv').then(raw => {
      const parsed: DatacenterLocation[] = raw
        .map(r => ({
          osm_id: r['osm_id'] ?? '',
          name: r['name'] ?? '',
          operator: r['operator'] ?? '',
          building: r['building'] ?? '',
          telecom: r['telecom'] ?? '',
          city: r['addr:city'] ?? '',
          state: r['addr:state'] ?? '',
          source_layer: r['source_layer'] ?? '',
          lat: Number(r['lat']),
          lon: Number(r['lon']),
        }))
        .filter(r => isFinite(r.lat) && isFinite(r.lon));
      setLocations(parsed);
      setLoading(false);
    });
  }, []);

  return { locations, loading };
}
