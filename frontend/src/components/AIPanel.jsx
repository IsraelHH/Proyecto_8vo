import React from 'react';
import { Bot } from 'lucide-react';

/**
 * AIPanel — Panel de recomendación del modelo Ollama.
 * Diseño monocromático sin emojis.
 *
 * Props:
 *   recomendacion  object | null  — Row de recomendaciones_ia
 *   formatFecha    function       — Formateador de timestamps
 */
export default function AIPanel({ recomendacion, formatFecha }) {
  const estado = recomendacion?.estado_general ?? 'pendiente';

  const claseEstado =
    estado === 'óptimo'  ? 'optimo'   :
    estado === 'crítico' ? 'critico'  :
    estado === 'alerta'  ? 'alerta'   :
    'pendiente';

  const etiquetas = {
    'óptimo':   'Óptimo',
    'alerta':   'Alerta',
    'crítico':  'Crítico',
    'pendiente': 'Procesando',
  };

  return (
    <div className={`ai-panel ${claseEstado}`}>
      <div className="ai-panel-header">
        <div className="ai-panel-left">
          <Bot size={15} style={{ color: 'var(--text-secondary)' }} />
          <span className={`ai-panel-indicator ${claseEstado}`} />
          <span className={`ai-panel-status ${claseEstado}`}>
            {etiquetas[estado] ?? estado}
          </span>
        </div>
        {recomendacion?.created_at && (
          <span className="ai-panel-time">
            {formatFecha(recomendacion.created_at)}
          </span>
        )}
      </div>

      {recomendacion?.recomendacion ? (
        <p className="ai-panel-text">{recomendacion.recomendacion}</p>
      ) : (
        <p className="ai-panel-empty">
          Esperando análisis de la IA. Verifica que el puente Python esté activo.
        </p>
      )}
    </div>
  );
}
