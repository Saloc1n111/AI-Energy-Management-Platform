import { describe, it, expect } from 'vitest';
import { sanitizeMeterId, getMeterDisplayName, METER_DISPLAY_NAMES } from '../lib/utils';

describe('Sanitization and Meter Display Names', () => {
  it('correctly filters out production-summary and falls back to M-109', () => {
    expect(sanitizeMeterId('production-summary')).toBe('M-109');
    expect(sanitizeMeterId('PRODUCTION-SUMMARY')).toBe('M-109');
    expect(sanitizeMeterId('some-production-summary-route')).toBe('M-109');
    expect(sanitizeMeterId('')).toBe('M-109');
    expect(sanitizeMeterId(undefined)).toBe('M-109');
    expect(sanitizeMeterId(null)).toBe('M-109');
    expect(sanitizeMeterId('M-104')).toBe('M-104');
  });

  it('provides proper industrial display names for all 12 meters', () => {
    expect(getMeterDisplayName('M-101')).toBe('Compresores y Neumática · Nave 1');
    expect(getMeterDisplayName('M-102')).toBe('Iluminación y Servicios Auxiliares');
    expect(getMeterDisplayName('M-103')).toBe('Hornos de Tratamiento Térmico · Zona 2');
    expect(getMeterDisplayName('M-104')).toBe('Línea de Producción · Envasado');
    expect(getMeterDisplayName('M-105')).toBe('Climatización y Chiller · Planta Central');
    expect(getMeterDisplayName('M-106')).toBe('Caldera Principal · Circuito Térmico');
    expect(getMeterDisplayName('M-107')).toBe('Bombas de Refrigeración · Circuito Secundario');
    expect(getMeterDisplayName('M-108')).toBe('Línea de Moldeo y Troquelado');
    expect(getMeterDisplayName('M-109')).toBe('Subestación Principal · Transformador 1');
    expect(getMeterDisplayName('M-110')).toBe('Taller de Mantenimiento y Cargas Generales');
    expect(getMeterDisplayName('M-111')).toBe('Almacén Automatizado y Logística');
    expect(getMeterDisplayName('M-112')).toBe('Inyección y Moldeo · Sensor de Telemetría');
  });

  it('rejects production-summary even when passed as customName', () => {
    expect(getMeterDisplayName('M-109', 'production-summary')).toBe('Subestación Principal · Transformador 1');
    expect(getMeterDisplayName('production-summary', 'production-summary')).toBe('Subestación Principal · Transformador 1');
  });

  it('strips redundant generic "Medidor M-xxx" strings in favor of area names', () => {
    expect(getMeterDisplayName('M-104', 'Medidor M-104')).toBe('Línea de Producción · Envasado');
    expect(getMeterDisplayName('M-109', 'Medidor M-109')).toBe('Subestación Principal · Transformador 1');
  });
});
