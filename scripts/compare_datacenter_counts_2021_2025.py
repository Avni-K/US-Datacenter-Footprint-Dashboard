"""
compare_datacenter_counts_2021_2025.py

Joins OSM 2021 state counts with IM3 2025 state counts, computes growth
metrics, and writes the merged table to public/data/ for the dashboard.

Run from the project root:
    python scripts/compare_datacenter_counts_2021_2025.py

Prerequisites:
    python scripts/download_osm_datacenters_2021.py
    python scripts/download_im3_datacenter_atlas_2025.py
"""

import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("[ERROR] pandas not installed. Run: conda install -c conda-forge pandas")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent

COUNTS_2021 = PROJECT_ROOT / "data" / "osm_datacenters_2021" / "datacenter_state_counts_2021.csv"
COUNTS_2025 = PROJECT_ROOT / "data" / "im3_datacenters_2025" / "im3_datacenter_state_counts_2025.csv"

OUT_PUBLIC = PROJECT_ROOT / "public" / "data" / "datacenter_counts_2021_2025.csv"
OUT_DATA   = PROJECT_ROOT / "data" / "datacenter_counts_2021_2025.csv"


def load_counts(path: Path, count_col: str, year: int) -> pd.DataFrame:
    if not path.exists():
        print(f"[WARN]  {path.name} not found — treating all states as 0 for {year}.")
        return pd.DataFrame(columns=["State", count_col])
    df = pd.read_csv(path)
    # Normalise State column
    df["State"] = df["State"].astype(str).str.strip().str.upper()
    # Ensure count column is numeric
    if count_col in df.columns:
        df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0).astype(int)
    else:
        # Try first numeric column
        num_cols = [c for c in df.columns if c != "State" and pd.api.types.is_numeric_dtype(df[c])]
        if num_cols:
            df = df.rename(columns={num_cols[0]: count_col})
            print(f"[ASSUME] Used column '{num_cols[0]}' as {year} count.")
        else:
            df[count_col] = 0
    return df[["State", count_col] + [c for c in df.columns if c not in ("State", count_col)]]


def main():
    print("=" * 60)
    print("  2021 vs 2025 Data Center Count Comparison")
    print("=" * 60)
    print()

    # Load
    df_2021 = load_counts(COUNTS_2021, "datacenter_count_2021", 2021)
    df_2025 = load_counts(COUNTS_2025, "datacenter_count_2025", 2025)

    print(f"[INFO]  2021 states with labelled DCs: {len(df_2021[df_2021.get('datacenter_count_2021', pd.Series(dtype=int)) > 0] if 'datacenter_count_2021' in df_2021.columns else df_2021)}")
    print(f"[INFO]  2025 states with labelled DCs: {len(df_2025)}")

    # Extract area column from 2025 if present
    area_col = next((c for c in df_2025.columns if "area" in c.lower()), None)

    # Build base 2025 frame
    cols_2025 = ["State", "datacenter_count_2025"]
    if area_col:
        cols_2025.append(area_col)
    df_2025_slim = df_2025[cols_2025].copy()
    if area_col and area_col != "total_facility_area_sqft_2025":
        df_2025_slim = df_2025_slim.rename(columns={area_col: "total_facility_area_sqft_2025"})
    elif area_col is None:
        df_2025_slim["total_facility_area_sqft_2025"] = None

    # Outer join on State
    merged = df_2025_slim.merge(
        df_2021[["State", "datacenter_count_2021"]],
        on="State",
        how="outer",
    )
    merged["datacenter_count_2021"] = merged["datacenter_count_2021"].fillna(0).astype(int)
    merged["datacenter_count_2025"] = merged["datacenter_count_2025"].fillna(0).astype(int)

    # Growth metrics
    merged["datacenter_growth_2021_2025"] = merged["datacenter_count_2025"] - merged["datacenter_count_2021"]

    def growth_pct(row):
        if row["datacenter_count_2021"] == 0:
            return None
        return round(row["datacenter_growth_2021_2025"] / row["datacenter_count_2021"] * 100, 1)

    merged["datacenter_growth_pct_2021_2025"] = merged.apply(growth_pct, axis=1)

    # Ensure column order
    base_cols = [
        "State",
        "datacenter_count_2021",
        "datacenter_count_2025",
        "total_facility_area_sqft_2025",
        "datacenter_growth_2021_2025",
        "datacenter_growth_pct_2021_2025",
    ]
    for c in base_cols:
        if c not in merged.columns:
            merged[c] = None
    merged = merged[base_cols].sort_values("datacenter_count_2025", ascending=False)

    # Save
    OUT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    OUT_DATA.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(OUT_PUBLIC, index=False)
    merged.to_csv(OUT_DATA, index=False)
    print(f"[OK]    {OUT_PUBLIC}")
    print(f"[OK]    {OUT_DATA}")

    # Print top 15 by growth
    top_growth = merged.sort_values("datacenter_growth_2021_2025", ascending=False).head(15)
    print(f"\n{'─'*64}")
    print(f"  {'State':<6} {'2021':>6} {'2025':>6} {'Growth':>8} {'Growth%':>9}")
    print(f"{'─'*64}")
    for _, r in top_growth.iterrows():
        pct = f"{r['datacenter_growth_pct_2021_2025']:.1f}%" \
              if pd.notna(r['datacenter_growth_pct_2021_2025']) else "  n/a "
        print(f"  {r['State']:<6} {int(r['datacenter_count_2021']):>6} "
              f"{int(r['datacenter_count_2025']):>6} "
              f"{int(r['datacenter_growth_2021_2025']):>8} "
              f"{pct:>9}")

    # Totals
    total_2021 = int(merged["datacenter_count_2021"].sum())
    total_2025 = int(merged["datacenter_count_2025"].sum())
    print(f"\n  Total 2021: {total_2021:,}   Total 2025: {total_2025:,}   "
          f"Net growth: {total_2025 - total_2021:,}")
    print()

    if total_2021 == 0:
        print("[NOTE]  2021 counts are 0 for all states. This is expected if the")
        print("        OSM 2021 features lacked 'addr:state' tags. Spatial-join the")
        print("        2021 OSM locations to assign state counts by geometry.")

    print("\n[DONE]  Dashboard CSV ready — reload the dev server to see changes.")


if __name__ == "__main__":
    main()
