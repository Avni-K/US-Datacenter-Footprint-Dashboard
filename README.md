# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

## Optional: Download 2021 OSM Data Center Locations

`scripts/download_osm_datacenters_2021.py` downloads a January 2021 Geofabrik
North America OSM snapshot, filters data-center-like features, and produces
GeoJSON and CSV outputs including state-level counts.

> **Note:** OpenStreetMap-derived data center locations are used as a
> facility-location proxy. Because OSM is crowd-sourced, the extracted features
> may be incomplete and should not be interpreted as a complete census of all
> U.S. data centers.

### What the script produces

| File | Description |
|------|-------------|
| `data/osm_datacenters_2021/datacenters_2021_points.geojson` | Point features tagged as data centers |
| `data/osm_datacenters_2021/datacenters_2021_polygons.geojson` | Polygon features tagged as data centers |
| `data/osm_datacenters_2021/datacenters_2021_lines.geojson` | Line features tagged as data centers |
| `data/osm_datacenters_2021/datacenters_2021_locations.geojson` | Combined GeoJSON (all layers) |
| `data/osm_datacenters_2021/datacenters_2021_locations.csv` | Combined CSV with lat/lon and OSM address tags |
| `data/osm_datacenters_2021/datacenter_state_counts_2021.csv` | Counts by `addr:state` |

### Required tools

| Tool | Purpose |
|------|---------|
| `osmium-tool` | Filter OSM PBF by tag |
| `gdal` / `ogr2ogr` | Convert PBF layers to GeoJSON |
| `requests` | (unused at runtime; useful for testing) |
| `pandas` | CSV output and state aggregation |
| `geopandas` | GeoJSON reading and geometry operations |
| `shapely` | Representative-point / centroid calculation |
| `pyogrio` | Fast GeoJSON I/O backend for geopandas |

### Setup (Windows — recommended via mamba/conda)

```bash
mamba create -n osm-dc -c conda-forge python=3.11 osmium-tool gdal geopandas pandas requests pyogrio shapely -y
conda activate osm-dc
```

### Run

From the project root (with the `osm-dc` environment active):

```bash
python scripts/download_osm_datacenters_2021.py
```

The first run downloads a ~10–12 GB PBF file; subsequent runs skip the
download if the file already exists.

---

## Optional: Join Data-Center Counts with State Footprint

After running the OSM script, you can enrich the state-level footprint data
with per-datacenter normalised metrics:

```bash
python scripts/join_datacenter_counts_with_state_footprint.py
```

This reads `data/osm_datacenters_2021/datacenter_state_counts_2021.csv` and
`public/data/state_energy_water_carbon.csv`, joins them by state, and writes:

```
data/osm_datacenters_2021/state_energy_with_datacenter_counts_2021.csv
```

New columns added:

| Column | Formula |
|--------|---------|
| `energy_per_datacenter` | `Scaled_power_consumption_MWh / datacenter_count_2021` |
| `water_per_datacenter` | `Water_footprint_m3 / datacenter_count_2021` |
| `carbon_per_datacenter` | `Carbon_footprint_tonsCO2e / datacenter_count_2021` |

States with no OSM data-center count will have `NaN` for these columns.

---

## 2025 IM3 Data Center Atlas Layer

The [IM3 Open Source Data Center Atlas](https://immm-sfa.github.io/datacenter-atlas/) is a
2025 dataset of existing U.S. data center facility locations derived from OpenStreetMap and
processed to include additional variables such as facility area, county, and state.

**Source / DOI:** <https://www.osti.gov/biblio/2550666>
**GitHub:** <https://github.com/IMMM-SFA/datacenter-atlas>

### How to run

**Step 1 — Download and preprocess the IM3 Atlas:**

```bash
python scripts/download_im3_datacenter_atlas_2025.py
```

The script attempts to auto-download from the GitHub repository. If the dataset requires
manual download, it will print clear instructions. In that case:

1. Visit <https://www.osti.gov/biblio/2550666> or <https://github.com/IMMM-SFA/datacenter-atlas>
2. Download the dataset file(s) (`.csv`, `.geojson`, `.shp`, or `.gpkg`)
3. Place the file(s) inside `data/im3_datacenters_2025/raw/`
4. Re-run the script

**Step 2 — Generate the 2021 vs 2025 comparison table:**

```bash
python scripts/compare_datacenter_counts_2021_2025.py
```

This joins the OSM 2021 state counts with IM3 2025 state counts, computes growth metrics,
and writes the merged CSV to `public/data/` so the dashboard can load it.

### Output files

| File | Description |
|------|-------------|
| `data/im3_datacenters_2025/im3_datacenters_2025_locations.csv` | Standardised facility CSV with lat/lon |
| `data/im3_datacenters_2025/im3_datacenters_2025_locations.geojson` | Facility GeoJSON |
| `data/im3_datacenters_2025/im3_datacenter_state_counts_2025.csv` | State-level counts and total area |
| `public/data/datacenter_counts_2021_2025.csv` | Merged 2021/2025 comparison table served by the dashboard |
| `data/datacenter_counts_2021_2025.csv` | Local copy of the same comparison table |

### Dashboard tab

After running the two scripts above, reload the dev server and open the
**"Facility Growth 2021→2025"** tab. It shows:

- KPI cards (total DCs 2021, 2025, net growth, growth %)
- Top-10 bar charts toggling between 2021 and 2025
- Top-10 growth ranking
- Scatter plot (2021 count vs 2025 count per state)
- Choropleth map selectable by 2021 count / 2025 count / net growth / growth %

### Limitations

> The 2021 and 2025 facility-location layers come from different OSM-derived sources and
> should be interpreted as approximate mapped facility proxies, not complete facility censuses
> or exact electricity-use records.

- The 2021 OSM layer was extracted directly from a raw PBF snapshot; many features lacked
  `addr:state` tags, so state-level counts may undercount 2021 facilities. A spatial join
  using geometry is needed for accurate 2021 state attribution.
- The 2025 IM3 Atlas applies its own processing pipeline on top of OSM, so direct
  count-to-count comparison reflects differences in methodology as well as actual growth.
- Do not assign exact electricity, carbon, or water usage to individual facilities based
  on these counts alone.
