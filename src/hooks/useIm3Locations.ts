import { useState, useEffect } from 'react';
import * as d3 from 'd3';
import type { DatacenterLocation } from '../types';

export function useIm3Locations() {
  const [locations, setLocations] = useState<DatacenterLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not-found' | null>(null);

  useEffect(() => {
    d3.csv('/data/im3_datacenters_2025_locations.csv')
      .then(raw => {
        const parsed: DatacenterLocation[] = raw
          .map(r => ({
            osm_id:       r['id'] ?? '',
            name:         r['name'] ?? '',
            operator:     '',
            building:     '',
            telecom:      '',
            city:         r['county'] ?? '',
            state:        r['state'] ?? '',
            source_layer: r['source_layer']?.replace('im3_us_data_center_locations.gpkg::', '') ?? '',
            lat:          Number(r['lat']),
            lon:          Number(r['lon']),
          }))
          .filter(r => isFinite(r.lat) && isFinite(r.lon));
        setLocations(parsed);
        setLoading(false);
      })
      .catch(() => {
        setError('not-found');
        setLoading(false);
      });
  }, []);

  return { locations, loading, error };
}
