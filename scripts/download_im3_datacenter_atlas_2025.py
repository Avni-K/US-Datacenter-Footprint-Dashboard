"""
download_im3_datacenter_atlas_2025.py

Downloads (or guides manual download of) the IM3 Open Source Data Center Atlas 2025,
then preprocesses it into standardised CSV and GeoJSON outputs.

Run from the project root:
    python scripts/download_im3_datacenter_atlas_2025.py

Dataset:
    IM3 Open Source Data Center Atlas, 2025
    https://www.osti.gov/biblio/2550666
    https://github.com/IMMM-SFA/datacenter-atlas

Required Python packages:
    pandas, geopandas, shapely, pyogrio, requests
    (install via: conda install -c conda-forge pandas geopandas shapely pyogrio requests)
"""

import json
import sys
import zipfile
from pathlib import Path

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    import pandas as pd
    import geopandas as gpd
    from shapely.geometry import Point
    HAS_GEO = True
except ImportError:
    HAS_GEO = False

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR  = PROJECT_ROOT / "data" / "im3_datacenters_2025" / "raw"
OUT_DIR  = PROJECT_ROOT / "data" / "im3_datacenters_2025"
PUB_DIR  = PROJECT_ROOT / "public" / "data"

OUT_CSV     = OUT_DIR / "im3_datacenters_2025_locations.csv"
OUT_GEOJSON = OUT_DIR / "im3_datacenters_2025_locations.geojson"
OUT_COUNTS  = OUT_DIR / "im3_datacenter_state_counts_2025.csv"

# ---------------------------------------------------------------------------
# State name -> abbreviation lookup
# ---------------------------------------------------------------------------
STATE_ABBR = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI",
    "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
    "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
    "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
    "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
    "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
}
VALID_ABBRS = set(STATE_ABBR.values())


def normalise_state(val: str) -> str:
    """Return 2-letter abbreviation from full name or existing abbreviation."""
    if not isinstance(val, str):
        return ""
    v = val.strip()
    if v.upper() in VALID_ABBRS:
        return v.upper()
    return STATE_ABBR.get(v.lower(), v.upper()[:2] if len(v) >= 2 else "")


# ---------------------------------------------------------------------------
# Auto-download helpers
# ---------------------------------------------------------------------------

GITHUB_API = "https://api.github.com/repos/IMMM-SFA/datacenter-atlas"

# Known candidate file URLs in the GitHub repo (checked as of Atlas publication).
CANDIDATE_URLS = [
    # GitHub repo data folder
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/data/datacenter_atlas_2025.csv",
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/data/datacenter_atlas_2025.geojson",
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/data/us_datacenters_2025.csv",
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/data/us_datacenters_2025.geojson",
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/data/datacenters.csv",
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/data/datacenters.geojson",
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/datacenter_atlas.csv",
    "https://raw.githubusercontent.com/IMMM-SFA/datacenter-atlas/main/datacenter_atlas.geojson",
]


def try_download_candidate(url: str, dest: Path) -> bool:
    """Try to download a single URL; return True on success."""
    if not HAS_REQUESTS:
        return False
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200 and len(r.content) > 1000:
            dest.write_bytes(r.content)
            print(f"[OK]    Downloaded {url.split('/')[-1]} -> {dest}")
            return True
    except Exception:
        pass
    return False


def try_github_releases() -> list[Path]:
    """Check GitHub releases for downloadable data assets."""
    if not HAS_REQUESTS:
        return []
    downloaded = []
    try:
        r = requests.get(f"{GITHUB_API}/releases", timeout=20)
        if r.status_code != 200:
            return []
        for release in r.json()[:3]:
            for asset in release.get("assets", []):
                name = asset.get("name", "")
                url  = asset.get("browser_download_url", "")
                if any(name.lower().endswith(ext) for ext in (".csv", ".geojson", ".json", ".zip", ".gpkg")):
                    dest = RAW_DIR / name
                    if dest.exists():
                        print(f"[SKIP]  {name} already exists")
                        downloaded.append(dest)
                        continue
                    print(f"[INFO]  Trying GitHub release asset: {name} …")
                    if try_download_candidate(url, dest):
                        downloaded.append(dest)
    except Exception as e:
        print(f"[WARN]  GitHub release check failed: {e}")
    return downloaded


def try_candidate_urls() -> list[Path]:
    """Try known candidate raw-file URLs."""
    downloaded = []
    for url in CANDIDATE_URLS:
        filename = url.split("/")[-1]
        dest = RAW_DIR / filename
        if dest.exists():
            print(f"[SKIP]  {filename} already exists")
            downloaded.append(dest)
            continue
        print(f"[INFO]  Trying {url} …", end=" ", flush=True)
        if try_download_candidate(url, dest):
            downloaded.append(dest)
        else:
            print("not found")
    return downloaded


def print_manual_instructions():
    print()
    print("=" * 60)
    print("  MANUAL DOWNLOAD REQUIRED")
    print("=" * 60)
    print()
    print("  Please manually download the IM3 Open Source Data Center")
    print("  Atlas from:")
    print()
    print("    https://www.osti.gov/biblio/2550666")
    print("    OR")
    print("    https://github.com/IMMM-SFA/datacenter-atlas")
    print("    OR")
    print("    https://immm-sfa.github.io/datacenter-atlas/")
    print()
    print("  Then place the extracted file(s) inside:")
    print(f"    {RAW_DIR}")
    print()
    print("  Supported formats: .csv  .geojson  .json  .shp  .gpkg")
    print()
    print("  Re-run this script after placing the files.")
    print("=" * 60)
    print()


def unzip_raw():
    """Unzip any .zip files found in RAW_DIR."""
    for zf in RAW_DIR.glob("*.zip"):
        print(f"[INFO]  Unzipping {zf.name} …")
        with zipfile.ZipFile(zf) as z:
            z.extractall(RAW_DIR)
        print(f"[OK]    Extracted {zf.name}")


# ---------------------------------------------------------------------------
# Column detection
# ---------------------------------------------------------------------------

def _find_col(columns: list[str], patterns: list[str]) -> str | None:
    cols_lower = {c.lower(): c for c in columns}
    for pat in patterns:
        if pat in cols_lower:
            return cols_lower[pat]
    # Partial match
    for pat in patterns:
        for low, orig in cols_lower.items():
            if pat in low:
                return orig
    return None


def detect_columns(columns: "list[str]") -> dict[str, str | None]:
    cols = list(columns)
    mapping = {
        "id":       _find_col(cols, ["osm_id", "id", "fid", "objectid", "gid", "uid"]),
        "name":     _find_col(cols, ["name", "facility_name", "dc_name", "datacenter_name"]),
        # prefer state_abb (abbreviation) over full state name column
        "state":    _find_col(cols, ["state_abb", "state_abbr", "state_code", "addr:state", "state", "state_name", "st"]),
        "county":   _find_col(cols, ["county", "county_name", "addr:county"]),
        "area":     _find_col(cols, ["sqft", "facility_area_sqft", "area_sqft", "area_sq_ft",
                                     "floor_area", "building_area", "sq_ft",
                                     "facility_area", "area_sqm", "area_m2", "area"]),
        "lat":      _find_col(cols, ["lat", "latitude", "y", "lat_dd", "centroid_lat"]),
        "lon":      _find_col(cols, ["lon", "lng", "longitude", "x", "lon_dd", "centroid_lon"]),
        "geometry": _find_col(cols, ["geometry", "geom", "wkt", "shape"]),
    }
    return mapping


# ---------------------------------------------------------------------------
# Load usable files
# ---------------------------------------------------------------------------

SPATIAL_EXTENSIONS = {".geojson", ".json", ".shp", ".gpkg"}
TABULAR_EXTENSIONS = {".csv", ".tsv", ".txt"}


def load_raw_files() -> list[tuple[str, "pd.DataFrame | gpd.GeoDataFrame"]]:
    """Load all usable files from RAW_DIR. Returns list of (filename, dataframe)."""
    if not HAS_GEO:
        print("[ERROR] geopandas/pandas not installed. Run:")
        print("        conda install -c conda-forge pandas geopandas shapely pyogrio")
        sys.exit(1)

    results = []

    all_files = sorted(RAW_DIR.iterdir()) if RAW_DIR.exists() else []
    usable = [f for f in all_files if f.suffix.lower() in SPATIAL_EXTENSIONS | TABULAR_EXTENSIONS]

    if not usable:
        return results

    for fp in usable:
        ext = fp.suffix.lower()
        print(f"[INFO]  Loading {fp.name} …")
        try:
            if ext in SPATIAL_EXTENSIONS:
                # For GPKG with multiple layers, read each layer separately
                if ext == ".gpkg":
                    from pyogrio import list_layers
                    layers = [row[0] for row in list_layers(fp)]
                    print(f"        Layers: {layers}")
                    for layer in layers:
                        gdf = gpd.read_file(fp, layer=layer, engine="pyogrio")
                        label = f"{fp.name}::{layer}"
                        print(f"        [{layer}] {len(gdf):,} features, columns: {list(gdf.columns)}")
                        results.append((label, gdf))
                else:
                    gdf = gpd.read_file(fp, engine="pyogrio")
                    print(f"        {len(gdf):,} features, columns: {list(gdf.columns)}")
                    results.append((fp.name, gdf))
            elif ext == ".csv":
                df = pd.read_csv(fp, low_memory=False)
                print(f"        {len(df):,} rows, columns: {list(df.columns)}")
                results.append((fp.name, df))
            elif ext in {".tsv", ".txt"}:
                df = pd.read_csv(fp, sep="\t", low_memory=False)
                print(f"        {len(df):,} rows, columns: {list(df.columns)}")
                results.append((fp.name, df))
        except Exception as e:
            print(f"[WARN]  Could not load {fp.name}: {e}")

    return results


# ---------------------------------------------------------------------------
# Standardise a single dataframe
# ---------------------------------------------------------------------------

def standardise(filename: str, df: "pd.DataFrame") -> "gpd.GeoDataFrame":
    mapping = detect_columns(list(df.columns) if hasattr(df, 'columns') else df)

    assumptions = []
    if mapping["state"] is None:
        assumptions.append("No 'state' column found — state will be empty.")
    if mapping["area"] is None:
        assumptions.append("No facility area column found — facility_area_sqft will be null.")
    if mapping["name"] is None:
        assumptions.append("No name column found — name will be empty.")

    for note in assumptions:
        print(f"[ASSUME] {note}")

    # Build standardised rows
    rows = []
    has_geometry = hasattr(df, "geometry") and mapping.get("geometry") is not None

    for i, row in df.iterrows():
        # id
        rec_id = str(row[mapping["id"]]) if mapping["id"] else str(i)
        # name
        name = str(row[mapping["name"]]).strip() if mapping["name"] and pd.notna(row[mapping["name"]]) else ""
        # state
        raw_state = str(row[mapping["state"]]).strip() if mapping["state"] and pd.notna(row[mapping["state"]]) else ""
        state = normalise_state(raw_state)
        # county
        county = str(row[mapping["county"]]).strip() if mapping["county"] and pd.notna(row[mapping["county"]]) else ""
        # area
        area = None
        if mapping["area"]:
            v = row[mapping["area"]]
            try:
                area = float(v)
                if pd.isna(area):
                    area = None
            except (ValueError, TypeError):
                area = None

        # lat/lon
        lat, lon = None, None
        if mapping["lat"] and mapping["lon"]:
            try:
                lat = float(row[mapping["lat"]])
                lon = float(row[mapping["lon"]])
                if pd.isna(lat) or pd.isna(lon):
                    lat = lon = None
            except (ValueError, TypeError):
                lat = lon = None

        # geometry
        geom = None
        if has_geometry:
            geom = row.geometry if hasattr(row, "geometry") else None

        # derive lat/lon from geometry
        if (lat is None or lon is None) and geom is not None and not (hasattr(geom, "is_empty") and geom.is_empty):
            try:
                pt = geom.representative_point()
                lon, lat = pt.x, pt.y
            except Exception:
                try:
                    pt = geom.centroid
                    lon, lat = pt.x, pt.y
                except Exception:
                    pass

        # build geometry from lat/lon if none present
        if geom is None and lat is not None and lon is not None:
            geom = Point(lon, lat)

        rows.append({
            "id": rec_id,
            "name": name,
            "state": state,
            "county": county,
            "facility_area_sqft": area,
            "lat": lat,
            "lon": lon,
            "geometry": geom,
            "source_layer": filename.rsplit(".", 1)[0],
            "source_file": filename,
        })

    gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")
    return gdf


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  IM3 Open Source Data Center Atlas 2025 — Downloader")
    print("=" * 60)
    print()

    # Create directories
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PUB_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: auto-download
    existing_raw = [f for f in RAW_DIR.iterdir() if f.suffix.lower() in
                    {".csv", ".geojson", ".json", ".shp", ".gpkg", ".zip"}] if RAW_DIR.exists() else []

    if not existing_raw:
        print("[INFO]  No raw files found. Attempting auto-download …\n")
        downloaded = try_github_releases()
        if not downloaded:
            downloaded = try_candidate_urls()
        unzip_raw()

        still_empty = not any(RAW_DIR.iterdir()) if RAW_DIR.exists() else True
        if still_empty:
            print_manual_instructions()
            sys.exit(0)
    else:
        print(f"[INFO]  Found {len(existing_raw)} raw file(s) in {RAW_DIR}")
        unzip_raw()

    # Step 2: load files
    print("\n[INFO]  Loading raw files …")
    loaded = load_raw_files()
    if not loaded:
        print("[ERROR] No usable files found in raw/. See manual instructions above.")
        print_manual_instructions()
        sys.exit(1)

    # Step 3: standardise and combine
    print("\n[INFO]  Standardising columns …")
    all_gdfs = []
    for fname, df in loaded:
        gdf = standardise(fname, df)
        all_gdfs.append(gdf)
        print(f"[OK]    {fname}: {len(gdf):,} records standardised")

    import pandas as pd
    combined = gpd.GeoDataFrame(
        pd.concat(all_gdfs, ignore_index=True),
        geometry="geometry", crs="EPSG:4326",
    )
    # Keep only rows with valid lat/lon
    valid = combined[combined["lat"].notna() & combined["lon"].notna()].copy()
    print(f"\n[INFO]  Combined: {len(combined):,} total, {len(valid):,} with valid coordinates")

    # Step 4: save CSV (drop geometry for plain CSV)
    csv_df = valid.drop(columns=["geometry"])
    csv_df.to_csv(OUT_CSV, index=False)
    print(f"[OK]    CSV -> {OUT_CSV}")

    # Step 5: save GeoJSON
    valid_geo = valid[valid.geometry.notna() & ~valid.geometry.is_empty].copy()
    if len(valid_geo) > 0:
        valid_geo.to_file(OUT_GEOJSON, driver="GeoJSON", engine="pyogrio")
        print(f"[OK]    GeoJSON -> {OUT_GEOJSON}")
    else:
        print("[WARN]  No valid geometries — GeoJSON not written.")

    # Step 6: state counts
    counts = (
        valid[valid["state"].str.len() == 2]
        .groupby("state")
        .agg(
            datacenter_count_2025=("id", "count"),
            total_facility_area_sqft_2025=("facility_area_sqft", "sum"),
        )
        .reset_index()
        .rename(columns={"state": "State"})
        .sort_values("datacenter_count_2025", ascending=False)
    )
    # Replace 0 area sum with NaN if area was missing
    if valid["facility_area_sqft"].isna().all():
        counts["total_facility_area_sqft_2025"] = None

    counts.to_csv(OUT_COUNTS, index=False)
    print(f"[OK]    State counts -> {OUT_COUNTS}")

    # Step 7: copy to public/data for the dashboard
    import shutil
    shutil.copy(OUT_CSV, PUB_DIR / "im3_datacenters_2025_locations.csv")
    print(f"[OK]    Copied CSV -> {PUB_DIR / 'im3_datacenters_2025_locations.csv'}")

    # Summary
    print(f"\n{'-'*60}")
    print("  Top 15 states by data center count (2025):")
    print(f"{'-'*60}")
    for _, r in counts.head(15).iterrows():
        area_str = f"  area={r['total_facility_area_sqft_2025']:,.0f} sqft" \
                   if pd.notna(r['total_facility_area_sqft_2025']) else ""
        print(f"  {r['State']:4s}  {int(r['datacenter_count_2025']):4d}{area_str}")

    print(f"\n[DONE]  Next step:")
    print("        python scripts/compare_datacenter_counts_2021_2025.py")


if __name__ == "__main__":
    main()
