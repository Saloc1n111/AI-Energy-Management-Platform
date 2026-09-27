export type ContextType =
  | 'meter'
  | 'kpi'
  | 'anomaly'
  | 'distribution'
  | 'timeline'
  | 'general';

export interface ActionDTO {
  id: string;
  label: string;
  action_type: string;
  payload?: string;
  description?: string;
}

export interface AskAIRequest {
  context_type: ContextType;
  context_id: string;
  question: string;
  context_data?: Record<string, any>;
}

export interface AskAIResponse {
  answer: string;
  key_takeaways?: string[];
  suggested_actions?: ActionDTO[];
  follow_up_questions?: string[];
  source?: string;
  context_id?: string;
}

export interface TechnicalVisitRequest {
  meter_id: string;
  urgency: string; // 'IMMEDIATE' | 'PRIORITY' | 'SCHEDULED'
  reason: string;
  contact_name: string;
  contact_phone: string;
  notes?: string;
}

export interface TechnicalVisitResponse {
  id: string;
  meter_id: string;
  urgency: string;
  reason: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
  status: string;
  created_at: string;
}
