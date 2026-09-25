export interface EvidenceDTO {
  metric: string;
  unit?: string;
  baseline: number;
  observed: number;
  deviation_pct: number;
  note?: string;
}

export interface FactorDTO {
  name: string;
  weight: number;
  detail: string;
}

export interface EventDTO {
  type: string;
  timestamp: string;
  description: string;
}

export interface AnomalyDTO {
  id: string;
  run_id: string;
  meter_id: string;
  detected_at: string;
  window_start: string;
  window_end: string;
  anomaly: boolean;
  type: 'REAL_ANOMALY' | 'EXPLAINABLE_ANOMALY' | 'FALSE_POSITIVE' | 'DATA_QUALITY' | string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  confidence: number;
  confidence_label: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  confidence_factors: FactorDTO[];
  priority_score: number;
  requires_attention: boolean;
  signals: string[];
  reason: string;
  recommended_action: string;
  investigation_steps: string[];
  explained_by: string;
  evidence: EvidenceDTO[];
  related_event: EventDTO | null;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | string;
}
