// ============================================================
// invernadero.ino — Firmware ESP32-S3 Invernadero Inteligente
// Sensores: BME280 + DHT11 + MQ-135
// Destino: Supabase REST API via WiFi HTTPS
//
// Librerías requeridas (instalar via Arduino Library Manager):
//   - Adafruit BME280 Library
//   - Adafruit Unified Sensor
//   - DHT sensor library (Adafruit)
//   - ArduinoJson (Benoit Blanchon, versión 6.x)
//   - WiFi (incluida en ESP32 board package)
//   - HTTPClient (incluida en ESP32 board package)
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include "config.h"

// ----------------------------
// Objetos de sensores
// ----------------------------
Adafruit_BME280 bme;
DHT dht(DHT_PIN, DHT_TYPE);

// ----------------------------
// Variables de estado
// ----------------------------
unsigned long ultimaLectura = 0;
bool bmeDisponible = false;

// ----------------------------
// Prototipo de funciones
// ----------------------------
bool conectarWiFi();
bool leerBME280(float &temp, float &hum, float &pres);
bool leerDHT11(float &temp, float &hum);
void leerMQ135(int &valorADC, float &ppmCO2);
float calcularPPM(int adcValue);
bool enviarASupabase(float tempBME, float humBME, float pres,
                     float tempDHT, float humDHT,
                     int aireADC, float ppmCO2);

// ============================================================
// SETUP
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("========================================");
    Serial.println("  Invernadero Inteligente — ESP32-S3");
    Serial.println("========================================");

    // Inicializar I2C para BME280
    Wire.begin();  // Usa pines I2C por defecto del ESP32-S3 (SDA=8, SCL=9)

    // Inicializar BME280
    if (bme.begin(BME280_I2C_ADDR)) {
        bmeDisponible = true;
        Serial.println("[OK] BME280 detectado");
        // Configurar para lecturas normales (no weather station)
        bme.setSampling(Adafruit_BME280::MODE_NORMAL,
                        Adafruit_BME280::SAMPLING_X2,  // temperatura
                        Adafruit_BME280::SAMPLING_X2,  // presión
                        Adafruit_BME280::SAMPLING_X2,  // humedad
                        Adafruit_BME280::FILTER_X4,
                        Adafruit_BME280::STANDBY_MS_250);
    } else {
        Serial.println("[ERROR] BME280 no encontrado. Verificar conexion I2C y direccion (0x76/0x77)");
    }

    // Inicializar DHT11
    dht.begin();
    Serial.println("[OK] DHT11 inicializado");

    // Configurar pin ADC del MQ-135
    analogReadResolution(12);  // 12-bit ADC (0-4095)
    analogSetAttenuation(ADC_11db);  // Rango completo 0-3.3V
    Serial.println("[OK] MQ-135 configurado (ADC 12-bit)");

    // Esperar precalentamiento del MQ-135 (mínimo 3 min en operación continua)
    Serial.println("[INFO] Precalentando MQ-135...");
    delay(3000);  // Para demo; en producción usar 3+ minutos

    Serial.println("[INFO] Sistema listo. Iniciando ciclo de lecturas.");
    Serial.println();
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================
void loop() {
    unsigned long ahora = millis();

    // Esperar el intervalo configurado
    if (ahora - ultimaLectura < INTERVALO_LECTURA_MS) {
        delay(100);
        return;
    }
    ultimaLectura = ahora;

    Serial.println("--- Nueva lectura ---");

    // ---- Leer sensores ----
    float tempBME = 0, humBME = 0, pres = 0;
    float tempDHT = 0, humDHT = 0;
    int   aireADC = 0;
    float ppmCO2  = 0;

    bool bmeOK = leerBME280(tempBME, humBME, pres);
    bool dhtOK = leerDHT11(tempDHT, humDHT);
    leerMQ135(aireADC, ppmCO2);

    // ---- Mostrar en serial ----
    Serial.printf("[BME280] Temp: %.2f°C  Hum: %.2f%%  Presion: %.2f hPa\n",
                  tempBME, humBME, pres);
    Serial.printf("[DHT11 ] Temp: %.2f°C  Hum: %.2f%%\n", tempDHT, humDHT);
    Serial.printf("[MQ-135] ADC: %d  CO2 est: %.1f ppm\n", aireADC, ppmCO2);

    if (!bmeOK) Serial.println("[WARN] Lectura BME280 fallida, usando 0");
    if (!dhtOK) Serial.println("[WARN] Lectura DHT11 fallida, usando 0");

    // ---- Conectar WiFi y enviar ----
    if (conectarWiFi()) {
        bool enviado = enviarASupabase(tempBME, humBME, pres,
                                       tempDHT, humDHT,
                                       aireADC, ppmCO2);
        if (enviado) {
            Serial.println("[OK] Datos enviados a Supabase");
        } else {
            Serial.println("[ERROR] Fallo al enviar datos");
        }

        // Desconectar para ahorrar energía
        WiFi.disconnect(true);
    } else {
        Serial.println("[ERROR] No se pudo conectar a WiFi");
    }

    Serial.println();
}

// ============================================================
// FUNCIONES
// ============================================================

// Conecta al WiFi, retorna true si exitoso
bool conectarWiFi() {
    if (WiFi.status() == WL_CONNECTED) return true;

    Serial.printf("[WiFi] Conectando a %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long inicio = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - inicio > WIFI_TIMEOUT_MS) {
            Serial.println(" TIMEOUT");
            return false;
        }
        delay(500);
        Serial.print(".");
    }

    Serial.printf(" OK (IP: %s)\n", WiFi.localIP().toString().c_str());
    return true;
}

// Lee el BME280, retorna false si hay error
bool leerBME280(float &temp, float &hum, float &pres) {
    if (!bmeDisponible) return false;

    temp = bme.readTemperature();
    hum  = bme.readHumidity();
    pres = bme.readPressure() / 100.0F;  // Pa → hPa

    // Verificar valores razonables
    if (isnan(temp) || isnan(hum) || isnan(pres)) return false;
    if (temp < -40 || temp > 85) return false;
    if (hum < 0 || hum > 100)   return false;

    return true;
}

// Lee el DHT11, retorna false si hay error
bool leerDHT11(float &temp, float &hum) {
    // DHT11 necesita ~2s entre lecturas
    temp = dht.readTemperature();
    hum  = dht.readHumidity();

    if (isnan(temp) || isnan(hum)) return false;
    return true;
}

// Lee el MQ-135 y calcula PPM de CO2
void leerMQ135(int &valorADC, float &ppmCO2) {
    // Promediar 10 lecturas para reducir ruido
    long suma = 0;
    for (int i = 0; i < 10; i++) {
        suma += analogRead(MQ135_PIN);
        delay(10);
    }
    valorADC = suma / 10;
    ppmCO2   = calcularPPM(valorADC);
}

// Calcula PPM de CO2 a partir del valor ADC del MQ-135
// Basado en la curva de sensibilidad del datasheet del MQ-135
float calcularPPM(int adcValue) {
    if (adcValue <= 0) return 400.0;  // CO2 atmosférico base

    // Calcular voltaje de salida
    float vout = (adcValue / 4095.0f) * MQ135_VCC;
    if (vout < 0.01f) return 400.0;  // Evitar division por cero

    // Calcular resistencia del sensor (RS)
    float rs = ((MQ135_VCC * MQ135_RL) / vout) - MQ135_RL;
    if (rs <= 0) return 400.0;

    // Ratio RS/R0
    float ratio = rs / MQ135_R0;

    // Curva de CO2 del MQ-135 (formula power-law del datasheet)
    // ppm = 116.6020682 * (RS/R0)^(-2.769034857)
    float ppm = 116.6020682f * pow(ratio, -2.769034857f);

    // Limitar a rango razonable (400-5000 ppm para CO2)
    if (ppm < 400.0f)  ppm = 400.0f;
    if (ppm > 5000.0f) ppm = 5000.0f;

    return ppm;
}

// Envía los datos a Supabase via HTTP POST
bool enviarASupabase(float tempBME, float humBME, float pres,
                     float tempDHT, float humDHT,
                     int aireADC, float ppmCO2) {

    // Construir JSON con ArduinoJson
    StaticJsonDocument<256> doc;
    doc["temperatura_bme"]    = round(tempBME * 100) / 100.0;
    doc["humedad_bme"]        = round(humBME * 100) / 100.0;
    doc["presion"]            = round(pres * 10) / 10.0;
    doc["temperatura_dht"]    = round(tempDHT * 100) / 100.0;
    doc["humedad_dht"]        = round(humDHT * 100) / 100.0;
    doc["calidad_aire"]       = aireADC;
    doc["ppm_co2_estimado"]   = round(ppmCO2 * 10) / 10.0;

    String jsonBody;
    serializeJson(doc, jsonBody);
    Serial.println("[HTTP] Body: " + jsonBody);

    // Configurar cliente HTTPS (sin verificar certificado — ok para universidad)
    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    http.begin(client, SUPABASE_ENDPOINT);

    // Headers requeridos por Supabase REST API
    http.addHeader("Content-Type",  "application/json");
    http.addHeader("apikey",        SUPABASE_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
    http.addHeader("Prefer",        "return=minimal");

    int httpCode = http.POST(jsonBody);
    Serial.printf("[HTTP] Codigo respuesta: %d\n", httpCode);

    if (httpCode > 0 && httpCode != 400) {
        String respuesta = http.getString();
        if (respuesta.length() > 0) {
            Serial.println("[HTTP] Respuesta: " + respuesta);
        }
    }

    http.end();

    // Supabase retorna 201 Created para INSERT exitoso
    return (httpCode == 201 || httpCode == 200);
}
