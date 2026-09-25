export interface MetricsDTO {
  current_kwh: number;
  baseline_kwh: number;
  variation_pct: number;
  period_kwh: number;
  top_severity: string;
  top_anomaly_type: string;
  analyzed_at: string;
}

export interface MeterDTO {
  meter_id: string;
  name: string;
  location: string;
  status: 'OK' | 'ALERT' | 'CRITICAL' | string;
  created_at: string;
  metrics: MetricsDTO | null;
}

export interface BaselineDTO {
  from: string;
  to: string;
  daily_kwh: number;
  hourly_kwh: number[];
  voltage_v: number;
  power_factor: number;
  consumption_ratio: number;
}

export interface MeterDetailDTO extends MeterDTO {
  baseline: BaselineDTO | null;
}
