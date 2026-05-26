import { useState, useMemo } from 'react';
import { useSitingData } from '../hooks/useSitingData';
import type { SitingRow } from '../types';

type RankedRow = SitingRow & { customRisk: number };

function computeRisk(row: SitingRow, ww: number, cw: number, sw: number): number {
  return ww * row.WF_norm + cw * row.CF_norm + sw * row.WSF_norm;
}

export function SitingRiskTool() {
  const { rows, loading } = useSitingData();
  const [waterW, setWaterW] = useState(33);
  const [carbonW, setCarbonW] = useState(33);
  const [scarcityW, setScarcityW] = useState(34);

  const [nw, nc, ns] = useMemo<[number, number, number]>(() => {
    const total = waterW + carbonW + scarcityW;
    if (total === 0) return [1 / 3, 1 / 3, 1 / 3];
    return [waterW / total, carbonW / total, scarcityW / total];
  }, [waterW, carbonW, scarcityW]);

  const ranked = useMemo<RankedRow[]>(() => {
    return [...rows]
      .map(r => ({ ...r, customRisk: computeRisk(r, nw, nc, ns) }))
      .sort((a, b) => b.customRisk - a.customRisk)
      .slice(0, 15);
  }, [rows, nw, nc, ns]);

  const top = ranked[0] ?? null;

  if (loading) {
    return <div className="siting-loading">Loading siting data…</div>;
  }

  return (
    <div className="siting-section">
      <div className="siting-header">
        <h2>1 MW Data Center Siting Risk Tool</h2>
        <p>
          This tool compares the hypothetical environmental impact of placing a 1 MW data center
          in each HUC8 subbasin.
        </p>
      </div>

      <div className="siting-controls table-panel">
        <div className="panel-title">Adjust Risk Weights</div>
        <div className="slider-grid">
          <SliderRow
            label="Water Weight"
            value={waterW}
            onChange={setWaterW}
            color="#0891b2"
            pct={nw}
          />
          <SliderRow
            label="Carbon Weight"
            value={carbonW}
            onChange={setCarbonW}
            color="#dc2626"
            pct={nc}
          />
          <SliderRow
            label="Scarcity Weight"
            value={scarcityW}
            onChange={setScarcityW}
            color="#7c3aed"
            pct={ns}
          />
        </div>
      </div>

      {top && (
        <div className="siting-top-section">
          <div className="panel-title siting-top-title">Highest-Risk Subbasin</div>
          <div className="siting-cards">
            <SitingCard label="HUC8 ID"           value={top.HUC8}                      unit=""          accent="#0f172a" />
            <SitingCard label="Water Footprint"   value={top.WF_1MW_DC.toFixed(2)}      unit="m³/yr"     accent="#0891b2" />
            <SitingCard label="Carbon Footprint"  value={top.CF_1MW_DC.toFixed(4)}      unit="tCO₂e/yr"  accent="#dc2626" />
            <SitingCard label="Scarcity Footprint" value={top.WSF_1MW_DC.toFixed(2)}    unit="m³-eq/yr"  accent="#7c3aed" />
            <SitingCard label="Custom Risk Score" value={top.customRisk.toFixed(4)}     unit=""          accent="#1e40af" />
          </div>
        </div>
      )}

      <div className="table-panel siting-table-panel">
        <div className="panel-title">Top 15 Highest-Risk HUC8 Subbasins</div>
        <div className="siting-table-scroll">
          <table className="ranking-table siting-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>HUC8</th>
                <th>Water Footprint (m³/yr)</th>
                <th>Carbon Footprint (tCO₂e/yr)</th>
                <th>Scarcity Footprint (m³-eq/yr)</th>
                <th>Custom Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={`${r.HUC8}-${i}`}>
                  <td className="rank-num">{i + 1}</td>
                  <td className="siting-huc8">{r.HUC8}</td>
                  <td className="rank-val">{r.WF_1MW_DC.toFixed(2)}</td>
                  <td className="rank-val">{r.CF_1MW_DC.toFixed(4)}</td>
                  <td className="rank-val">{r.WSF_1MW_DC.toFixed(2)}</td>
                  <td className="rank-val siting-risk-val">{r.customRisk.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

interface SliderRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  pct: number;
}

function SliderRow({ label, value, onChange, color, pct }: SliderRowProps) {
  return (
    <div className="slider-row">
      <div className="slider-label">{label}</div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="weight-slider"
        style={{ accentColor: color }}
      />
      <div className="slider-pct" style={{ color }}>{(pct * 100).toFixed(1)}%</div>
    </div>
  );
}

interface SitingCardProps {
  label: string;
  value: string;
  unit: string;
  accent: string;
}

function SitingCard({ label, value, unit, accent }: SitingCardProps) {
  return (
    <div className="summary-card">
      <div className="card-label">{label}</div>
      <div className="card-value siting-card-value" style={{ color: accent }}>
        {value}
      </div>
      {unit && <div className="card-unit">{unit}</div>}
    </div>
  );
}
