import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

/**
 * HistoryChart — Gráfica de líneas de temperatura, humedad y CO₂.
 * Diseño monocromático, sin emojis.
 *
 * Props:
 *   datos  Array<{ hora, temperatura, humedad, co2 }>
 */

const SERIES = [
  { key: 'temperatura', nombre: 'Temperatura °C', yAxis: 'left',  stroke: '#e0e0e0' },
  { key: 'humedad',     nombre: 'Humedad %',       yAxis: 'left',  stroke: '#888888' },
  { key: 'co2',         nombre: 'CO₂ ppm',         yAxis: 'right', stroke: '#555555' },
];

const TooltipPersonalizado = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#161616',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 8,
      padding: '0.6rem 0.9rem',
      fontSize: '0.78rem',
      color: '#f0f0f0',
    }}>
      <p style={{ margin: '0 0 0.4rem', color: '#888', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.04em' }}>
        {label}
      </p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ margin: '0.15rem 0', color: p.stroke }}>
          {p.name}: <strong>{p.value ?? '—'}</strong>
        </p>
      ))}
    </div>
  );
};

export default function HistoryChart({ datos }) {
  const [activa, setActiva] = useState({
    temperatura: true,
    humedad:     true,
    co2:         false,
  });

  const toggle = (key) => setActiva(prev => ({ ...prev, [key]: !prev[key] }));

  const datosMostrados = datos.length > 100
    ? datos.filter((_, i) => i % Math.ceil(datos.length / 100) === 0)
    : datos;

  return (
    <div className="chart-container">
      <div className="chart-controls">
        {SERIES.map(s => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className={`chart-toggle-btn ${activa[s.key] ? 'active' : ''}`}
            style={activa[s.key] ? { borderColor: s.stroke, color: s.stroke } : {}}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={datosMostrados} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="hora"
            tick={{ fill: '#555', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#555', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#555', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 2500]}
          />
          <Tooltip content={<TooltipPersonalizado />} />

          {activa.temperatura && (
            <Line yAxisId="left" type="monotone" dataKey="temperatura"
              name="Temperatura °C" stroke="#e0e0e0"
              strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#e0e0e0' }}
              connectNulls
            />
          )}
          {activa.humedad && (
            <Line yAxisId="left" type="monotone" dataKey="humedad"
              name="Humedad %" stroke="#888888"
              strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#888888' }}
              connectNulls
            />
          )}
          {activa.co2 && (
            <Line yAxisId="right" type="monotone" dataKey="co2"
              name="CO₂ ppm" stroke="#555555"
              strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#555555' }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
