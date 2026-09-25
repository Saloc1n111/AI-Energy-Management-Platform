import { DashboardDTO } from '../types/dashboard';
import { MeterDTO, MeterDetailDTO } from '../types/meter';
import { ReadingDTO } from '../types/reading';
import { AnomalyDTO } from '../types/anomaly';
import { RunDTO } from '../types/analysis';

function getBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // In browser, relative /api/v1 routes through Vite proxy seamlessly without CORS issues
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }
  return 'http://127.0.0.1:8080/api/v1';
}

const BASE_URL = getBaseUrl();

async function fetchJSON<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (err: any) {
    // If relative path fails for any reason, fallback to direct port 8080
    if (typeof window !== 'undefined' && BASE_URL === '/api/v1') {
      const host = window.location.hostname || '127.0.0.1';
      const fallbackUrl = `http://${host}:8080/api/v1${endpoint}`;
      try {
        response = await fetch(fallbackUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
      } catch (fallbackErr: any) {
        throw new Error(`No se pudo conectar con el servidor de Bia en :8080. Verifique que el servicio esté activo (${err.message}).`);
      }
    } else {
      throw new Error(`Error de conexión con el backend: ${err.message}`);
    }
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = await response.json();
      // If already running, return the run details instead of throwing
      if (response.status === 409 && errorJson.code === 'ALREADY_RUNNING') {
        return (await api.getAnalysisStatus('latest')) as unknown as T;
      }
      errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson);
    } catch {
      // fallback to statusText
    }
    throw new Error(`API Error [${response.status}] ${endpoint}: ${errorDetail}`);
  }

  return response.json();
}

export const api = {
  // Dashboard
  getDashboardSummary: (): Promise<DashboardDTO> => {
    return fetchJSON<DashboardDTO>('/dashboard/summary');
  },

  // Meters
  getMeters: (params?: {
    status?: string;
    q?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ data: MeterDTO[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.q) query.set('q', params.q);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.order) query.set('order', params.order);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchJSON<{ data: MeterDTO[]; total: number }>(`/meters${qs}`);
  },

  getMeter: (meterId: string): Promise<MeterDetailDTO> => {
    return fetchJSON<MeterDetailDTO>(`/meters/${encodeURIComponent(meterId)}`);
  },

  getMeterReadings: (meterId: string, from?: string, to?: string): Promise<{ data: ReadingDTO[]; total: number }> => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchJSON<{ data: ReadingDTO[]; total: number }>(`/meters/${encodeURIComponent(meterId)}/readings${qs}`);
  },

  // Anomalies
  getAnomalies: (params?: {
    meter_id?: string;
    type?: string;
    severity?: string;
    status?: string;
  }): Promise<{ data: AnomalyDTO[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.meter_id) query.set('meter_id', params.meter_id);
    if (params?.type) query.set('type', params.type);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchJSON<{ data: AnomalyDTO[]; total: number }>(`/anomalies${qs}`);
  },

  getAnomaly: (id: string): Promise<AnomalyDTO> => {
    return fetchJSON<AnomalyDTO>(`/anomalies/${encodeURIComponent(id)}`);
  },

  updateAnomalyStatus: (id: string, status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'): Promise<AnomalyDTO> => {
    return fetchJSON<AnomalyDTO>(`/anomalies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // AI Analysis Pipeline
  triggerAnalysis: async (): Promise<RunDTO> => {
    return fetchJSON<RunDTO>('/ai/analyze', {
      method: 'POST',
      body: '{}',
    });
  },

  getAnalysisStatus: (runId: string = 'latest'): Promise<RunDTO> => {
    return fetchJSON<RunDTO>(`/ai/analysis/${encodeURIComponent(runId)}`);
  },
};
