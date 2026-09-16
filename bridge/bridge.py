# ==============================================================
# bridge.py — Puente local entre Supabase y Ollama
# Invernadero Inteligente
#
# Uso:
#   1. Instalar dependencias: pip install -r requirements.txt
#   2. Copiar .env.example a .env y configurar variables
#   3. Asegurarse de que Ollama esté corriendo: ollama serve
#   4. Ejecutar: python bridge.py
# ==============================================================

import os
import json
import time
import logging
import requests
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

# ----------------------------
# Configuración
# ----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jcgiictllfybpbljhnab.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_UujMyU0IZwz0grZy7CjAmQ_Khszpwtz")
OLLAMA_HOST  = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
INTERVALO_SEG = int(os.getenv("INTERVALO_SEG", "35"))

# Headers para todas las peticiones a Supabase
SUPABASE_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

# ----------------------------
# Logging
# ----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


# ==============================================================
# FUNCIONES SUPABASE
# ==============================================================

def obtener_lecturas_sin_procesar() -> list[dict]:
    """Obtiene lecturas del ESP32 que aún no fueron procesadas por la IA."""
    url = f"{SUPABASE_URL}/rest/v1/lecturas_sensores"
    params = {
        "procesado": "eq.false",
        "order":     "created_at.asc",
        "limit":     "5",   # Procesar máximo 5 a la vez si hay acumulación
    }
    try:
        resp = requests.get(url, headers=SUPABASE_HEADERS, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.error(f"Error obteniendo lecturas de Supabase: {e}")
        return []


def guardar_recomendacion(lectura_id: str, recomendacion: str, estado: str) -> bool:
    """Inserta la recomendación de la IA en Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/recomendaciones_ia"
    body = {
        "lectura_id":    lectura_id,
        "recomendacion": recomendacion,
        "estado_general": estado,
    }
    try:
        resp = requests.post(url, headers=SUPABASE_HEADERS, json=body, timeout=10)
        resp.raise_for_status()
        return True
    except Exception as e:
        log.error(f"Error guardando recomendacion en Supabase: {e}")
        return False


def marcar_como_procesada(lectura_id: str) -> bool:
    """Marca una lectura como procesada para que no se reprocese."""
    url = f"{SUPABASE_URL}/rest/v1/lecturas_sensores"
    params = {"id": f"eq.{lectura_id}"}
    body   = {"procesado": True}
    try:
        resp = requests.patch(url, headers=SUPABASE_HEADERS,
                              params=params, json=body, timeout=10)
        resp.raise_for_status()
        return True
    except Exception as e:
        log.error(f"Error marcando lectura {lectura_id} como procesada: {e}")
        return False


# ==============================================================
# FUNCIONES OLLAMA
# ==============================================================

def construir_prompt(lectura: dict) -> str:
    """Construye el prompt agrónomo para el modelo de lenguaje."""
    temp_bme  = lectura.get("temperatura_bme", "N/D")
    hum_bme   = lectura.get("humedad_bme", "N/D")
    presion   = lectura.get("presion", "N/D")
    temp_dht  = lectura.get("temperatura_dht", "N/D")
    hum_dht   = lectura.get("humedad_dht", "N/D")
    aire      = lectura.get("calidad_aire", "N/D")
    ppm       = lectura.get("ppm_co2_estimado", "N/D")

    return f"""Eres un experto agrónomo especializado en manejo de invernaderos.
Analiza los siguientes datos de sensores y proporciona UNA recomendación concisa para el operador.

DATOS ACTUALES DEL INVERNADERO:
- Temperatura (BME280): {temp_bme}°C
- Humedad relativa (BME280): {hum_bme}%
- Presión atmosférica: {presion} hPa
- Temperatura (DHT11): {temp_dht}°C
- Humedad relativa (DHT11): {hum_dht}%
- Calidad del aire (MQ-135 ADC): {aire}
- CO₂ estimado: {ppm} ppm

RANGOS ÓPTIMOS PARA INVERNADERO GENERAL:
- Temperatura: 18-28°C
- Humedad: 60-80%
- CO₂: 400-1500 ppm (sobre 1500 puede ser problema)
- Presión: estable alrededor de 1013 hPa

INSTRUCCIONES DE RESPUESTA:
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código, sin explicaciones.
El JSON debe tener exactamente estos dos campos:
- "recomendacion": string con máximo 3 oraciones en español describiendo el estado y qué acción tomar
- "estado_general": uno de estos tres valores exactos: "óptimo", "alerta", "crítico"

Ejemplo de formato esperado:
{{"recomendacion": "La temperatura y humedad están en rango óptimo. El nivel de CO₂ es adecuado para el crecimiento de plantas. No se requieren acciones inmediatas.", "estado_general": "óptimo"}}

Tu respuesta JSON:"""


def llamar_ollama(prompt: str) -> dict | None:
    """Llama a Ollama y retorna el JSON parseado con recomendacion y estado_general."""
    url = f"{OLLAMA_HOST}/api/generate"
    body = {
        "model":  OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,   # Respuestas consistentes, no creativas
            "num_predict": 300,
        },
    }
    try:
        log.info(f"Llamando a Ollama ({OLLAMA_MODEL}) en {OLLAMA_HOST}...")
        resp = requests.post(url, json=body, timeout=120)
        resp.raise_for_status()

        texto = resp.json().get("response", "").strip()
        log.info(f"Respuesta de Ollama: {texto[:200]}...")

        # Extraer JSON de la respuesta
        # A veces el modelo incluye texto antes/después del JSON
        inicio = texto.find("{")
        fin    = texto.rfind("}") + 1
        if inicio == -1 or fin == 0:
            raise ValueError("No se encontró JSON en la respuesta")

        json_str = texto[inicio:fin]
        resultado = json.loads(json_str)

        # Validar campos requeridos
        if "recomendacion" not in resultado:
            resultado["recomendacion"] = texto[:500]  # Fallback
        if "estado_general" not in resultado:
            resultado["estado_general"] = "alerta"

        # Normalizar estado_general
        estado = resultado["estado_general"].lower().strip()
        if estado not in ("óptimo", "optimo", "alerta", "crítico", "critico"):
            estado = "alerta"
        # Normalizar tildes
        estado = estado.replace("optimo", "óptimo").replace("critico", "crítico")
        resultado["estado_general"] = estado

        return resultado

    except json.JSONDecodeError as e:
        log.error(f"Error parseando JSON de Ollama: {e}")
        # Fallback: usar el texto crudo como recomendación
        return {
            "recomendacion": texto[:500] if 'texto' in locals() else "Error al procesar respuesta de IA",
            "estado_general": "alerta",
        }
    except requests.exceptions.ConnectionError:
        log.error(f"No se puede conectar a Ollama en {OLLAMA_HOST}. "
                   "Asegúrate de que 'ollama serve' esté corriendo.")
        return None
    except Exception as e:
        log.error(f"Error llamando a Ollama: {e}")
        return None


def verificar_ollama() -> bool:
    """Verifica que Ollama esté disponible y el modelo esté cargado."""
    try:
        resp = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        modelos = [m["name"] for m in resp.json().get("models", [])]
        log.info(f"Ollama disponible. Modelos: {modelos}")

        # Verificar que el modelo configurado está disponible
        modelo_base = OLLAMA_MODEL.split(":")[0]
        disponible = any(modelo_base in m for m in modelos)
        if not disponible:
            log.warning(f"Modelo '{OLLAMA_MODEL}' no encontrado. "
                        f"Ejecuta: ollama pull {OLLAMA_MODEL}")
        return disponible
    except Exception as e:
        log.error(f"Ollama no disponible: {e}")
        return False


# ==============================================================
# LOOP PRINCIPAL
# ==============================================================

def procesar_lectura(lectura: dict) -> None:
    """Procesa una sola lectura: llama a IA y guarda resultado."""
    lid = lectura["id"]
    log.info(f"Procesando lectura {lid} (creada: {lectura.get('created_at', '?')})")

    # Construir prompt y llamar a Ollama
    prompt    = construir_prompt(lectura)
    resultado = llamar_ollama(prompt)

    if resultado is None:
        log.warning(f"No se pudo obtener respuesta de IA para lectura {lid}")
        return

    recomendacion = resultado["recomendacion"]
    estado        = resultado["estado_general"]
    log.info(f"Estado: [{estado.upper()}] — {recomendacion[:80]}...")

    # Guardar en Supabase
    if guardar_recomendacion(lid, recomendacion, estado):
        marcar_como_procesada(lid)
        log.info(f"Lectura {lid} procesada y guardada exitosamente.")
    else:
        log.error(f"No se pudo guardar la recomendacion para lectura {lid}")


def main():
    log.info("=" * 60)
    log.info("  Puente Ollama-Supabase — Invernadero Inteligente")
    log.info("=" * 60)
    log.info(f"Supabase: {SUPABASE_URL}")
    log.info(f"Ollama:   {OLLAMA_HOST} / modelo: {OLLAMA_MODEL}")
    log.info(f"Intervalo de polling: {INTERVALO_SEG}s")
    log.info("")

    # Verificar Ollama al inicio
    if not verificar_ollama():
        log.error("Ollama no está disponible. Inicia Ollama y vuelve a ejecutar.")
        return

    log.info("Iniciando ciclo de polling... (Ctrl+C para detener)")
    log.info("")

    while True:
        try:
            lecturas = obtener_lecturas_sin_procesar()

            if not lecturas:
                log.info("Sin lecturas nuevas. Esperando...")
            else:
                log.info(f"Encontradas {len(lecturas)} lecturas sin procesar.")
                for lectura in lecturas:
                    procesar_lectura(lectura)

        except KeyboardInterrupt:
            log.info("Detenido por el usuario. ¡Hasta luego!")
            break
        except Exception as e:
            log.error(f"Error inesperado en el ciclo principal: {e}")

        time.sleep(INTERVALO_SEG)


if __name__ == "__main__":
    main()
