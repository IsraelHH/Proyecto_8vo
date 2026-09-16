# 🌿 Invernadero Inteligente

Sistema de monitoreo de invernadero en tiempo real con ESP32-S3, IA local (Ollama) y dashboard web React.

## Estructura del Proyecto

```
ProyectoIA/
├── supabase/
│   └── schema.sql          ← Ejecutar en Supabase SQL Editor
├── firmware/
│   └── invernadero/
│       ├── invernadero.ino ← Sketch principal Arduino
│       └── config.h        ← ⚠️ Editar con tus credenciales WiFi
├── bridge/
│   ├── bridge.py           ← Puente Ollama ↔ Supabase
│   ├── requirements.txt
│   └── .env.example        ← Copiar a .env y configurar
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── SensorCard.jsx
    │   │   ├── AIPanel.jsx
    │   │   ├── AirQualityGauge.jsx
    │   │   └── HistoryChart.jsx
    │   └── supabaseClient.js
    └── package.json
```

---

## ⚡ Guía de Puesta en Marcha

### Paso 1 — Configurar la Base de Datos (Supabase)

1. Ve a [supabase.com](https://supabase.com) → Tu proyecto → **SQL Editor**
2. Pega el contenido de `supabase/schema.sql` y ejecuta
3. Ve a **Database → Replication** y verifica que `lecturas_sensores` y `recomendaciones_ia` tienen Realtime activado

---

### Paso 2 — Firmware ESP32-S3 (Arduino IDE)

**Instalar librerías** (Tools → Manage Libraries):
- `Adafruit BME280 Library`
- `Adafruit Unified Sensor`
- `DHT sensor library` (Adafruit)
- `ArduinoJson` (Benoit Blanchon, versión 6.x)

**Board Manager** — Instalar soporte ESP32:
- URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- Seleccionar: **ESP32S3 Dev Module**

**Configurar** `firmware/invernadero/config.h`:
```c
#define WIFI_SSID     "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_CONTRASENA"
```

**Conexiones de pines:**
| Sensor  | Pin ESP32-S3 |
|---------|-------------|
| BME280 SDA | GPIO 8 |
| BME280 SCL | GPIO 9 |
| DHT11      | GPIO 4 |
| MQ-135 AO  | GPIO 3 |
| MQ-135 VCC | 3.3V   |

> ⚠️ El MQ-135 necesita ~3 minutos de precalentamiento para lecturas estables.

---

### Paso 3 — Puente Python (en la PC con Ollama)

```bash
cd bridge

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
copy .env.example .env
# Editar .env si Ollama está en otra IP de la red

# Asegurarse de que Ollama esté corriendo con el modelo
ollama serve
ollama pull llama3.1:8b   # Si no está descargado

# Ejecutar el puente
python bridge.py
```

> 💡 Si Ollama está en **otra PC de la red**, edita `.env`:
> ```
> OLLAMA_HOST=http://192.168.X.X:11434
> ```

---

### Paso 4 — Frontend React (local)

```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo de entorno
copy .env.example .env

# Iniciar en modo desarrollo
npm start
```

Abrir: http://localhost:3000

---

### Paso 5 — Deploy en Vercel

1. Sube el proyecto a **GitHub**
2. En [vercel.com](https://vercel.com) → **New Project** → importa el repositorio
3. Configura:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
4. En **Environment Variables** agrega:
   - `REACT_APP_SUPABASE_URL` = `https://jcgiictllfybpbljhnab.supabase.co`
   - `REACT_APP_SUPABASE_KEY` = tu key
5. Click **Deploy** ✅

---

## 🔄 Flujo de Datos

```
ESP32-S3
  │ cada 30s — HTTP POST JSON
  ▼
Supabase (lecturas_sensores)
  │                    │
  │ Realtime           │ polling bridge.py cada 35s
  ▼                    ▼
React Dashboard    bridge.py → Ollama llama3.1:8b
  (Vercel)                          │
     ▲                              │ INSERT recomendacion
     └──── Realtime ────────────────┘
```

---

## 🛠️ Tecnologías

| Componente | Tecnología |
|-----------|-----------|
| Microcontrolador | ESP32-S3 |
| Sensores | BME280, DHT11, MQ-135 |
| Base de datos | Supabase (PostgreSQL) |
| IA | Ollama llama3.1:8b (local) |
| Puente IA | Python 3.10+ |
| Frontend | React 18 (CRA) |
| Hosting | Vercel |

---

## 📚 Universidad — Sistemas Embebidos
