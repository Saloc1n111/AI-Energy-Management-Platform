export interface StepDTO {
  name: 'READINGS' | 'BASELINE' | 'DETECTION' | 'CORRELATION' | 'EVENTS' | 'EXPLANATION' | 'RECOMMENDATION' | string;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  started_at: string | null;
  finished_at: string | null;
  detail: string;
}

export interface RunSummaryDTO {
  meters_analyzed: number;
  readings_analyzed: number;
  anomalies_detected: number;
  actionable: number;
  high_priority: number;
  avg_confidence: number;
  by_type: Record<string, number>;
  explainer: string;
  llm_explained: number;
  fallback_explained: number;
}

export interface RunDTO {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  progress: number;
  started_at: string;
  finished_at: string | null;
  steps: StepDTO[];
  summary: RunSummaryDTO;
  message?: string;
  error?: string;
}
