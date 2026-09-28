import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const METER_DISPLAY_NAMES: Record<string, string> = {
  'M-101': 'Compresores y Neumática · Nave 1',
  'M-102': 'Iluminación y Servicios Auxiliares',
  'M-103': 'Hornos de Tratamiento Térmico · Zona 2',
  'M-104': 'Línea de Producción · Envasado',
  'M-105': 'Climatización y Chiller · Planta Central',
  'M-106': 'Caldera Principal · Circuito Térmico',
  'M-107': 'Bombas de Refrigeración · Circuito Secundario',
  'M-108': 'Línea de Moldeo y Troquelado',
  'M-109': 'Subestación Principal · Transformador 1',
  'M-110': 'Taller de Mantenimiento y Cargas Generales',
  'M-111': 'Almacén Automatizado y Logística',
  'M-112': 'Inyección y Moldeo · Sensor de Telemetría',
};

export function sanitizeMeterId(id?: string | null, fallback = 'M-109'): string {
  if (!id) return fallback;
  const clean = id.trim();
  if (clean === 'production-summary' || clean.toLowerCase().includes('production-summary')) {
    return fallback;
  }
  return clean;
}

export function getMeterDisplayName(meterId: string, customName?: string | null): string {
  const sanitizedId = sanitizeMeterId(meterId);
  if (
    customName &&
    customName !== 'production-summary' &&
    !customName.toLowerCase().includes('production-summary') &&
    !customName.startsWith('Medidor')
  ) {
    return customName;
  }
  return METER_DISPLAY_NAMES[sanitizedId] || `Punto de Telemetría ${sanitizedId}`;
}
