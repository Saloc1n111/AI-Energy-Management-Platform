export interface ReadingDTO {
  timestamp: string;
  consumption_kwh: number;
  expected_kwh: number;
  voltage_v: number;
  current_a: number;
  power_factor: number;
  status: string;
}
