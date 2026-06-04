"""
download_osm_datacenters_2021.py

Downloads a 2021 OpenStreetMap (Geofabrik) North America extract,
filters data-center-like OSM features, and produces GeoJSON and CSV outputs
with state-level counts.

Run from the project root:
    python scripts/download_osm_datacenters_2021.py

Required tools (in PATH):
    osmium-tool   (mamba install -c conda-forge osmium-tool)
    gdal/ogr2ogr  (mamba install -c conda-forge gdal)

Required Python packages:
    requests, pandas, geopandas, shapely, pyogrio
"""

import os
import sys
import shutil
import subprocess
import urllib.request
from pathlib import Path

# Override any conflicting PROJ installation (e.g. PostGIS) with conda's copy.
_CONDA_PROJ = Path(sys.executable).parent.parent / "Library" / "share" / "proj"
if _CONDA_PROJ.exists():
    os.environ["PROJ_DATA"] = str(_CONDA_PROJ)
    os.environ["PROJ_LIB"] = str(_CONDA_PROJ)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "data" / "osm_datacenters_2021"
PBF_PATH = OUT_DIR / "north-america-210101.osm.pbf"
FILTERED_PBF = OUT_DIR / "datacenters_2021.osm.pbf"

POINTS_GEOJSON   = OUT_DIR / "datacenters_2021_points.geojson"
POLYGONS_GEOJSON = OUT_DIR / "datacenters_2021_polygons.geojson"
LINES_GEOJSON    = OUT_DIR / "datacenters_2021_lines.geojson"
COMBINED_GEOJSON = OUT_DIR / "datacenters_2021_locations.geojson"
COMBINED_CSV     = OUT_DIR / "datacenters_2021_locations.csv"
STATE_COUNTS_CSV = OUT_DIR / "datacenter_state_counts_2021.csv"

# Geofabrik 2021-01-01 North America snapshot
PBF_URL = "https://download.geofabrik.de/north-america-210101.osm.pbf"

# OSM tag expressions for osmium tags-filter
OSM_FILTER_EXPRS = [
    "telecom=data_center",
    "building=data_center",
    "building=data_centre",
]

# OGR layers to try extracting
OGR_LAYERS = [
    ("points",        POINTS_GEOJSON),
    ("multipolygons", POLYGONS_GEOJSON),
    ("lines",         LINES_GEOJSON),
]

# Fields to extract into the CSV (pulled from OSM tags / GeoJSON properties)
DESIRED_FIELDS = [
    "osm_id", "name", "operator", "telecom", "building",
    "addr:housenumber", "addr:street", "addr:city",
    "addr:state", "addr:postcode", "source_layer",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def check_tool(name: str, install_hint: str) -> bool:
    """Return True if *name* is on PATH, else print a helpful error."""
    found = shutil.which(name) is not None
    if not found:
        print(f"\n[ERROR] '{name}' is not installed or not on PATH.")
        print(f"        {install_hint}\n")
    return found


def download_pbf() -> bool:
    """Download the North America PBF if not already present."""
    if PBF_PATH.exists():
        print(f"[SKIP]  PBF already exists: {PBF_PATH}")
        return True

    print(f"[INFO]  Downloading {PBF_URL}")
    print("        This file is ~10-12 GB; download may take a while.")

    try:
        def _report(block_count, block_size, total_size):
            downloaded = block_count * block_size
            if total_size > 0:
                pct = min(downloaded / total_size * 100, 100)
                print(f"\r        {pct:5.1f}%  ({downloaded / 1e9:.2f} GB)", end="", flush=True)

        urllib.request.urlretrieve(PBF_URL, PBF_PATH, reporthook=_report)
        print()  # newline after progress
        print(f"[OK]    Saved to {PBF_PATH}")
        return True
    except Exception as exc:
        print(f"\n[ERROR] Download failed: {exc}")
        if PBF_PATH.exists():
            PBF_PATH.unlink()  # remove partial file
        return False


def filter_pbf() -> bool:
    """Use osmium tags-filter to extract data-center features."""
    if FILTERED_PBF.exists():
        print(f"[SKIP]  Filtered PBF already exists: {FILTERED_PBF}")
        return True

    print("[INFO]  Filtering OSM data for data-center tags …")
    cmd = [
        "osmium", "tags-filter",
        str(PBF_PATH),
        *OSM_FILTER_EXPRS,
        "-o", str(FILTERED_PBF),
        "--overwrite",
    ]
    print(f"        Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] osmium failed:\n{result.stderr}")
        return False
    print(f"[OK]    Filtered PBF saved to {FILTERED_PBF}")
    return True


def pbf_to_geojson() -> list[Path]:
    """Convert filtered PBF to GeoJSON for each OGR layer. Returns list of created files."""
    created = []
    for layer_name, out_path in OGR_LAYERS:
        if out_path.exists():
            print(f"[SKIP]  GeoJSON already exists: {out_path}")
            created.append(out_path)
            continue

        print(f"[INFO]  Converting layer '{layer_name}' to GeoJSON …")
        # GDAL's OSM driver requires an explicit WHERE clause to scan features;
        # without it the driver returns nothing even when features exist.
        if layer_name == "multipolygons":
            where = "building IN ('data_center','data_centre') OR other_tags LIKE '%\"telecom\"=>\"data_center\"%'"
        elif layer_name == "points":
            where = "other_tags LIKE '%\"telecom\"=>\"data_center\"%' OR other_tags LIKE '%\"building\"=>\"data_center\"%'"
        else:
            where = "1=1"
        cmd = [
            "ogr2ogr",
            "-f", "GeoJSON",
            str(out_path),
            str(FILTERED_PBF),
            layer_name,
            "-where", where,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[WARN]  ogr2ogr failed for layer '{layer_name}': {result.stderr.strip()}")
            continue
        if out_path.exists() and out_path.stat().st_size > 10:
            print(f"[OK]    {out_path}")
            created.append(out_path)
        else:
            print(f"[WARN]  Layer '{layer_name}' produced an empty file; skipping.")
            if out_path.exists():
                out_path.unlink()

    return created


def combine_geojson(geojson_files: list[Path]) -> bool:
    """Merge all per-layer GeoJSON files into one combined GeoJSON + CSV."""
    # Lazy import so the script can still print tool-missing errors without geopandas
    try:
        import geopandas as gpd
        import pandas as pd
        from shapely.geometry import mapping
    except ImportError as exc:
        print(f"[ERROR] Missing Python package: {exc}")
        print("        Install with: mamba install -c conda-forge geopandas pandas shapely pyogrio")
        return False

    layer_gdfs = []
    for path in geojson_files:
        layer_name = path.stem.replace("datacenters_2021_", "")
        try:
            gdf = gpd.read_file(path, engine="pyogrio")
            gdf["source_layer"] = layer_name
            layer_gdfs.append(gdf)
            print(f"[INFO]  Loaded {len(gdf):,} features from '{layer_name}'")
        except Exception as exc:
            print(f"[WARN]  Could not read {path}: {exc}")

    if not layer_gdfs:
        print("[ERROR] No GeoJSON layers could be loaded.")
        return False

    combined = gpd.GeoDataFrame(
        pd.concat(layer_gdfs, ignore_index=True),
        crs="EPSG:4326",
    )
    print(f"[INFO]  Combined total: {len(combined):,} features")

    # Save combined GeoJSON
    combined.to_file(COMBINED_GEOJSON, driver="GeoJSON", engine="pyogrio")
    print(f"[OK]    Combined GeoJSON: {COMBINED_GEOJSON}")

    # Build CSV
    rows = []
    for _, feat in combined.iterrows():
        row = {field: feat.get(field, None) for field in DESIRED_FIELDS}

        geom = feat.geometry
        if geom is None or geom.is_empty:
            row["lat"] = None
            row["lon"] = None
        elif geom.geom_type == "Point":
            row["lon"] = geom.x
            row["lat"] = geom.y
        else:
            try:
                pt = geom.representative_point()
            except Exception:
                pt = geom.centroid
            row["lon"] = pt.x
            row["lat"] = pt.y

        row["geometry"] = geom.wkt if geom is not None else None
        rows.append(row)

    df = pd.DataFrame(rows, columns=DESIRED_FIELDS + ["lat", "lon", "geometry"])
    df.to_csv(COMBINED_CSV, index=False)
    print(f"[OK]    Combined CSV: {COMBINED_CSV}")

    # State counts
    state_col = "addr:state"
    if state_col in df.columns:
        state_counts = (
            df[df[state_col].notna()]
            .groupby(state_col)
            .size()
            .reset_index(name="datacenter_count_2021")
            .rename(columns={state_col: "State"})
            .sort_values("State")
        )
        state_counts.to_csv(STATE_COUNTS_CSV, index=False)
        print(f"[OK]    State counts CSV: {STATE_COUNTS_CSV}")
        print(f"        {len(state_counts)} states/territories with labelled data centers")
    else:
        print("[WARN]  No 'addr:state' column found; state counts not generated.")
        pd.DataFrame(columns=["State", "datacenter_count_2021"]).to_csv(STATE_COUNTS_CSV, index=False)

    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  OSM 2021 Data Center Downloader")
    print("=" * 60)

    # Create output directory
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[INFO]  Output directory: {OUT_DIR}\n")

    # Check required external tools
    has_osmium = check_tool(
        "osmium",
        "Install using conda/mamba:  mamba install -c conda-forge osmium-tool",
    )
    has_ogr = check_tool(
        "ogr2ogr",
        "Install using conda/mamba:  mamba install -c conda-forge gdal",
    )

    if not has_osmium or not has_ogr:
        print("[ABORT] Please install the missing tools and re-run.")
        sys.exit(1)

    # Step 1 – Download
    if not download_pbf():
        sys.exit(1)

    # Step 2 – Filter
    if not filter_pbf():
        sys.exit(1)

    # Step 3 – Convert to GeoJSON
    geojson_files = pbf_to_geojson()
    if not geojson_files:
        print("[ERROR] No GeoJSON files were produced. Cannot continue.")
        sys.exit(1)

    # Step 4 – Combine and export
    if not combine_geojson(geojson_files):
        sys.exit(1)

    print("\n[DONE]  All outputs written to:", OUT_DIR)
    print("        Next step: python scripts/join_datacenter_counts_with_state_footprint.py")


if __name__ == "__main__":
    main()
