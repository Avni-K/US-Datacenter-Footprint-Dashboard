import type { StateRow, MetricOption } from '../types';
import { STATE_NAMES } from '../constants';
import { formatFull } from '../utils/format';

interface Props {
  data: StateRow[];
  metric: MetricOption;
}

export function RankingTable({ data, metric }: Props) {
  const sorted = [...data]
    .sort((a, b) => b[metric.key] - a[metric.key])
    .slice(0, 10);

  const maxVal = sorted[0]?.[metric.key] ?? 1;

  return (
    <div className="table-panel">
      <div className="panel-title">Top 10 — {metric.label}</div>
      <table className="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>State</th>
            <th style={{ textAlign: 'right' }}>{metric.unit}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const pct = (row[metric.key] / maxVal) * 100;
            return (
              <tr key={row.State}>
                <td className="rank-num">{i + 1}</td>
                <td className="rank-state">
                  <span className="state-abbr">{row.State}</span>
                  <span className="state-name">{STATE_NAMES[row.State] ?? row.State}</span>
                </td>
                <td className="rank-val">{formatFull(row[metric.key])}</td>
                <td className="rank-bar-cell">
                  <div className="rank-bar-bg">
                    <div className="rank-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
