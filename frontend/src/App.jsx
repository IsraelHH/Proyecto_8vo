import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import SensorCard from './components/SensorCard';
import AIPanel from './components/AIPanel';
import AirQualityGauge from './components/AirQualityGauge';
import HistoryChart from './components/HistoryChart';
import {
  Thermometer, Droplets, Gauge, Wind,
  Activity, Wifi, WifiOff, RefreshCw, Sprout
} from 'lucide-react';
import './App.css';

export default function App() {
  const [ultima, setUltima]               = useState(null);
  const [recomendacion, setRecomendacion] = useState(null);
  const [historico, setHistorico]         = useState([]);
  const [conectado, setConectado]         = useState(true);
  const [cargando, setCargando]           = useState(true);

  // --------------------------------------------------
  // Carga inicial de datos
  // --------------------------------------------------
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const { data: lecturas, error: errL } = await supabase
        .from('lecturas_sensores')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!errL && lecturas?.length > 0) {
        setUltima(lecturas[0]);
        setConectado(true);
      }

      const { data: recs, error: errR } = await supabase
        .from('recomendaciones_ia')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!errR && recs?.length > 0) setRecomendacion(recs[0]);

      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: hist, error: errH } = await supabase
        .from('lecturas_sensores')
        .select('created_at, temperatura_bme, humedad_bme, ppm_co2_estimado')
        .gte('created_at', hace24h)
        .order('created_at', { ascending: true })
        .limit(200);

      if (!errH && hist) {
        setHistorico(hist.map(h => ({
          hora: new Date(h.created_at).toLocaleTimeString('es-MX', {
            hour: '2-digit', minute: '2-digit'
          }),
          temperatura: h.temperatura_bme ? +h.temperatura_bme.toFixed(1) : null,
          humedad:     h.humedad_bme     ? +h.humedad_bme.toFixed(1)     : null,
          co2:         h.ppm_co2_estimado ? +h.ppm_co2_estimado.toFixed(0) : null,
        })));
      }

      setConectado(true);
    } catch {
      setConectado(false);
    } finally {
      setCargando(false);
    }
  }, []);

  // --------------------------------------------------
  // Realtime subscriptions
  // --------------------------------------------------
  useEffect(() => {
    cargarDatos();

    const chanLecturas = supabase
      .channel('lecturas-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lecturas_sensores',
      }, payload => {
        const nueva = payload.new;
        setUltima(nueva);
        setConectado(true);
        setHistorico(prev => {
          const punto = {
            hora: new Date(nueva.created_at).toLocaleTimeString('es-MX', {
              hour: '2-digit', minute: '2-digit'
            }),
            temperatura: nueva.temperatura_bme ? +nueva.temperatura_bme.toFixed(1) : null,
            humedad:     nueva.humedad_bme     ? +nueva.humedad_bme.toFixed(1)     : null,
            co2:         nueva.ppm_co2_estimado ? +nueva.ppm_co2_estimado.toFixed(0) : null,
          };
          return [...prev.slice(-199), punto];
        });
      })
      .subscribe();

    const chanIA = supabase
      .channel('ia-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'recomendaciones_ia',
      }, payload => {
        setRecomendacion(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chanLecturas);
      supabase.removeChannel(chanIA);
    };
  }, [cargarDatos]);

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const formatFecha = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <Sprout size={20} className="header-icon" />
          <div>
            <h1 className="header-title">Invernadero Inteligente</h1>
            <p className="header-sub">Monitoreo en tiempo real — ESP32-S3</p>
          </div>
        </div>
        <div className="header-right">
          <div className={`status-badge ${conectado ? 'online' : 'offline'}`}>
            {conectado ? <Wifi size={12} /> : <WifiOff size={12} />}
            {conectado ? 'En línea' : 'Sin conexión'}
          </div>
          <button className="refresh-btn" onClick={cargarDatos} title="Actualizar">
            <RefreshCw size={14} className={cargando ? 'spinning' : ''} />
          </button>
        </div>
      </header>

      <main className="main">
        {cargando && !ultima ? (
          <div className="loading">
            <RefreshCw size={24} className="spinning" />
            <p>Conectando con los sensores...</p>
          </div>
        ) : (
          <>
            {ultima && (
              <p className="timestamp">
                Última lectura: {formatFecha(ultima.created_at)}
              </p>
            )}

            {/* Tarjetas de sensores */}
            <section className="section">
              <div className="section-header">
                <Activity size={12} />
                <h2 className="section-title">Sensores</h2>
              </div>
              <div className="cards-grid">
                <SensorCard
                  icon={Thermometer}
                  label="Temperatura"
                  value={ultima?.temperatura_bme}
                  unit="°C"
                  sensor="BME280"
                  min={18} max={28}
                  decimals={1}
                />
                <SensorCard
                  icon={Droplets}
                  label="Humedad"
                  value={ultima?.humedad_bme}
                  unit="%"
                  sensor="BME280"
                  min={60} max={80}
                  decimals={1}
                />
                <SensorCard
                  icon={Gauge}
                  label="Presión"
                  value={ultima?.presion}
                  unit="hPa"
                  sensor="BME280"
                  min={980} max={1040}
                  decimals={1}
                />
                <SensorCard
                  icon={Thermometer}
                  label="Temperatura"
                  value={ultima?.temperatura_dht}
                  unit="°C"
                  sensor="DHT11"
                  min={18} max={28}
                  decimals={1}
                />
                <SensorCard
                  icon={Droplets}
                  label="Humedad"
                  value={ultima?.humedad_dht}
                  unit="%"
                  sensor="DHT11"
                  min={60} max={80}
                  decimals={1}
                />
                <SensorCard
                  icon={Wind}
                  label="CO₂ estimado"
                  value={ultima?.ppm_co2_estimado}
                  unit="ppm"
                  sensor="MQ-135"
                  min={400} max={1500}
                  decimals={0}
                />
              </div>
            </section>

            {/* Gauge calidad del aire */}
            <section className="section">
              <div className="section-header">
                <Activity size={12} />
                <h2 className="section-title">Calidad del Aire</h2>
              </div>
              <AirQualityGauge
                adcValue={ultima?.calidad_aire}
                ppm={ultima?.ppm_co2_estimado}
              />
            </section>

            {/* Panel IA */}
            <section className="section">
              <div className="section-header">
                <Activity size={12} />
                <h2 className="section-title">Diagnóstico IA</h2>
              </div>
              <AIPanel recomendacion={recomendacion} formatFecha={formatFecha} />
            </section>

            {/* Gráfica histórica */}
            {historico.length > 1 && (
              <section className="section">
                <div className="section-header">
                  <Activity size={12} />
                  <h2 className="section-title">Historial 24 horas</h2>
                </div>
                <HistoryChart datos={historico} />
              </section>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        Proyecto Sistemas Embebidos — Universidad &nbsp;·&nbsp; ESP32-S3 + BME280 + DHT11 + MQ-135 + Ollama
      </footer>
    </div>
  );
}
