import { useState, useEffect } from 'react';
import * as d3 from 'd3';
import type { SitingRow } from '../types';

export function useSitingData() {
  const [rows, setRows] = useState<SitingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    d3.csv('/data/huc8_1mw_siting_with_risk.csv').then(raw => {
      const parsed: SitingRow[] = raw
        .map(r => ({
          HUC8: r['HUC8'] ?? '',
          WSF_1MW_DC: Number(r['WSF_1MW_DC']),
          WF_1MW_DC: Number(r['WF_1MW_DC']),
          CF_1MW_DC: Number(r['CF_1MW_DC']),
          WF_norm: Number(r['WF_norm']),
          CF_norm: Number(r['CF_norm']),
          WSF_norm: Number(r['WSF_norm']),
          Risk_score_equal_weights: Number(r['Risk_score_equal_weights']),
        }))
        .filter(r => r.HUC8.length > 0);
      setRows(parsed);
      setLoading(false);
    });
  }, []);

  return { rows, loading };
}
