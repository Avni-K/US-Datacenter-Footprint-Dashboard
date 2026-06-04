"""
join_datacenter_counts_with_state_footprint.py

Joins OSM-derived data-center counts (by state) with the existing
state-level energy/water/carbon footprint data, then computes
per-datacenter normalized metrics.

Run from the project root:
    python scripts/join_datacenter_counts_with_state_footprint.py
"""

import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("[ERROR] pandas is not installed.")
    print("        Install with: mamba install -c conda-forge pandas")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent

STATE_COUNTS_CSV = PROJECT_ROOT / "data" / "osm_datacenters_2021" / "datacenter_state_counts_2021.csv"
OUT_CSV = PROJECT_ROOT / "data" / "osm_datacenters_2021" / "state_energy_with_datacenter_counts_2021.csv"

# Prefer public/data location; fall back to data/ at project root
_FOOTPRINT_CANDIDATES = [
    PROJECT_ROOT / "public" / "data" / "state_energy_water_carbon.csv",
    PROJECT_ROOT / "data" / "state_energy_water_carbon.csv",
]


def find_footprint_csv() -> Path:
    for path in _FOOTPRINT_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError(
        "Could not find state_energy_water_carbon.csv in "
        + " or ".join(str(p) for p in _FOOTPRINT_CANDIDATES)
    )


def safe_divide(numerator: "pd.Series", denominator: "pd.Series") -> "pd.Series":
    """Element-wise division; returns NaN where denominator is 0 or NaN."""
    return numerator.where(
        denominator.notna() & (denominator != 0), other=float("nan")
    ) / denominator.where(denominator != 0, other=float("nan"))


def main():
    print("=" * 60)
    print("  Join State Footprint + Data-Center Counts")
    print("=" * 60)

    # Load state counts
    if not STATE_COUNTS_CSV.exists():
        print(f"[ERROR] State counts file not found: {STATE_COUNTS_CSV}")
        print("        Run download_osm_datacenters_2021.py first.")
        sys.exit(1)

    counts_df = pd.read_csv(STATE_COUNTS_CSV)
    print(f"[INFO]  Loaded {len(counts_df)} rows from state counts CSV")

    # Load footprint data
    try:
        footprint_path = find_footprint_csv()
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)

    footprint_df = pd.read_csv(footprint_path)
    print(f"[INFO]  Loaded {len(footprint_df)} rows from {footprint_path.name}")

    # Normalise State column (strip whitespace, uppercase)
    counts_df["State"] = counts_df["State"].str.strip().str.upper()
    footprint_df["State"] = footprint_df["State"].str.strip().str.upper()

    # Left-join so all states from the footprint table are preserved
    merged = footprint_df.merge(counts_df, on="State", how="left")

    # Convert count to numeric; 0 count treated as NaN for division
    merged["datacenter_count_2021"] = pd.to_numeric(
        merged["datacenter_count_2021"], errors="coerce"
    )
    missing_count = merged["datacenter_count_2021"].isna().sum()
    if missing_count:
        print(
            f"[WARN]  {missing_count} state(s) have no OSM data-center count "
            "(per-datacenter metrics will be NaN for those rows)."
        )

    # Per-datacenter normalised metrics
    merged["energy_per_datacenter"] = safe_divide(
        merged["Scaled_power_consumption_MWh"], merged["datacenter_count_2021"]
    )
    merged["water_per_datacenter"] = safe_divide(
        merged["Water_footprint_m3"], merged["datacenter_count_2021"]
    )
    merged["carbon_per_datacenter"] = safe_divide(
        merged["Carbon_footprint_tonsCO2e"], merged["datacenter_count_2021"]
    )

    # Save
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(OUT_CSV, index=False)
    print(f"[OK]    Output saved to {OUT_CSV}")
    print(f"        Columns: {list(merged.columns)}")

    # Quick preview
    preview_cols = [
        "State", "datacenter_count_2021",
        "energy_per_datacenter", "water_per_datacenter", "carbon_per_datacenter",
    ]
    print("\n--- Preview (first 5 rows) ---")
    print(merged[preview_cols].head().to_string(index=False))


if __name__ == "__main__":
    main()
