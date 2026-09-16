import React from 'react';

/**
 * AirQualityGauge — Indicador de calidad del aire basado en PPM de CO₂.
 * Diseño completamente monocromático, sin emojis.
 *
 * Rangos CO₂:
 *   400–800   ppm → Excelente
 *   800–1200  ppm → Bueno
 *   1200–1500 ppm → Moderado
 *   1500–2000 ppm → Alto
 *   > 2000    ppm → Crítico
 *
 * Props:
 *   adcValue  number  — Valor ADC crudo del MQ-135 (0–4095)
 *   ppm       number  — PPM estimadas de CO₂
 */
export default function AirQualityGauge({ adcValue, ppm }) {
  const PPM_MIN = 400;
  const PPM_MAX = 2500;

  const ppmActual   = ppm ?? PPM_MIN;
  const porcentaje  = Math.min(100, Math.max(0,
    ((ppmActual - PPM_MIN) / (PPM_MAX - PPM_MIN)) * 100
  ));

  const calcularCalidad = () => {
    if (ppm == null) return 'Sin datos';
    if (ppm < 800)   return 'Excelente';
    if (ppm < 1200)  return 'Bueno';
    if (ppm < 1500)  return 'Moderado';
    if (ppm < 2000)  return 'Alto';
    return 'Crítico';
  };

  const calidad = calcularCalidad();

  return (
    <div className="gauge-container">
      {/* Barra de progreso */}
      <div className="gauge-bar-section">
        <div className="gauge-bar-labels">
          <span>400 ppm — Aire limpio</span>
          <span>2500 ppm — Crítico</span>
        </div>

        <div className="gauge-bar-track">
          <div
            className="gauge-bar-fill"
            style={{ width: `${porcentaje}%` }}
          />
          <div
            className="gauge-bar-marker"
            style={{ left: `${porcentaje}%` }}
          />
        </div>

        <div className="gauge-bar-scale">
          <span>Excelente</span>
          <span>Bueno</span>
          <span>Moderado</span>
          <span>Alto</span>
          <span>Crítico</span>
        </div>
      </div>

      {/* Valor numérico */}
      <div className="gauge-info-section">
        <div>
          <span className="gauge-ppm-value">
            {ppm != null ? Math.round(ppm) : '—'}
          </span>
          <span className="gauge-ppm-unit"> ppm CO₂</span>
        </div>

        <span className="gauge-quality-label">{calidad}</span>

        {adcValue != null && (
          <span className="gauge-adc">ADC raw: {adcValue} / 4095</span>
        )}
      </div>
    </div>
  );
}
