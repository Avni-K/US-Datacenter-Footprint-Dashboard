# U.S. Data Center Environmental Footprint Dashboard

This repository contains a React, TypeScript, Vite, and D3.js dashboard for exploring how U.S. data center activity relates to environmental footprint. The dashboard combines state-level energy demand, water footprint, carbon footprint, 2021 data center locations, 2025 data center locations, and HUC8 watershed-level footprint/risk data into one interactive browser application.

The main goal is to help users understand the relationship between data center concentration and environmental pressure at a glance. Users can compare states, inspect 2021 versus 2025 data center growth, view national-share context, select multiple states directly on the map, and explore watershed-level water scarcity and siting risk.

The application is fully client-side. It does not require a backend server, API key, or database after the static data files are prepared.

## Implemented Functionality

- State-level combined environmental footprint choropleth using energy, water, and carbon metrics.
- D3-based U.S. state map with hover tooltips, click selection, multi-state selection, and rectangular lasso selection.
- 2021 versus 2025 data center overlay on the state footprint map. The 2021 layer is shown with star markers and the 2025 layer is shown with square markers.
- State flag integration in selected-state cards and comparison views.
- State Intelligence panel with score, rank, metric contribution bars, and data center counts.
- State Head-to-Head panel for comparing two or more selected states.
- Combined Selected States summary that aggregates 2021 counts, 2025 counts, growth, energy, water, and carbon footprint for the selected states.
- National-share comparison bars for selected states.
- State analytics section showing national average context and 2021 to 2025 data center growth impact.
- Top states/ranking table for combined footprint with inline trend context.
- Standalone 2025 data center map tab.
- Standalone 2021 data center map tab.
- HUC8 water scarcity hotspot map.
- HUC8 1 MW siting risk explorer for comparing water footprint, carbon footprint, and water scarcity footprint.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript |
| Build tool | Vite |
| Visualization | D3.js |
| Geographic data | TopoJSON, GeoJSON, `topojson-client`, `us-atlas` |
| Icons | `lucide-react`, `us-state-flags` |
| Linting | ESLint |
| Data processing | Python scripts with pandas/geospatial tooling as needed |

The major advanced visualizations are implemented with D3.js. D3 is used for the state choropleth, projections, geographic paths, color scales, map markers, HUC8 maps, lasso geometry, and ranking/sparkline-style visual encodings.

## Installation

Prerequisites:

- Node.js 20 or newer is recommended.
- npm is required.

Clone the repository and install dependencies:

```bash
git clone https://github.com/Avni-K/US-Datacenter-Footprint-Dashboard.git
cd US-Datacenter-Footprint-Dashboard
npm install
```

## Execution

Start the local development server:

```bash
npm run dev
```

Then open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run lint checks:

```bash
npm run lint
```

## Data Included in This Repository

The browser-ready datasets are included in `public/data` so the dashboard can run immediately after `npm install`.

| File | Purpose |
|---|---|
| `public/data/state_energy_water_carbon.csv` | State-level energy demand, water footprint, and carbon footprint. |
| `public/data/datacenter_counts_2021_2025.csv` | Per-state 2021 count, 2025 count, 2025 area, and growth fields. |
| `public/data/datacenters_2021_locations.csv` | 2021 data center point locations used for the star overlay and 2021 map tab. |
| `public/data/im3_datacenters_2025_locations.csv` | 2025 IM3 data center point locations used for the square overlay and 2025 map tab. |
| `public/data/huc8_environmental_footprints.csv` | Watershed-level environmental footprint values. |
| `public/data/huc8_1mw_siting_with_risk.csv` | HUC8 1 MW siting risk values. |
| `public/data/huc8_boundaries.geojson` | HUC8 watershed boundaries. |
| `public/data/states-10m.json` | U.S. state TopoJSON for map rendering. |
| `public/data/SI_XLS/Input data.xlsx` | Source workbook used for state-level inputs. |
| `public/data/SI_XLS/Results.xlsx` | Source workbook used for HUC8 footprint and siting values. |

The included processed data is small enough for the course submission and supports a complete local demo. Larger source downloads are handled through scripts rather than being manually embedded in the application code.

## Data Sources and Reproducibility

The data pipeline scripts are stored in `scripts`.

| Script | Purpose |
|---|---|
| `scripts/prepare_data.py` | Converts source workbook tables into browser-ready CSV files. |
| `scripts/download_osm_datacenters_2021.py` | Downloads and filters the historical OpenStreetMap data center snapshot used for the 2021 layer. |
| `scripts/download_im3_datacenter_atlas_2025.py` | Downloads the IM3 Open Source Data Center Atlas used for the 2025 layer. |
| `scripts/compare_datacenter_counts_2021_2025.py` | Builds the 2021 versus 2025 state count comparison. |
| `scripts/join_datacenter_counts_with_state_footprint.py` | Joins data center counts to state footprint data. |
| `scripts/download_huc8_boundaries.py` | Retrieves HUC8 watershed boundary geometry. |

Key source datasets used by the project:

- State and watershed footprint data from the provided Siddik/Virginia Tech supporting workbook files in `public/data/SI_XLS`.
- 2021 data center locations from a historical OpenStreetMap extraction.
- 2025 data center locations from the IM3 Open Source Data Center Atlas.
- U.S. state geometry from `us-atlas`/TopoJSON.
- HUC8 watershed boundaries from the preprocessing workflow.

The 2021 OpenStreetMap layer should be interpreted as a mapped facility proxy rather than a complete census. The 2025 IM3 layer is a richer facility atlas and is used for the current facility comparison layer.

## Project Structure

```text
US-Datacenter-Footprint-Dashboard/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── constants.ts
│   ├── types.ts
│   ├── components/
│   │   ├── ChoroplethMap.tsx
│   │   ├── DatacenterComparisonPanel.tsx
│   │   ├── DatacenterGrowthMap.tsx
│   │   ├── DatacenterMap.tsx
│   │   ├── Huc8ScarcityMap.tsx
│   │   ├── RankingTable.tsx
│   │   ├── SitingRiskTool.tsx
│   │   ├── StateFlag.tsx
│   │   └── SummaryCards.tsx
│   ├── hooks/
│   │   ├── useDatacenterCounts.ts
│   │   ├── useDatacenterLocations.ts
│   │   ├── useHuc8Data.ts
│   │   ├── useIm3Locations.ts
│   │   ├── useSitingData.ts
│   │   └── useStateData.ts
│   └── utils/
│       └── format.ts
├── public/data/
├── scripts/
├── data/
├── docs/
├── package.json
└── README.md
```

## Main Source Files

- `src/App.tsx` controls the dashboard tabs, selected states, overlay toggles, state comparison panels, analytics cards, and page layout.
- `src/components/ChoroplethMap.tsx` renders the main D3 state map, footprint color scale, 2021/2025 data center overlays, hover tooltip, click selection, state callouts, and lasso selection.
- `src/components/DatacenterMap.tsx` renders the standalone 2021 and 2025 data center map tabs.
- `src/components/Huc8ScarcityMap.tsx` renders the watershed hotspot map.
- `src/components/SitingRiskTool.tsx` renders the HUC8 1 MW siting risk explorer.
- `src/components/RankingTable.tsx` renders the top state ranking view and connects ranking interactions back to the map.
- `src/components/StateFlag.tsx` renders state flags using the `us-state-flags` package.
- `src/hooks/*` files load each static CSV/GeoJSON/TopoJSON dataset used by the dashboard.

## How to Use the Dashboard

1. Open the Environmental Footprint tab to see the combined state-level footprint map.
2. Hover over a state to see its score, energy footprint, water footprint, carbon footprint, and data center counts.
3. Click a state to select it and show the State Intelligence panel.
4. Click multiple states, or drag a rectangle over the map, to build a multi-state comparison.
5. Use the 2021 and 2025 overlay checkboxes to compare facility locations on top of the footprint map.
6. Review the State Head-to-Head panel below the map to compare selected states and their combined footprint.
7. Use the Data Centers (2025) and Data Centers (2021) tabs to inspect each facility layer separately.
8. Use the HUC8 sections to inspect watershed-level hotspot and siting-risk patterns.

## Limitations and Interpretation Notes

- The dashboard supports exploration and comparison. It does not prove that data center growth alone caused a footprint increase.
- State footprint values depend on grid mix, facility size, cooling technology, data center utilization, and local water conditions.
- The 2021 OpenStreetMap layer is incomplete compared with the 2025 IM3 Atlas and should be treated as a historical mapped-location proxy.
- The 2021 to 2025 comparison is useful for directional growth analysis, but the two source datasets were created through different collection processes.
- HUC8 siting values represent a modeled 1 MW data center scenario and should be interpreted as risk-screening context, not a final siting decision.

## Implementation Checklist

- README includes project description, installation instructions, and execution instructions.
- Dashboard runs locally with `npm run dev`.
- Production build is available through `npm run build`.
- Advanced visualization is implemented with D3.js.
- Code is organized into React components, hooks, constants, shared types, and utility functions.
- Static processed datasets are included for a reproducible local demo.
- Data processing and download scripts are included for transparency.
