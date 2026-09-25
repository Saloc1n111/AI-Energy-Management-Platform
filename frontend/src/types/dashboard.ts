import { AnomalyDTO } from './anomaly';
import { RunDTO } from './analysis';

export interface DashboardDTO {
  total_meters: number;
  meters_by_status: Record<string, number>;
  total_consumption_kwh: number;
  anomalies_detected: number;
  actionable: number;
  high_priority: number;
  avg_confidence: number;
  by_type: Record<string, number>;
  top_priority: AnomalyDTO[];
  last_analysis: RunDTO | null;
}
