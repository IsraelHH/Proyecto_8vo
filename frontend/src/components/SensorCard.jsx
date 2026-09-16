import React from 'react';

/**
 * SensorCard — Tarjeta minimalista de métrica de sensor.
 *
 * Props:
 *   icon     Component  — Componente de Lucide React
 *   label    string     — Nombre de la métrica
 *   value    number     — Valor actual
 *   unit     string     — Unidad (°C, %, hPa, ppm)
 *   sensor   string     — Nombre del chip (BME280, DHT11, MQ-135)
 *   min      number     — Límite inferior del rango óptimo
 *   max      number     — Límite superior del rango óptimo
 *   decimals number     — Decimales a mostrar
 */
export default function SensorCard({ icon: Icon, label, value, unit, sensor, min, max, decimals = 1 }) {

  const calcularEstado = () => {
    if (value == null || isNaN(value)) return 'sin-datos';
    if (value >= min && value <= max) return 'optimo';
    const margen = (max - min) * 0.2;
    if (value >= min - margen && value <= max + margen) return 'alerta';
    return 'critico';
  };

  const estado = calcularEstado();

  const etiquetas = {
    'optimo':    'Óptimo',
    'alerta':    'Alerta',
    'critico':   'Crítico',
    'sin-datos': 'Sin datos',
  };

  const valorMostrado = value != null && !isNaN(value)
    ? Number(value).toFixed(decimals)
    : '—';

  return (
    <div className={`sensor-card ${estado}`}>
      <div className="card-icon-wrap">
        <Icon size={15} className="card-icon" />
        <span className={`card-estado-dot ${estado}`} />
      </div>

      <span className="card-label">{label}</span>

      <div className="card-value">
        {valorMostrado}
        {value != null && <span className="card-unit">{unit}</span>}
      </div>

      <div className="card-meta">
        <span className="card-sensor-label">{sensor}</span>
        <span className={`card-estado-label ${estado}`}>{etiquetas[estado]}</span>
      </div>
    </div>
  );
}
