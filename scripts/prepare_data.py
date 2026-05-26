from pathlib import Path
import pandas as pd

BASE = Path("public/data/SI_XLS")
OUT = Path("public/data")
OUT.mkdir(parents=True, exist_ok=True)

input_xlsx = BASE / "Input data.xlsx"
results_xlsx = BASE / "Results.xlsx"

def minmax(series):
    series = pd.to_numeric(series, errors="coerce")
    mn = series.min()
    mx = series.max()
    if pd.isna(mn) or pd.isna(mx) or mx == mn:
        return series * 0
    return (series - mn) / (mx - mn)

# -----------------------------
# State-level energy/water/carbon
# -----------------------------
state = pd.read_excel(input_xlsx, sheet_name="Table 6", header=2)
state = state.rename(columns={
    "Water intensity (m3/MWh)": "Water_intensity_m3_per_MWh",
    "Emission intensity (m3/MWh)": "Carbon_intensity_tonsCO2e_per_MWh",
    "Scaled Power Consumption (MWh)": "Scaled_power_consumption_MWh",
})
state = state.dropna(subset=["State"])
state["Water_footprint_m3"] = state["Water_intensity_m3_per_MWh"] * state["Scaled_power_consumption_MWh"]
state["Carbon_footprint_tonsCO2e"] = state["Carbon_intensity_tonsCO2e_per_MWh"] * state["Scaled_power_consumption_MWh"]
state.to_csv(OUT / "state_energy_water_carbon.csv", index=False)

# -----------------------------
# HUC8 environmental footprints
# -----------------------------
raw = pd.read_excel(results_xlsx, sheet_name="Table 1", header=None)
huc8 = raw.iloc[3:].copy()
huc8.columns = [
    "HUC8",
    "WF_PCA_m3", "WF_PCA_NT_m3", "WF_HUC4_m3", "WF_Interconnection_m3", "WF_eGRID_m3", "WF_State_m3",
    "CF_PCA_tonsCO2e", "CF_PCA_NT_tonsCO2e", "CF_HUC4_tonsCO2e", "CF_Interconnection_tonsCO2e", "CF_eGRID_tonsCO2e", "CF_State_tonsCO2e",
    "WSF_PCA_m3eq", "WSF_PCA_NT_m3eq", "WSF_HUC4_m3eq", "WSF_Interconnection_m3eq", "WSF_eGRID_m3eq", "WSF_State_m3eq",
    "WF_Coefficient_of_Variation",
    "CF_Coefficient_of_Variation",
    "Characterization_Factor",
    "Region",
]
for col in huc8.columns:
    if col != "Region":
        huc8[col] = pd.to_numeric(huc8[col], errors="coerce")
huc8 = huc8.dropna(subset=["HUC8"])
huc8["HUC8"] = huc8["HUC8"].astype(int).astype(str).str.zfill(8)
huc8.to_csv(OUT / "huc8_environmental_footprints.csv", index=False)

# -----------------------------
# 1 MW siting tool data
# -----------------------------
siting = pd.read_excel(results_xlsx, sheet_name="Table 3", header=1)
siting["HUC8"] = pd.to_numeric(siting["HUC8"], errors="coerce")
siting = siting.dropna(subset=["HUC8"])
siting["HUC8"] = siting["HUC8"].astype(int).astype(str).str.zfill(8)

for col in ["WSF_1MW_DC", "WF_1MW_DC", "CF_1MW_DC"]:
    siting[col] = pd.to_numeric(siting[col], errors="coerce")

siting["WF_norm"] = minmax(siting["WF_1MW_DC"])
siting["CF_norm"] = minmax(siting["CF_1MW_DC"])
siting["WSF_norm"] = minmax(siting["WSF_1MW_DC"])
siting["Risk_score_equal_weights"] = (
    siting["WF_norm"] + siting["CF_norm"] + siting["WSF_norm"]
) / 3

siting = siting.sort_values("Risk_score_equal_weights", ascending=False)
siting_out = siting[["HUC8","WSF_1MW_DC","WF_1MW_DC","CF_1MW_DC","WF_norm","CF_norm","WSF_norm","Risk_score_equal_weights"]]
siting_out.to_csv(OUT / "huc8_1mw_siting_with_risk.csv", index=False)

for label, df in [
    ("state_energy_water_carbon.csv", state),
    ("huc8_environmental_footprints.csv", huc8),
    ("huc8_1mw_siting_with_risk.csv", siting[["HUC8","WSF_1MW_DC","WF_1MW_DC","CF_1MW_DC","WF_norm","CF_norm","WSF_norm","Risk_score_equal_weights"]]),
]:
    print(f"\n=== public/data/{label} ===")
    print(f"Shape: {df.shape}")
    print("Columns:", df.columns.tolist())
    print(df.head(5).to_string())
