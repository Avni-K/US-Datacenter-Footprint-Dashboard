import { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { Huc8Row } from '../types';

export interface Huc8Feature {
  type: 'Feature';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry: any;
}

export function useHuc8Data() {
  const [rows, setRows] = useState<Huc8Row[]>([]);
  const [features, setFeatures] = useState<Huc8Feature[] | null>(null);
  const [geoMissing, setGeoMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const csvP = d3.csv('/data/huc8_environmental_footprints.csv').then(raw =>
      raw
        .map(r => ({
          HUC8: r['HUC8'] ?? '',
          WF_PCA_m3: Number(r['WF_PCA_m3']),
          CF_PCA_tonsCO2e: Number(r['CF_PCA_tonsCO2e']),
          WSF_PCA_m3eq: Number(r['WSF_PCA_m3eq']),
          Region: r['Region'] ?? '',
          Characterization_Factor: Number(r['Characterization_Factor']),
        }))
        .filter(r => r.HUC8.length > 0),
    );

    const geoP = fetch('/data/huc8_boundaries.geojson')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .catch(() => null);

    Promise.all([csvP, geoP]).then(([csvRows, geo]) => {
      setRows(csvRows);
      if (geo?.features) {
        setFeatures(geo.features as Huc8Feature[]);
      } else {
        setGeoMissing(true);
      }
      setLoading(false);
    });
  }, []);

  const dataByHuc8 = useMemo(
    () => new Map<string, Huc8Row>(rows.map(r => [r.HUC8, r])),
    [rows],
  );

  return { rows, features, geoMissing, loading, dataByHuc8 };
}
