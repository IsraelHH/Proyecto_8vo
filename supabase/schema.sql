-- ============================================================
-- INVERNADERO INTELIGENTE — Schema Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ----------------------------
-- Tabla 1: Lecturas de sensores
-- ----------------------------
CREATE TABLE IF NOT EXISTS public.lecturas_sensores (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL    DEFAULT now(),

    -- BME280
    temperatura_bme  REAL,
    humedad_bme      REAL,
    presion          REAL,

    -- DHT11
    temperatura_dht  REAL,
    humedad_dht      REAL,

    -- MQ-135
    calidad_aire       INTEGER,
    ppm_co2_estimado   REAL,

    -- Flag para el puente Python
    procesado        BOOLEAN NOT NULL DEFAULT FALSE
);

-- ----------------------------
-- Tabla 2: Recomendaciones IA
-- ----------------------------
CREATE TABLE IF NOT EXISTS public.recomendaciones_ia (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL    DEFAULT now(),

    lectura_id    UUID        REFERENCES public.lecturas_sensores(id) ON DELETE CASCADE,
    recomendacion TEXT,
    estado_general TEXT       CHECK (estado_general IN ('óptimo', 'alerta', 'crítico'))
);

-- ----------------------------
-- Row Level Security (RLS)
-- Necesario para acceso desde ESP32, React y Python bridge
-- ----------------------------

ALTER TABLE public.lecturas_sensores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recomendaciones_ia   ENABLE ROW LEVEL SECURITY;

-- lecturas_sensores: cualquiera puede leer e insertar (ESP32 + Dashboard)
CREATE POLICY "public_select_lecturas"
    ON public.lecturas_sensores FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "public_insert_lecturas"
    ON public.lecturas_sensores FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "public_update_lecturas"
    ON public.lecturas_sensores FOR UPDATE
    TO anon, authenticated
    USING (true);

-- recomendaciones_ia: cualquiera puede leer e insertar (Python bridge + Dashboard)
CREATE POLICY "public_select_recomendaciones"
    ON public.recomendaciones_ia FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "public_insert_recomendaciones"
    ON public.recomendaciones_ia FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- ----------------------------
-- Indices para performance
-- ----------------------------
CREATE INDEX IF NOT EXISTS idx_lecturas_created_at
    ON public.lecturas_sensores (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lecturas_procesado
    ON public.lecturas_sensores (procesado)
    WHERE procesado = FALSE;

CREATE INDEX IF NOT EXISTS idx_recomendaciones_lectura_id
    ON public.recomendaciones_ia (lectura_id);

CREATE INDEX IF NOT EXISTS idx_recomendaciones_created_at
    ON public.recomendaciones_ia (created_at DESC);

-- ----------------------------
-- Habilitar Realtime en ambas tablas
-- ----------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.lecturas_sensores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recomendaciones_ia;
