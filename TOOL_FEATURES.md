# Reusable Dashboard Tools Branch

This branch contains the reusable interaction tools developed for the U.S. Data Center Environmental Footprint Dashboard.

Included tools:

1. **2021 vs 2025 Data Center Overlay**
   - Adds 2021 data center markers and 2025 data center markers onto the combined state footprint map.
   - Main files: `src/App.tsx`, `src/components/ChoroplethMap.tsx`, `public/data/datacenter_counts_2021_2025.csv`.

2. **State Flag Integration**
   - Displays real state flags in state intelligence and comparison cards.
   - Main files: `src/components/StateFlag.tsx`, `package.json`, `package-lock.json`.

3. **Multi-State Selection**
   - Lets users select multiple states directly from the map and maintain them as a selected group.
   - Main files: `src/App.tsx`, `src/components/ChoroplethMap.tsx`.

4. **Lasso Selection Tool**
   - Lets users drag a rectangle on the map to batch-select states.
   - Main file: `src/components/ChoroplethMap.tsx`.

5. **State Head-to-Head Comparison Panel**
   - Shows selected states side by side for direct comparison.
   - Main files: `src/components/StateComparisonTools.tsx`, `src/App.tsx`, `src/App.css`.
   - Reusable export: `StateHeadToHeadComparisonPanel`.

6. **Combined Selected States Summary**
   - Aggregates selected states into a combined total for footprint and data center counts.
   - Main files: `src/components/StateComparisonTools.tsx`, `src/App.tsx`.
   - Reusable export: `CombinedSelectedStatesSummary`.

7. **National Share Comparison**
   - Shows selected-state totals as a percentage/share of U.S. totals.
   - Main files: `src/components/StateComparisonTools.tsx`, `src/App.tsx`, `src/App.css`.
   - Reusable export: `NationalShareComparison`.

8. **State Intelligence Cards**
   - Shows score, rank, footprint metrics, state flag, and 2021/2025 data center counts for a selected state.
   - Main files: `src/components/StateComparisonTools.tsx`, `src/App.tsx`, `src/components/StateFlag.tsx`.
   - Reusable export: `StateIntelligenceCard`.

9. **Top States / Ranking Views**
   - Adds ranking views with selected-state highlighting and 2021 to 2025 trend sparklines.
   - Main file: `src/components/RankingTable.tsx`.

10. **2021 vs 2025 Facility Growth Analysis**
    - Adds growth analysis logic and visuals for data center count increase between 2021 and 2025.
    - Main files: `src/components/StateComparisonTools.tsx`, `src/App.tsx`, `src/components/DatacenterGrowthMap.tsx`, `public/data/datacenter_counts_2021_2025.csv`.
    - Reusable export: `FacilityGrowthImpactAnalysis`.

11. **Risk / Correlation Analysis**
    - Adds dashboard-side relationship views for comparing data center growth pressure with energy, water, and carbon footprint.
    - Main files: `src/components/StateComparisonTools.tsx`, `src/App.tsx`, `src/App.css`.
    - Reusable export: `RiskCorrelationAnalysis`.

Reusable import surface:

```ts
import {
  CombinedSelectedStatesSummary,
  FacilityGrowthImpactAnalysis,
  NationalShareComparison,
  RiskCorrelationAnalysis,
  StateHeadToHeadComparisonPanel,
  StateIntelligenceCard,
} from './src/tools';
```

Validation:

- `npm run build` passes.
- `npm run lint` passes.
