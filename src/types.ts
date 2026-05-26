export interface SitingRow {
  HUC8: string;
  WSF_1MW_DC: number;
  WF_1MW_DC: number;
  CF_1MW_DC: number;
  WF_norm: number;
  CF_norm: number;
  WSF_norm: number;
  Risk_score_equal_weights: number;
}

export interface StateRow {
  State: string;
  Water_intensity_m3_per_MWh: number;
  Carbon_intensity_tonsCO2e_per_MWh: number;
  Scaled_power_consumption_MWh: number;
  Water_footprint_m3: number;
  Carbon_footprint_tonsCO2e: number;
}

export type MetricKey =
  | 'Scaled_power_consumption_MWh'
  | 'Water_footprint_m3'
  | 'Carbon_footprint_tonsCO2e';

export interface MetricOption {
  key: MetricKey;
  label: string;
  unit: string;
}

export interface Huc8Row {
  HUC8: string;
  WF_PCA_m3: number;
  CF_PCA_tonsCO2e: number;
  WSF_PCA_m3eq: number;
  Region: string;
  Characterization_Factor: number;
}

export type Huc8MetricKey = 'WSF_PCA_m3eq' | 'WF_PCA_m3' | 'CF_PCA_tonsCO2e';

export interface Huc8MetricOption {
  key: Huc8MetricKey;
  label: string;
  unit: string;
}
