import { useState, useEffect, useRef, useMemo } from 'react';
import type { DatacenterCountRow } from '../types';
import { STATE_NAMES } from '../constants';

const TOP_N = 12;

const STATE_COLORS: Record<string, string> = {
  TX: '#c4392c', CA: '#0891b2', VA: '#7c3aed', AZ: '#d97706',
  GA: '#16a34a', NY: '#db2777', FL: '#0d9488', IL: '#9333ea',
  WA: '#ea580c', NC: '#0284c7', NJ: '#65a30d', OH: '#b45309',
  PA: '#0e7490', MA: '#7c2d12', SC: '#1d4ed8', CO: '#047857',
};

const FALLBACK_PALETTE = ['#475569', '#6366f1', '#8b5cf6', '#a78bfa', '#64748b', '#94a3b8'];

function colorFor(state: string, idx: number): string {
  return STATE_COLORS[state] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

interface RaceEntry {
  state: string;
  value2021: number;
  value2025: number;
}

function interpolateValue(entry: RaceEntry, year: number): number {
  const t = Math.max(0, Math.min(1, (year - 2021) / 4));
  return entry.value2021 + (entry.value2025 - entry.value2021) * t;
}

interface Props {
  rows: DatacenterCountRow[];
}

export function BarChartRace({ rows }: Props) {
  const [year, setYear] = useState(2021);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  // 4 real years play out in 5 seconds total
  const SPEED = useRef(4 / 5000); // fractional years per ms — stable ref, never changes

  const entries = useMemo<RaceEntry[]>(() =>
    rows.map(r => ({
      state: r.State,
      value2021: r.datacenter_count_2021,
      value2025: r.datacenter_count_2025,
    })),
  [rows]);

  const frame = useMemo(() => {
    const withVals = entries.map(e => ({ e, val: interpolateValue(e, year) }));
    withVals.sort((a, b) => b.val - a.val);
    const top = withVals.slice(0, TOP_N);
    const maxVal = top[0]?.val || 1;
    return { top, maxVal };
  }, [entries, year]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
      return;
    }
    const tick = (now: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;
      setYear(prev => {
        const next = prev + SPEED.current * dt;
        if (next >= 2025) { setPlaying(false); return 2025; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  const handlePlay = () => {
    if (year >= 2025) setYear(2021);
    setPlaying(true);
  };
  const handlePause = () => setPlaying(false);
  const handleReset = () => { setPlaying(false); setYear(2021); };

  // Only show a year label at the two real data points; show "→" while animating
  const displayYear = year <= 2021.05 ? '2021' : year >= 2024.95 ? '2025' : '→';
  const progress = ((year - 2021) / 4) * 100;

  return (
    <div className="race-panel">
      <div className="race-header">
        <div className="panel-title">Data Center Count Race — 2021 → 2025</div>

        <div className="race-controls">
          {playing ? (
            <button type="button" className="race-btn" onClick={handlePause}>⏸ Pause</button>
          ) : (
            <button type="button" className="race-btn race-btn-primary" onClick={handlePlay}>
              ▶ {year >= 2025 ? 'Replay' : 'Play'}
            </button>
          )}
          <button type="button" className="race-btn" onClick={handleReset}>↺ Reset</button>
        </div>
      </div>

      {/* Timeline row — only 2021 and 2025 are real data; no scrubber to intermediate years */}
      <div className="race-timeline">
        <span className={`race-year${displayYear === '→' ? ' race-year-mid' : ''}`}>
          {displayYear}
        </span>
        <div className="race-progress-track">
          <div className="race-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="race-year-end">2025</span>
      </div>

      <div className="race-bars">
        {frame.top.map(({ e, val }, idx) => {
          const pct = (val / frame.maxVal) * 100;
          const color = colorFor(e.state, idx);
          return (
            <div key={e.state} className="race-row">
              <div className="race-rank">{idx + 1}</div>
              <div className="race-state-label">
                <span className="state-abbr">{e.state}</span>
                <span className="state-name-sm">{STATE_NAMES[e.state] ?? e.state}</span>
              </div>
              <div className="race-track">
                <div
                  className="race-fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <div className="race-count" style={{ color: '#334155' }}>
                {Math.round(val)}
              </div>
            </div>
          );
        })}
      </div>

      <p className="race-footnote">
        2021: OSM snapshot, spatially joined to state boundaries (386 facilities).
        2025: IM3 Atlas. Intermediate years are linearly interpolated estimates.
      </p>
    </div>
  );
}
