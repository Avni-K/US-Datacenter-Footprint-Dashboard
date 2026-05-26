#!/usr/bin/env python3
"""
Download HUC8 watershed boundaries from the USGS National Map WBD service.

Output: public/data/huc8_boundaries.geojson
        GeoJSON FeatureCollection; each feature has a `huc8` property (8-digit code).

Usage:
    python3 scripts/download_huc8_boundaries.py

Requirements: Python 3.6+, stdlib only (no extra packages).
Estimated runtime: 2–5 minutes depending on connection speed.
Estimated output size: 20–80 MB (simplified geometry, WGS84).
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# ── USGS WBD ArcGIS MapServer ──────────────────────────────────────────────
SERVICE_BASE = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer"
OUT_FILE = Path(__file__).parent.parent / "public" / "data" / "huc8_boundaries.geojson"

# Simplification tolerance in decimal degrees (~1 km at mid-latitudes).
# Increase to 0.05 for a smaller file; decrease to 0.001 for higher fidelity.
MAX_OFFSET = "0.01"

BATCH = 1000  # max features per request (ArcGIS default cap)


def discover_huc8_layer() -> int:
    """Return the layer index whose name contains 'HUC8' or 'WBDHU8'."""
    url = f"{SERVICE_BASE}?f=json"
    print("Querying service metadata…")
    with urllib.request.urlopen(url, timeout=30) as resp:
        meta = json.loads(resp.read().decode())
    for layer in meta.get("layers", []):
        name = layer.get("name", "")
        if "HUC8" in name.upper() or "WBDHU8" in name.upper() or "8-DIGIT HU" in name.upper():
            print(f"  Found HUC8 layer: [{layer['id']}] {name}")
            return int(layer["id"])
    # Fallback to index 3 which is commonly the HUC8 layer in USGS WBD
    print("  WARNING: Could not auto-detect HUC8 layer; falling back to index 4.")
    return 4


def query_page(layer_id: int, offset: int) -> list:
    params = {
        "where": "1=1",
        "outFields": "huc8,name,states,areasqkm",
        "outSR": "4326",
        "geometryType": "esriGeometryPolygon",
        "maxAllowableOffset": MAX_OFFSET,
        "f": "geojson",
        "resultOffset": offset,
        "resultRecordCount": BATCH,
    }
    url = f"{SERVICE_BASE}/{layer_id}/query?" + urllib.parse.urlencode(params)
    print(f"  offset={offset:5d}…", end=" ", flush=True)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=120) as resp:
                data = json.loads(resp.read().decode())
            features = data.get("features", [])
            print(f"{len(features)} features")
            return features
        except urllib.error.URLError as exc:
            if attempt < 2:
                print(f"retrying ({exc})…", end=" ", flush=True)
                time.sleep(3)
            else:
                print(f"FAILED: {exc}", file=sys.stderr)
                raise
    return []


def main() -> None:
    print("=" * 60)
    print("HUC8 Boundary Downloader — USGS National Map WBD")
    print("=" * 60)

    layer_id = discover_huc8_layer()

    print(f"\nDownloading HUC8 features (layer {layer_id})…")
    all_features: list = []
    offset = 0
    while True:
        batch = query_page(layer_id, offset)
        all_features.extend(batch)
        if len(batch) < BATCH:
            break
        offset += BATCH

    print(f"\nTotal features downloaded: {len(all_features)}")
    if len(all_features) == 0:
        print("ERROR: No features returned. Check service URL or layer index.", file=sys.stderr)
        sys.exit(1)

    geojson = {"type": "FeatureCollection", "features": all_features}

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    print(f"Writing {OUT_FILE} …")
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(geojson, fh, separators=(",", ":"))

    size_mb = OUT_FILE.stat().st_size / 1024 / 1024
    print(f"Done. File size: {size_mb:.1f} MB  ({len(all_features)} features)")
    print()
    print("Tip: for a smaller file, run mapshaper to further simplify:")
    print("  npx mapshaper public/data/huc8_boundaries.geojson \\")
    print("    -simplify 10% keep-shapes \\")
    print("    -o public/data/huc8_boundaries.geojson format=geojson")


if __name__ == "__main__":
    main()
