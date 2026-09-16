// ============================================================
// config.h — Configuración del Invernadero Inteligente
// Modifica solo este archivo con tus credenciales y pines
// ============================================================

#ifndef CONFIG_H
#define CONFIG_H

// ----------------------------
// WiFi
// ----------------------------
#define WIFI_SSID     "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_CONTRASENA_WIFI"

// ----------------------------
// Supabase REST API
// ----------------------------
#define SUPABASE_URL  "https://jcgiictllfybpbljhnab.supabase.co"
#define SUPABASE_KEY  "sb_publishable_UujMyU0IZwz0grZy7CjAmQ_Khszpwtz"
#define SUPABASE_TABLE "lecturas_sensores"

// Endpoint completo
#define SUPABASE_ENDPOINT SUPABASE_URL "/rest/v1/" SUPABASE_TABLE

// ----------------------------
// Pines del ESP32-S3
// ----------------------------

// DHT11 — pin digital
#define DHT_PIN       4
#define DHT_TYPE      DHT11

// MQ-135 — pin analógico (ADC)
// En ESP32-S3: GPIO1-GPIO10 son ADC1 (recomendados)
#define MQ135_PIN     3

// BME280 — I2C (comparte bus con SDA/SCL)
// ESP32-S3 I2C por defecto: SDA=GPIO8, SCL=GPIO9
// Ajusta si usas pines diferentes
#define BME280_I2C_ADDR 0x76   // Alternativa: 0x77 si el pin SDO está a VCC

// ----------------------------
// Configuración de lecturas
// ----------------------------
#define INTERVALO_LECTURA_MS  30000   // 30 segundos entre lecturas
#define WIFI_TIMEOUT_MS       15000   // Tiempo máximo esperando WiFi

// ----------------------------
// Calibración MQ-135
// Deja el sensor encendido 24h en aire limpio para obtener R0
// Por defecto se usa un valor típico
// ----------------------------
#define MQ135_R0          76.63   // Resistencia en aire limpio (kΩ) — calibrar
#define MQ135_RL          10.0    // Resistencia de carga en kΩ (10K en la placa)
#define MQ135_VCC         3.3     // Voltaje de operación ESP32-S3

#endif // CONFIG_H
