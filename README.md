# U.S. Data Center Environmental Footprint Dashboard

An interactive research dashboard that visualizes the environmental impact of U.S. data centers at the state and watershed level — covering energy demand, water consumption, and carbon emissions — alongside real facility growth from 2021 to 2025.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Sources](#data-sources)
- [How the Data Was Calculated](#how-the-data-was-calculated)
- [Data Pipeline — Step by Step](#data-pipeline--step-by-step)
- [Getting Started](#getting-started)
- [Dashboard Features — Full Reference](#dashboard-features--full-reference)
  - [Environmental Footprint Tab](#environmental-footprint-tab)
  - [Analytics Section](#analytics-section)
  - [Data Centers (2025) Tab](#data-centers-2025-tab)
  - [Data Centers (2021) Tab](#data-centers-2021-tab)
- [Component Reference](#component-reference)
- [Limitations & Data Notes](#limitations--data-notes)
- [Citation](#citation)

---

## Overview

Data centers are one of the fastest-growing sources of electricity demand, water withdrawal, and carbon emissions in the United States. This dashboard integrates three independent datasets to answer:

- **Which states** carry the largest combined energy, water, and carbon burden from data center operations?
- **Where** has facility growth been fastest between 2021 and 2025?
- **Which watersheds** (HUC8) are most at risk for new 1 MW data center siting?
- **How do states compare** across all three environmental dimensions at once?

Everything runs entirely in the browser — no server, no API key. Data is pre-processed by a Python pipeline and served as static CSV / GeoJSON / TopoJSON files.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React + TypeScript | 19 / 6 |
| Build | Vite | 8 |
| Mapping & Charts | D3 | 7 |
| Map topology | topojson-client + us-atlas | 3 |
| State flags | us-state-flags | 1 |
| Data pipeline | Python — pandas, geopandas, shapely | 3.11 |
| Linting | ESLint + typescript-eslint | 10 / 8 |

---

## Project Structure

```
US-Datacenter-Footprint-Dashboard/
│
├── src/
│   ├── App.tsx                          # Root — all tabs, state, layout, inline panel components
│   ├── App.css                          # All styles (no CSS framework)
│   ├── types.ts                         # Shared TypeScript interfaces
│   ├── constants.ts                     # FIPS→state abbr, full state names, metric config
│   │
│   ├── components/
│   │   ├── ChoroplethMap.tsx            # Main US map — choropleth, dots, lasso, labels, tooltip
│   │   ├── DatacenterMap.tsx            # Simple dot map (standalone 2021 / 2025 tabs)
│   │   ├── DatacenterGrowthMap.tsx      # Growth choropleth helper
│   │   ├── RankingTable.tsx             # Top-10 table with inline sparklines
│   │   ├── SummaryCards.tsx             # National KPI cards (energy / water / carbon totals)
│   │   ├── SitingRiskTool.tsx           # HUC8 1 MW siting risk explorer
│   │   ├── Huc8ScarcityMap.tsx          # HUC8 watershed environmental map
│   │   ├── TopStatesBarChart.tsx        # Animated horizontal bar chart with metric toggle
│   │   ├── BarChartRace.tsx             # Animated 2021→2025 facility count race
│   │   ├── ScatterPlot.tsx              # 2021 vs 2025 bubble scatter plot
│   │   ├── DatacenterComparisonPanel.tsx
│   │   └── StateFlag.tsx                # State flag icon (via us-state-flags)
│   │
│   ├── hooks/
│   │   ├── useStateData.ts              # Fetches state_energy_water_carbon.csv
│   │   ├── useDatacenterCounts.ts       # Fetches datacenter_counts_2021_2025.csv
│   │   ├── useIm3Locations.ts           # Fetches im3_datacenters_2025_locations.csv
│   │   ├── useDatacenterLocations.ts    # Fetches datacenters_2021_locations.csv
│   │   ├── useHuc8Data.ts               # Fetches HUC8 footprints + boundaries
│   │   └── useSitingData.ts             # Fetches huc8_1mw_siting_with_risk.csv
│   │
│   └── utils/
│       └── format.ts                    # Compact number formatting (72.1M, 349K …)
│
├── public/data/                         # Static files served at /data/*
│   ├── state_energy_water_carbon.csv    # State-level footprint metrics
│   ├── datacenter_counts_2021_2025.csv  # 2021 + 2025 counts per state + growth
│   ├── datacenters_2021_locations.csv   # 388 OSM 2021 facility lat/lon records
│   ├── im3_datacenters_2025_locations.csv  # IM3 2025 facility records
│   ├── huc8_1mw_siting_with_risk.csv   # Per-watershed 1 MW siting risk scores
│   ├── huc8_environmental_footprints.csv  # Per-watershed water/carbon/scarcity footprints
│   ├── huc8_boundaries.geojson          # HUC8 watershed polygon boundaries
│   ├── states-10m.json                  # US states TopoJSON (Natural Earth 10m)
│   └── SI_XLS/
│       ├── Input data.xlsx              # Source: state-level intensity inputs
│       └── Results.xlsx                 # Source: HUC8 footprint + siting results
│
├── scripts/                             # Python data pipeline
│   ├── prepare_data.py                  # Excel → CSV conversion
│   ├── download_osm_datacenters_2021.py # Download + filter 2021 OSM PBF
│   ├── download_im3_datacenter_atlas_2025.py  # Download 2025 IM3 Atlas
│   ├── compare_datacenter_counts_2021_2025.py # Merge 2021 + 2025 state counts
│   ├── join_datacenter_counts_with_state_footprint.py
│   └── download_huc8_boundaries.py
│
├── data/                                # Intermediate outputs (not committed to git)
│   ├── osm_datacenters_2021/
│   └── im3_datacenters_2025/
│
└── docs/
    └── project_plan.md
```

---

## Data Sources

### 1. State-Level Environmental Footprint

**File:** `public/data/state_energy_water_carbon.csv`
**Origin:** `public/data/SI_XLS/Input data.xlsx` — Table 6
**Script:** `scripts/prepare_data.py`

| Column | Description |
|---|---|
| `State` | Two-letter state abbreviation |
| `Scaled_power_consumption_MWh` | Estimated data center electricity demand per state (MWh/year) |
| `Water_intensity_m3_per_MWh` | Water withdrawal per MWh of electricity generated (m³/MWh) |
| `Carbon_intensity_tonsCO2e_per_MWh` | Carbon emissions per MWh of electricity generated (tCO₂e/MWh) |
| `Water_footprint_m3` | `Water_intensity × Scaled_power_consumption` |
| `Carbon_footprint_tonsCO2e` | `Carbon_intensity × Scaled_power_consumption` |

### 2. HUC8 Environmental Footprints

**File:** `public/data/huc8_environmental_footprints.csv`
**Origin:** `Results.xlsx` — Table 1

Environmental footprints per HUC8 watershed across six grid allocation methods:

| Method | Abbreviation | Description |
|---|---|---|
| Primary Control Area | PCA | Electricity allocated to the controlling balancing authority |
| PCA (no trade) | PCA_NT | PCA without inter-area power trades |
| HUC4 | HUC4 | Allocation to the HUC4 hydrologic unit |
| Interconnection | — | Eastern / Western / ERCOT interconnection |
| eGRID subregion | eGRID | EPA's eGRID subregion allocation |
| State | State | State-level average allocation |

Key metric columns: `WF_PCA_m3` (water footprint), `CF_PCA_tonsCO2e` (carbon footprint), `WSF_PCA_m3eq` (water scarcity footprint).

### 3. HUC8 Siting Risk

**File:** `public/data/huc8_1mw_siting_with_risk.csv`
**Origin:** `Results.xlsx` — Table 3

Footprint of placing a hypothetical 1 MW data center in each watershed:

| Column | Description |
|---|---|
| `HUC8` | 8-digit Hydrologic Unit Code |
| `WSF_1MW_DC` | Water scarcity footprint of 1 MW DC (m³eq) |
| `WF_1MW_DC` | Water footprint of 1 MW DC (m³) |
| `CF_1MW_DC` | Carbon footprint of 1 MW DC (tCO₂e) |
| `WF_norm` | Water footprint normalized 0–1 |
| `CF_norm` | Carbon footprint normalized 0–1 |
| `WSF_norm` | Water scarcity normalized 0–1 |
| `Risk_score_equal_weights` | `(WF_norm + CF_norm + WSF_norm) / 3` |

### 4. 2021 Facility Locations (OSM)

**File:** `public/data/datacenters_2021_locations.csv`
**Origin:** January 2021 Geofabrik North America OSM PBF snapshot

- Filtered by OSM tags: `amenity=data_center`, `telecom=data_center`, `building=data_center`
- 388 facilities with lat/lon, OSM ID, name, operator, city
- `addr:state` was blank for 387 of 388 records — **state assignment was performed by spatial join** (see Calculations section)

### 5. 2025 Facility Locations (IM3 Atlas)

**File:** `public/data/im3_datacenters_2025_locations.csv`
**Origin:** [IM3 Open Source Data Center Atlas](https://github.com/IMMM-SFA/datacenter-atlas) — OSTI DOI: [2550666](https://www.osti.gov/biblio/2550666)

Three source layers: `points`, `buildings`, `campus`. Includes facility area (sqft), county, and state.

### 6. 2021 vs 2025 Comparison Table

**File:** `public/data/datacenter_counts_2021_2025.csv`

This is the central file that powers the datacenter count displays across every panel. It is served to the browser and loaded by the `useDatacenterCounts` hook.

| Column | Description |
|---|---|
| `State` | Two-letter state abbreviation |
| `datacenter_count_2021` | Spatially joined OSM 2021 count (see note below) |
| `datacenter_count_2025` | IM3 Atlas 2025 count |
| `total_facility_area_sqft_2025` | Sum of all facility areas from IM3 Atlas (sqft) |
| `datacenter_growth_2021_2025` | `count_2025 − count_2021` |
| `datacenter_growth_pct_2021_2025` | `(growth / count_2021) × 100`, blank if 2021 count = 0 |

> **Important:** The original pipeline script (`compare_datacenter_counts_2021_2025.py`) produced all-zero 2021 counts because OSM `addr:state` tags were missing for virtually every facility. The 2021 counts in the current CSV were re-derived by **spatially joining the 388 OSM lat/lon points against U.S. state boundaries** using Shapely point-in-polygon. See the Calculations section for full methodology.

---

## How the Data Was Calculated

This section traces every number visible in the UI back to its exact formula and code location.

---

### 1. Weighted Composite Score (`scoreFor`)

This single function drives the choropleth map color, Top 10 ranking, State Intelligence score, Portfolio avg score, and bar chart order. It is computed fresh every time the weight sliders move.

**Formula:**

```
scoreFor(state) =
  Σ for each metric m in [Energy, Water, Carbon]:
    (raw_value(state, m) × efficiency_factor) / max_value(m)  ×  weight(m) / total_weight
```

Where:
- `raw_value(state, Energy)` = `Scaled_power_consumption_MWh`
- `raw_value(state, Water)` = `Water_footprint_m3`
- `raw_value(state, Carbon)` = `Carbon_footprint_tonsCO2e`
- `max_value(m)` = maximum of that metric across **all 51 states** (recomputed every render)
- `weight(m)` = the slider value for that metric (e.g. 34)
- `total_weight` = sum of all three slider values (e.g. 34+33+33 = 100)
- `efficiency_factor` = `1 − (efficiency_gain% / 100)` for portfolio states, `1.0` for all others

The result is a number **0–1** (0 = lowest relative burden, 1 = highest). The UI displays it multiplied by 100 to give a 0–100 scale.

**Weight normalization:** The three sliders do not need to sum to 100. The app divides each by `total_weight`, so setting all three to 1 is identical to setting them to 34/33/33.

**What if total_weight = 0?** Each metric gets equal weight `1/3` as a fallback.

**Example — Pennsylvania (PA), default weights 34/33/33, displayed score 12.4:**

| Metric | PA value | National max | Normalized | Weight share | Contribution |
|---|---|---|---|---|---|
| Energy | 1,446,425 MWh | ~9,281,139 MWh | 0.1558 | 0.34 | 0.0530 |
| Water | 2,987,865 m³ | ~349,013,702 m³ | 0.0086 | 0.33 | 0.0028 |
| Carbon | 568,715 tCO₂e | ~3,411,767 tCO₂e | 0.1667 | 0.33 | 0.0550 |
| **Score** | | | | | **0.1108 → 11.1** |

> The score shown in the screenshot is 12.4 because the exact national maxima shift depending on the full dataset loaded.

**Code location:** `buildStateScore()` in `src/App.tsx` (used by the right rail panels and bar chart); `footprintScoreFor()` inside `ChoroplethMap.tsx` `useMemo` (used for map coloring).

---

### 2. Portfolio Average Score

```
avg_score = Σ scoreFor(state) for each selected state  /  count(selected states)
```

This is a simple **arithmetic mean** of the same `scoreFor()` function across all portfolio states. It updates live as weights change or states are added/removed.

**"Driver: Energy / Water / Carbon" label:**

```
driver = state with highest (weight(m) / total_weight)
```

The three weight values are sorted descending. Whichever metric's slider is currently the highest wins the "Driver" label. At equal weights (34/33/33), Energy wins because 34 > 33. At equal values it defaults to Energy.

---

### 3. Risk Lens Algorithms

Each lens produces a score between 0 and 1. That score is mapped to a color using D3's `scaleSequential(interpolateYlOrRd)` with domain `[0, max_score_across_all_states]`. Yellow = low, deep red = high.

**All six lenses — exact formulas from `ChoroplethMap.tsx`:**

#### Footprint (default)
```
score = footprintScoreFor(state)
      = Σ (metric × efficiency_factor / max_metric) × normalized_weight
```
Same as the weighted composite score above. Uses absolute footprint values (MWh, m³, tCO₂e).

#### Growth
```
center_count(state) = datacenter_count_2021
                    + (datacenter_count_2025 − datacenter_count_2021)
                    × clamp((timelineYear − 2021) / 4, 0, 1)
                    + whatIfNewCenters  [only for portfolio states]

growth_max = max(center_count) across all states

score = center_count(state) / growth_max
```
Highlights states with the most facilities at the selected timeline year. Since only 2021 and 2025 are real, the timeline toggle effectively picks between the two endpoints (ratio = 0 for 2021, ratio = 1 for 2025).

#### Density
```
density(state) = center_count(state) / max(1, energy_MWh / 1,000,000)
density_max    = max(density) across all states

score = density(state) / density_max
```
Facilities per terawatt-hour of electricity demand. A state with many small facilities relative to its energy use ranks high. Uses energy in TWh (MWh / 1,000,000) to keep the ratio meaningful.

#### Water
```
water_max = max(Water_intensity_m3_per_MWh) across all states

score = Water_intensity_m3_per_MWh(state) / water_max
```
Uses **intensity** (m³ per MWh generated), not total footprint. A state whose electricity grid is generated with water-intensive methods ranks high regardless of how many data centers it has.

#### Carbon
```
carbon_max = max(Carbon_intensity_tonsCO2e_per_MWh) across all states

score = Carbon_intensity_tonsCO2e_per_MWh(state) / carbon_max
```
Same pattern as Water — uses **carbon intensity of the electricity grid**, not total data center carbon footprint.

#### Risk (combined)
```
score = (footprintScore × 0.45)
      + (growthScore    × 0.25)
      + (waterScore     × 0.15)
      + (carbonScore    × 0.15)
```
A fixed-weight composite of all four other lenses. The 45/25/15/15 weights are hardcoded — they are not controlled by the weight sliders. The weight sliders only affect the Footprint lens component inside this formula.

---

### 4. Focus Top States (Map Dimming)

```
focused_states = top N states sorted by scoreFor(state) descending
                 where N = Focus Top States slider value (5–51, default 15)

For each state not in focused_states AND not in portfolio AND not in drilldown:
  apply CSS class "muted"  →  opacity: 0.22
```

This doesn't change any scores — it only dims visual opacity of lower-ranking states to help the top N stand out.

---

### 5. Color Scale

```
colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
               .domain([0, max_score])
               .clamp(true)

fill(state) = colorScale(scoreFor(state))
```

- `max_score` = the highest `scoreFor()` value across all states under current lens and weights
- `clamp(true)` means values outside [0, max_score] don't produce out-of-range colors
- `interpolateYlOrRd` maps 0 → `#ffffcc` (light yellow), 1 → `#800026` (dark red)

Because `max_score` is recomputed every time weights change, the color scale always stretches to fill the full yellow-to-red range — the top state is always deep red regardless of its absolute score.

---

### 6. State Intelligence — Score Driver Bars

Each bar shows **what fraction of this state's total score is explained by that metric**:

```
contribution(state, m) = (metric_value / max_metric) × normalized_weight(m)
total_contribution     = Σ contribution across all three metrics

bar_width_pct(m) = contribution(state, m) / total_contribution × 100
```

This is a proportional decomposition of the score. The three bars always sum to 100%, so they show the relative importance of each metric for this specific state under the current weights.

**Example — Pennsylvania at default weights:**
- Energy contributes 0.0530 / 0.1108 = **47.8%** → bar at ~48%
- Carbon contributes 0.0550 / 0.1108 = **49.6%** → bar at ~50%
- Water contributes 0.0028 / 0.1108 = **2.5%** → bar at ~2.5%

---

### 7. Portfolio Avg Score and Datacenter Counts

```
avg_score = Σ scoreFor(s) for each selected state s  /  N_states

total_2021   = Σ datacenter_count_2021  for each selected state
total_2025   = Σ datacenter_count_2025  for each selected state
net_growth   = total_2025 − total_2021

what_if_total = whatIfNewCenters × N_states   [shown separately, never added to real counts]
```

The what-if modeled count is always displayed as a separate `+ X modeled` tag and is never mixed into `total_2021` or `total_2025`.

---

### 8. Sparklines in Ranking Table

Each sparkline is a two-point SVG line. The y-position of each point is:

```
max  = max(count_2021, count_2025, 1)        ← prevent divide-by-zero

y_2021 = (h − 2) − (count_2021 / max) × (h − 8)
y_2025 = (h − 2) − (count_2025 / max) × (h − 8)
```

Where `h = 20px` (total SVG height), leaving 2px padding top and bottom.

- If `count_2025 > count_2021` → line color `#16a34a` (green, rising)
- If `count_2025 < count_2021` → line color `#dc2626` (red, falling)
- If equal → color `#94a3b8` (neutral grey, flat)

The left dot is semi-transparent (`fillOpacity: 0.5`) to suggest it's the starting point; the right dot is solid to emphasize the 2025 endpoint.

---

### 9. Scatter Plot Encodings

```
x = datacenter_count_2021         → d3.scaleLinear  domain [0, max_2021 × 1.08]
y = datacenter_count_2025         → d3.scaleLinear  domain [0, max_2025 × 1.08]
r = sqrt(total_facility_area)     → d3.scaleSqrt    range  [5px, 24px]
color = growth_pct_2021_2025      → d3.scaleSequential(interpolateRdYlGn)
                                     domain [max_growth_pct, 0]   ← inverted so red = high growth
```

The domain for `r` uses `d3.scaleSqrt` (square-root scale) so bubble **area** is proportional to facility area, not bubble radius. This is the perceptually correct encoding for size.

The color domain is intentionally reversed `[max, 0]` so that high growth maps to red (top of `interpolateRdYlGn`) and low/negative growth maps to green (bottom).

The dashed diagonal is the `y = x` line — computed as:
```
endpoint_value = min(x_domain_max, y_domain_max)
line: (xScale(0), yScale(0)) → (xScale(endpoint_value), yScale(endpoint_value))
```

---

### 10. Bar Chart Race Interpolation

```
t = clamp((year − 2021) / 4,  0,  1)       ← year is a floating-point value 2021–2025

interpolated_count(state) = count_2021 + (count_2025 − count_2021) × t
```

`t = 0` → shows 2021 real values exactly.
`t = 1` → shows 2025 real values exactly.
Values in between are linear estimates. The year counter displays "2021" when `t ≈ 0`, "2025" when `t ≈ 1`, and "→" otherwise — never a specific intermediate year — because 2022/2023/2024 data does not exist.

---

### 11. HUC8 Siting Risk Score

```
norm(x) = (x − global_min) / (global_max − global_min)   ← min-max normalization

Risk_score = (norm(WF_1MW_DC) + norm(CF_1MW_DC) + norm(WSF_1MW_DC)) / 3
```

Applied independently per metric across all HUC8 watersheds. Score = 1.0 means highest combined environmental burden for a 1 MW data center placement at that watershed.

---

### 12. Spatial Join — How 2021 State Counts Were Derived

**Problem:** The raw OSM CSV had coordinates for 388 facilities but `addr:state` was blank for 387 of them, so the pipeline script produced all-zero state counts.

**Fix (Python / Shapely):**

1. Load `states-10m.json` (TopoJSON). Decode arc geometry into Shapely polygons for all 51 states.
2. For each of the 388 facility lat/lon points, run a **point-in-polygon containment test** against every state polygon.
3. For 2 unmatched points (coastal/border edge cases): assign to the nearest state polygon by Euclidean distance (tolerance: 2.0 degrees — both passed).
4. Count matched points per state → `datacenter_count_2021`.

**Result:** 386/388 matched by containment, 2 by nearest-neighbor.

**Top 2021 state counts:** VA 112, CA 48, WA 45, TX 37, OR 23, IA 19, NJ 17, AZ 14.

---

## Data Pipeline — Step by Step

Run from the project root. Steps 2–4 are only needed when regenerating facility count data from scratch.

```bash
# Step 1 — Convert source Excel files to CSVs
#   Reads:   public/data/SI_XLS/Input data.xlsx  → Table 6 (state footprint inputs)
#            public/data/SI_XLS/Results.xlsx      → Table 1 (HUC8 footprints)
#                                                 → Table 3 (1 MW siting risk)
#   Writes:  public/data/state_energy_water_carbon.csv
#            public/data/huc8_environmental_footprints.csv
#            public/data/huc8_1mw_siting_with_risk.csv
python scripts/prepare_data.py

# Step 2 — Download + filter the 2021 OSM North America snapshot (~10–12 GB PBF)
#   Requires osmium-tool and gdal/ogr2ogr in PATH
#   Writes:  data/osm_datacenters_2021/datacenters_2021_locations.csv  (388 facilities)
#            data/osm_datacenters_2021/datacenter_state_counts_2021.csv (all-zero — see note)
#   NOTE:    The state counts from this script are unreliable (missing addr:state tags).
#            The correct 2021 state counts are produced by the spatial join in Step 4.
python scripts/download_osm_datacenters_2021.py

# Step 3 — Download the 2025 IM3 Atlas
#   Auto-downloads from GitHub; follow the printed manual instructions if that fails
#   Writes:  data/im3_datacenters_2025/im3_datacenters_2025_locations.csv
#            data/im3_datacenters_2025/im3_datacenter_state_counts_2025.csv
python scripts/download_im3_datacenter_atlas_2025.py

# Step 4 — Merge 2021 + 2025 counts into a single comparison table
#   Writes:  public/data/datacenter_counts_2021_2025.csv
#            data/datacenter_counts_2021_2025.csv (local copy)
#   NOTE:    2021 state counts here come from the OSM addr:state tags, which are mostly
#            zero. After running this script, you must re-run the spatial join (see below)
#            to patch in correct 2021 counts.
python scripts/compare_datacenter_counts_2021_2025.py

# Step 5 (optional) — Enrich state footprint with per-facility normalized metrics
python scripts/join_datacenter_counts_with_state_footprint.py

# Step 6 (optional) — Download HUC8 watershed boundary GeoJSON
python scripts/download_huc8_boundaries.py
```

> **Spatial join patch:** After Step 4, the `datacenter_count_2021` column will be all zeros. The correct counts were derived by a separate spatial join script (using `states-10m.json` + Shapely) and written directly to `public/data/datacenter_counts_2021_2025.csv`. If you re-run Step 4, you will need to re-apply the spatial join. The methodology is documented in the Calculations section above.

### Python Environment

```bash
mamba create -n dc-footprint -c conda-forge \
  python=3.11 pandas geopandas shapely pyogrio requests \
  osmium-tool gdal -y

conda activate dc-footprint
```

> Step 2 downloads a ~10–12 GB PBF on first run and skips it on subsequent runs if the file already exists.

---

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build locally
npm run lint       # ESLint check
```

All data is served from `public/data/` — no backend or API key needed.

---

## Dashboard Features — Full Reference

### Environmental Footprint Tab

The main tab. Every panel shares a single `scoreFor(state)` function recomputed live from the active weight sliders.

---

#### Summary Cards

Three KPI cards show **national totals** across all states:

| Card | Calculation |
|---|---|
| Total Energy Demand | `Σ Scaled_power_consumption_MWh` |
| Total Water Footprint | `Σ Water_footprint_m3` |
| Total Carbon Footprint | `Σ Carbon_footprint_tonsCO2e` |

---

#### State Map Weights

Three range sliders control how much each metric contributes to the composite score. They do not need to sum to 100 — the app divides each by `total_weight` automatically.

**Preset scenarios** (click to apply all three weights, focus count, and lens at once):

| Preset | Energy | Water | Carbon | Focus N | Lens |
|---|---|---|---|---|---|
| Balanced | 34% | 33% | 33% | 15 | Footprint |
| Hyperscaler Expansion | 70% | 15% | 15% | 12 | Growth |
| Water-Constrained Planning | 15% | 70% | 15% | 12 | Water |
| Carbon-Aware Siting | 15% | 15% | 70% | 12 | Carbon |
| Combined Risk | 45% | 30% | 25% | 20 | Risk |

**Focus Top States** slider (5–51): dims all states outside the top N ranked by score.

**Reset** restores default weights, focus count, selected states, and lens.

---

#### Risk Lens & Interaction Studio

The studio has **two rows**:

**Row 1 — Risk Lens (full width):** Six segmented buttons that change what the map color encodes. Separated from the rest so the buttons never get clipped.

**Row 2 — Scenario controls:**

| Control | Range | Effect |
|---|---|---|
| Timeline | 2021 / 2025 toggle | Switches which real data year is used for center counts in Growth lens, tooltips, and compare drawer. These are the only two years with real data. |
| New Centers | 0 – 50 | Adds hypothetical centers to portfolio states, affecting Growth and Risk lens scores. |
| Efficiency Gain | 0 – 40% | Reduces energy/water/carbon metrics for portfolio states only. |
| Lasso | checkbox | Enables rectangle-drag to batch-add states to portfolio. |
| Compare | button | Opens Compare Drawer (requires ≥ 2 portfolio states). |
| Export | button | Triggers `window.print()` for PDF/print export. |

---

#### Choropleth Map

States are colored by the active lens score using D3's `interpolateYlOrRd` scale (yellow = low, red = high).

**Map interactions:**

| Action | Result |
|---|---|
| Hover a state | Tooltip appears (see fields below) |
| Click a state | Pins it as the selected state AND adds it to the portfolio |
| Double-click a state | Opens State Drilldown panel |
| Drag in Lasso mode | Rectangle selection; states whose centroid falls inside are portfolio-added |
| Check "2025 centers" | Overlays teal dots for all IM3 2025 facility locations |
| Check "2021 centers" | Overlays blue dots for all OSM 2021 facility locations |
| Click "🏷 Labels" | Toggles score badge labels directly on each state (weather-map style) |

**Tooltip fields (shown on hover):**

| Field | Data source |
|---|---|
| State name + flag | `constants.ts` STATE_NAMES |
| Combined score | Live `scoreFor()` under current weights |
| Centers 2021 | `datacenter_count_2021` from comparison table |
| Centers 2025 | `datacenter_count_2025` + colored net-change badge (+/−) |
| Energy | `Scaled_power_consumption_MWh` |
| Water | `Water_footprint_m3` |
| Carbon | `Carbon_footprint_tonsCO2e` |

---

#### State Command Bar

Sits between the studio and the map. Provides two dropdowns:

- **Jump to State** — pins any state without needing to click the map
- **Add to Portfolio** — multi-select states into the portfolio (checkmark shown for already-selected states)

Selected portfolio states appear as dismissible chip buttons below the dropdowns.

---

#### Smart Insights Panel

Auto-generated plain-language summary. Chooses a **focus state** by this priority chain:

```
focusRow = activeState  (if a state is pinned)
         ?? selectedStates[0]  (first portfolio state if none pinned)
         ?? top-ranked state by scoreFor()  (fallback — always shown)
```

**"Driven most by X exposure"** — determined by `dominantMetric()`:

```
for each metric m in [Energy, Water, Carbon]:
  normalized(m) = raw_value(focusRow, m) / max_value(m across all states)

dominant = metric with highest normalized value
```

This is weight-independent — it shows which metric is intrinsically highest relative to the national maximum, regardless of how the sliders are set.

**Portfolio average score** — shown when ≥ 1 portfolio state is selected:

```
portfolioScore = Σ scoreFor(state) / count(selectedStates)   × 100
```

**Scenario line** — shown whenever New Centers > 0 or Efficiency Gain > 0.

---

#### State Portfolio Panel

Appears when **2 or more states** are added to the portfolio.

**Header:** Average weighted score + dominant driver label.

**Data Centers block** — shows real counts for both data years:

```
DATA CENTERS
  2021      →      2025      [net growth badge]
  [total]          [total]
  [+ X modeled]  ← only appears when New Centers slider > 0
```

- Totals are sums of `datacenter_count_2021` and `datacenter_count_2025` across all selected states
- Growth badge is green if positive, red if negative
- The modeled count (what-if) is shown as a separate purple indicator so it is never confused with real data

**Per-state rows** (full-width chips, one per selected state):

```
[flag]  NC   27.4  score       3 → 23   +20
[flag]  NE    4.8  score      19 → 26    +7
[flag]  SC   23.1  score       7 → 12    +5
```

- Left side: flag, abbreviation, weighted score
- Right side: `2021_count → 2025_count net_change` (green if grew, red if declined)
- Click any chip to remove that state from the portfolio

**Footprint metrics** — Energy, Water, Carbon totals for the portfolio:

```
portfolio_total(m) = Σ raw_value(state, m) for each selected state

pct_of_US(m) = portfolio_total(m) / Σ raw_value(all_states, m)  × 100

bar_width = min(pct_of_US, 100)%   ← capped at 100% visually
```

Displayed as e.g. "3,815,042 MWh / 5.3% of U.S." with a proportional fill bar showing share of the national total.

---

#### State Intelligence Panel

Appears when a single state is pinned (via map click, double-click, or Jump to State dropdown).

---

**Score section**

Displays two numbers: the weighted composite score and the state's national rank.

*Score (0–100):*

```
score = Σ for each metric m in [Energy, Water, Carbon]:
          (raw_value(state, m) / max_value(m))  ×  (slider_weight(m) / total_slider_weight)

displayed_score = score × 100
```

- `raw_value` is the actual metric from the CSV (`Scaled_power_consumption_MWh`, `Water_footprint_m3`, `Carbon_footprint_tonsCO2e`)
- `max_value(m)` is the highest value of that metric across all 51 states — this is the normalization denominator
- `slider_weight(m)` is the current position of that metric's slider (e.g. 34 for Energy)
- `total_slider_weight` = sum of all three slider values (normalizes weights so they don't need to add to 100)

The result before ×100 is always between 0 and 1. Texas always scores near 100 because it dominates the Energy metric. Nebraska scoring 4.8 means it is at about 4.8% of the way between the lowest and highest possible scores under current weights.

*Rank (#N):*

```
sorted_states = all 51 states sorted by scoreFor(state) descending
rank(state)   = index_of(state, sorted_states) + 1
```

Rank #1 = highest environmental burden. Rank changes live as you move weight sliders — a state that ranks high on energy may drop when you increase the water weight.

---

**Score driver bars**

The three bars answer: *"Of this state's total score, how much comes from Energy vs Water vs Carbon?"*

```
contribution(m) = (raw_value(state, m) / max_value(m))  ×  (slider_weight(m) / total_slider_weight)

total_contribution = contribution(Energy) + contribution(Water) + contribution(Carbon)

bar_width_pct(m) = contribution(m) / total_contribution × 100
```

The three bar widths always sum to 100%. If Energy's bar is at 44%, it means energy consumption alone is responsible for 44% of this state's score. Moving the Water slider up would grow the Water bar and shrink the others proportionally.

Color coding: red = energy, teal = water, purple = carbon.

---

**Raw metrics**

The exact values from the source CSV, displayed without any normalization:

- Energy: `Scaled_power_consumption_MWh` — estimated annual electricity demand from data centers
- Water: `Water_footprint_m3` = `Water_intensity_m3_per_MWh × Scaled_power_consumption_MWh`
- Carbon: `Carbon_footprint_tonsCO2e` = `Carbon_intensity_tonsCO2e_per_MWh × Scaled_power_consumption_MWh`

---

**Data Centers section**

```
DATA CENTERS
  2021     →     2025     [net growth badge]
  [count]        [count]
Total area 2025: X.XM sqft   ← when available from IM3 Atlas
```

- **2021 count** — from `datacenter_count_2021` in the comparison table, derived by spatially joining OSM locations to state boundaries
- **2025 count** — from `datacenter_count_2025` in the comparison table, sourced from IM3 Atlas
- **Net growth badge** — `count_2025 − count_2021`. Green badge if positive (grew), red if negative (declined, e.g. Oklahoma 7→6 = −1)
- **Total area** — `total_facility_area_sqft_2025 / 1,000,000`, shown in millions of sqft when the IM3 Atlas has area data for that state

---

#### State Drilldown Panel

Appears on **double-click** of a map state. Compact 2×2 grid showing:

| Cell | Source |
|---|---|
| Score | `scoreFor(state) × 100` under current weights and lens |
| 2021 centers | `datacenter_count_2021` from comparison table |
| 2025 centers | `datacenter_count_2025` from comparison table |
| Growth | `datacenter_count_2025 − datacenter_count_2021` |

---

#### Top 10 Ranking Table

Sorted by current weighted score (uses its own internal `buildScore()` — same formula as `scoreFor()` in App.tsx, recomputed independently). Shows the top 10 states only.

| Column | Content | Formula |
|---|---|---|
| # | Rank 1–10 | Position in descending sort of `scoreFor()` |
| State | Abbreviation + full name | — |
| Score | 0–100 | `scoreFor(state) × 100` |
| Bar | Proportional fill | `(score / max_score_in_top10) × 100%` |
| Trend | Sparkline | SVG line from `count_2021` to `count_2025` |
| +/− | Portfolio toggle | Adds or removes from `selectedStates` |

**Proportional bar formula:**
```
max_val = scoreFor(rank_1_state)    ← always the highest in the list
bar_pct(state) = scoreFor(state) / max_val × 100
```
The top state always has a 100% bar. All other bars are scaled relative to it.

**Sparkline:** Two-point SVG line — y-positions scaled relative to `max(count_2021, count_2025)`. Green if grew, red if declined. Hover tooltip: `"2021: X → 2025: Y (+Z)"`.

---

#### Compare Drawer

Full-height slide-in panel. Requires ≥ 2 portfolio states.

**Energy / Water / Carbon KPIs:**
```
portfolio_total(m) = Σ raw_value(state, m) for selected states
national_total(m)  = Σ raw_value(all states, m)
pct_of_US(m)       = portfolio_total(m) / national_total(m) × 100
```

**Center count:**
```
center_count(state) = datacenter_count_2021
                    + (datacenter_count_2025 − datacenter_count_2021)
                    × clamp((timelineYear − 2021) / 4, 0, 1)
                    + whatIfNewCenters   [for each portfolio state]

total_centers = Σ center_count(state) for all portfolio states
```

**Dominant driver:** whichever of the three slider values is currently highest (`weight(m) / total_weight` sorted descending).

**Per-state table:** all portfolio states sorted by `scoreFor(state) × 100` descending.

**Export:** `window.print()` — use browser print-to-PDF.

---

#### Siting Risk Tool

Watershed-level explorer using `huc8_1mw_siting_with_risk.csv`.

**What it answers:** "If I place a 1 MW data center in this watershed, what is the environmental burden?"

**Three selectable metrics:**

| Metric | Column | Unit | Meaning |
|---|---|---|---|
| Water footprint | `WF_1MW_DC` | m³ | Freshwater withdrawal attributed to 1 MW DC |
| Carbon footprint | `CF_1MW_DC` | tCO₂e | Greenhouse gas emissions attributed to 1 MW DC |
| Water scarcity | `WSF_1MW_DC` | m³eq | Water footprint weighted by local scarcity factor |

**Color scale:** `d3.scaleSequential(interpolateYlOrRd)` with domain `[0, max_value_across_all_HUC8]`. Yellow = low burden, red = high.

**Hover tooltip:** HUC8 code and raw metric value.

**Risk score (precomputed in CSV):**
```
Risk_score_equal_weights = (norm(WF) + norm(CF) + norm(WSF)) / 3
```
where `norm(x) = (x − min) / (max − min)` across all HUC8 watersheds.

---

#### HUC8 Scarcity Map

Displays per-watershed footprints from `huc8_environmental_footprints.csv` using the **PCA (Primary Control Area)** grid allocation method.

**Three metric views and their columns:**

| View | Column | Unit |
|---|---|---|
| Water footprint | `WF_PCA_m3` | m³ |
| Carbon footprint | `CF_PCA_tonsCO2e` | tCO₂e |
| Water scarcity | `WSF_PCA_m3eq` | m³eq |

**Color scale:** Same `interpolateYlOrRd` sequential scale, domain stretched to `[0, max_across_all_watersheds]` for the selected metric.

---

### Analytics Section

Appears directly below the choropleth map in the same left column — no visual gap between the map and these charts.

---

#### Top States Bar Chart (`TopStatesBarChart.tsx`)

**Metric toggle:** Combined / Energy / Water / Carbon.

**Bar width formula — Combined view:**
```
value(state) = scoreFor(state) × 100
max_val      = value of rank-1 state in current top-N

bar_pct(state) = value(state) / max_val × 100
```
Bar color = color of the metric with the highest slider value (dominant weight).

**Bar width formula — single metric view (e.g. Energy):**
```
value(state) = raw_value(state, m)          ← e.g. Scaled_power_consumption_MWh
max_val      = max(raw_value) across all 51 states

bar_pct(state) = value(state) / max_val × 100
```

**Sorting:** Always descending by the active metric. Switching to Energy re-sorts by `Scaled_power_consumption_MWh`.

**Top N slider (5–51):** Slices the sorted list to show only the top N states.

**Bar animation:** CSS `transition: width 0.45s cubic-bezier(0.4,0,0.2,1)` — bars animate to new widths whenever weights or metric change. No re-mount, no flicker.

**Right column:** `datacenter_count_2025` for each state. Shows "—" if unavailable.

**Click a bar:** Pins that state and adds it to the portfolio.

---

#### Scatter Plot (`ScatterPlot.tsx`)

One bubble per state comparing the two real data years.

| Visual encoding | Data |
|---|---|
| X-axis | `datacenter_count_2021` (spatially joined OSM) |
| Y-axis | `datacenter_count_2025` (IM3 Atlas) |
| Bubble size | `total_facility_area_sqft_2025` scaled with `d3.scaleSqrt` |
| Bubble color | `datacenter_growth_pct_2021_2025` via `d3.interpolateRdYlGn` — red = high growth %, green = low/negative |
| Dashed diagonal | y = x — states above grew, states below declined |

**Tooltip:** 2021 count, 2025 count, net growth + %, 2025 area.

**Click:** Selects that state across the dashboard.

---

#### Data Center Count Race (`BarChartRace.tsx`)

Animated bar chart race between 2021 OSM counts and 2025 IM3 Atlas counts for the top 12 states.

**Animation engine:** `requestAnimationFrame` (no `setInterval`). Plays over ~5 seconds.

**Year display logic:**

| State | Display |
|---|---|
| At start (year ≤ 2021.05) | "2021" |
| During playback | "→" in blue — no intermediate year shown |
| At end (year ≥ 2024.95) | "2025" |

No year number for 2022/2023/2024 is ever displayed because those years have no real data. The animation is a smooth visual transition between the two real endpoints only.

**Controls:** ▶ Play / ⏸ Pause / ↺ Reset. Play restarts from 2021 if already at 2025.

**Bar colors:** Consistent per state using a predefined 16-state color palette; fallback slate palette for all others.

---

### Data Centers (2025) Tab

Full dot map of all IM3 Atlas 2025 facilities (`im3_datacenters_2025_locations.csv`). Each dot = one facility record. Hover for name, state, and source layer (point / building / campus). Total count shown in the panel header.

---

### Data Centers (2021) Tab

Dot map of 388 OSM-tagged facilities (`datacenters_2021_locations.csv`) from the January 2021 North America extract. Hover for OSM ID, name, and city. Total count shown in the panel header.

---

## Component Reference

| Component | Key props | Notes |
|---|---|---|
| `ChoroplethMap` | `data`, `weights`, `lens`, `focusCount`, `datacenterCountsByState`, `lassoMode`, … | All lens scores computed internally via `useMemo`. Lasso uses mouse drag events on the SVG. Labels rendered as `<text>` inside the SVG. Tooltip shown via absolute-positioned `<div>`. |
| `RankingTable` | `data`, `weights`, `countsByState`, `selectedStates`, … | Rebuilds `scoreFor` internally (independent of App.tsx score). Sparklines are inline SVG `<line>` + `<circle>` elements. |
| `SummaryCards` | `data` | Sums national totals; no interactivity. |
| `TopStatesBarChart` | `data`, `weights`, `scoreFor`, `countsByState`, `selectedStates`, … | View toggle + Top N slider. Bar widths use CSS `transition`. |
| `BarChartRace` | `rows: DatacenterCountRow[]` | Fully self-contained; manages animation state internally with `useRef` + `requestAnimationFrame`. |
| `ScatterPlot` | `rows`, `selectedStates`, `onSelectState` | Self-contained D3 scales. SVG rendered in JSX (not D3 DOM mutations). Tooltip via absolute `<div>`. |
| `SitingRiskTool` | (uses `useSitingData` internally) | HUC8 siting risk map. |
| `Huc8ScarcityMap` | (uses `useHuc8Data` internally) | HUC8 watershed footprint map. |
| `StateFlag` | `state`, `size?` | Thin wrapper around `us-state-flags`. |

**Inline panel components in `App.tsx`:**

| Component | Key additions |
|---|---|
| `PortfolioPanel` | Shows real `datacenter_count_2021` and `datacenter_count_2025` totals + per-state chips with individual 2021→2025 counts. No longer depends on `timelineYear`. |
| `StateInsightPanel` | Accepts `countsByState` prop; renders 2021 count, 2025 count, growth badge, and 2025 area below the footprint metrics. |
| `DrilldownPanel` | Compact 2021/2025/growth grid for double-clicked states. |
| `CompareDrawer` | Executive summary for ≥ 2 portfolio states. |
| `InteractionStudio` | Two-row layout: Row 1 = Risk Lens (never clips); Row 2 = Timeline toggle + sliders + actions. |

---

## Limitations & Data Notes

**2021 facility counts** are derived from an OpenStreetMap crowdsourced snapshot. OSM coverage of data centers is incomplete — facilities not explicitly tagged are absent. The spatially joined state counts (386/388 matched) are more accurate than raw OSM tags but still undercount the true 2021 population.

**2025 facility counts** come from the IM3 Atlas, which applies its own OSM-derived processing pipeline. Direct count comparison between 2021 OSM and 2025 IM3 reflects both methodology differences and actual growth — these are not complete facility censuses.

**2022, 2023, 2024** have no real facility data. The bar chart race animates a linear interpolation between the two real endpoints as a visual transition only, disclosed in the UI with "→" during playback and a footnote. No conclusions about those years should be drawn.

**Environmental footprint metrics** are state-level modeled estimates scaled from published intensity factors — not metered records. Do not assign precise footprints to individual facilities using these numbers.

**Water and carbon intensities** vary by grid allocation method (PCA, HUC4, Interconnection, eGRID, State). HUC8 visualizations use the PCA (primary control area) method by default.

**Score rankings** are relative within the loaded dataset. Changing the underlying data files or weight sliders shifts all ranks simultaneously.

---

## Citation

If you use data or visualizations from this dashboard, please cite the underlying sources:

- **IM3 Data Center Atlas (2025):** OSTI DOI [10.11578/2550666](https://www.osti.gov/biblio/2550666) — IMMM-SFA, Pacific Northwest National Laboratory
- **OpenStreetMap (2021 snapshot):** © OpenStreetMap contributors, [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/)
- **Environmental footprint data:** See `public/data/SI_XLS/` for the originating supplementary information workbooks
