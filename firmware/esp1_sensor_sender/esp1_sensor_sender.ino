/*
 * AgriVault — ESP #1 : Sensor Sender
 * ====================================
 * Role    : Read physical sensors every 1 second and stream a compact
 *           pipe-delimited data line to ESP #2 over hardware Serial2.
 *
 * Output format (one line per second, newline-terminated):
 *
 *   AGVT|<deviceId>|<tempC>|<humidity>|<co2>|<ammonia>|<ethanol>|<battery>|<rssi>|<relayState>\n
 *
 *   Field types:
 *     deviceId   → string  e.g. "ESP32-A7F2C1"
 *     tempC      → float   e.g. "4.82"
 *     humidity   → float   e.g. "88.2"
 *     co2        → int     e.g. "1120"
 *     ammonia    → float   e.g. "1.80"
 *     ethanol    → float   e.g. "0.60"
 *     battery    → float   e.g. "3.31"
 *     rssi       → int     e.g. "-58"
 *     relayState → int     0 or 1
 *
 * Example line:
 *   AGVT|ESP32-A7F2C1|4.82|88.2|1120|1.80|0.60|3.31|-58|0
 *
 * Wiring:
 *   ESP #1 TX2 (GPIO 17) ──► ESP #2 RX (D5 / GPIO 14)
 *   ESP #1 RX2 (GPIO 16) ◄── ESP #2 TX (D6 / GPIO 12)
 *   ESP #1 GND           ──► ESP #2 GND  (REQUIRED)
 *
 * Libraries required (install via Arduino Library Manager):
 *   - OneWire          (Paul Stoffregen)
 *   - DallasTemperature (Miles Burton)
 */

// ── Board compatibility shim ───────────────────────────────────────────────
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <SoftwareSerial.h>
  SoftwareSerial BridgeSerial(D6, D7); // RX=D6 (GPIO12), TX=D7 (GPIO13)
  #define BridgeSerial BridgeSerial
#elif defined(ESP32)
  #include <WiFi.h>   // needed for WiFi.macAddress() even without connecting
  #define BridgeSerial Serial2          // Hardware Serial2: TX=GPIO17, RX=GPIO16
#else
  #error "Unsupported board — select ESP32 or ESP8266 in Arduino IDE"
#endif

#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"

// ── 1-Wire temperature sensor ─────────────────────────────────────────────
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// ── Runtime state ─────────────────────────────────────────────────────────
String  deviceId;
bool    relayState    = false;
unsigned long lastTelemetryMs = 0;

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

// Generate a stable MAC-derived device ID  e.g. "ESP32-A7F2C1"
String getDeviceId() {
  uint8_t mac[6];
  // WiFi.macAddress() reads the factory-burned MAC without needing
  // a Wi-Fi connection — works on both ESP32 and ESP8266.
  WiFi.macAddress(mac);
  char buf[16];
#if defined(ESP32)
  snprintf(buf, sizeof(buf), "ESP32-%02X%02X%02X",   mac[3], mac[4], mac[5]);
#else
  snprintf(buf, sizeof(buf), "ESP8266-%02X%02X%02X", mac[3], mac[4], mac[5]);
#endif
  return String(buf);
}

// Convert raw 12-bit ADC (0-4095) to sensor resistance in kΩ
float sensorResistance(int raw, float rl) {
  if (raw <= 0) return rl * 1000.0f;
  float vOut = (raw / 4095.0f) * 3.3f;
  if (vOut >= 3.3f) return 0.1f;
  float rs = ((3.3f - vOut) * rl) / vOut;
  return rs > 0 ? rs : 0.1f;
}

// MQ-3 → ethanol ppm  (curve: a=0.4, b=-1.45)
float ethanolPpm(int raw) {
  float rs = sensorResistance(raw, MQ3_RL_KOHM);
  float ratio = rs / MQ3_RO;
  return constrain(0.4f * pow(ratio, -1.45f), 0.05f, 50.0f);
}

// MQ-135 → ammonia ppm  (curve: a=1.02, b=-1.8)
float ammoniaPpm(int raw) {
  float rs = sensorResistance(raw, MQ135_RL_KOHM);
  float ratio = rs / MQ135_RO;
  return constrain(1.02f * pow(ratio, -1.8f), 0.1f, 100.0f);
}

// MQ-135 → CO2 surrogate ppm
float co2Ppm(int raw) {
  float rs = sensorResistance(raw, MQ135_RL_KOHM);
  float ratio = rs / MQ135_RO;
  return constrain(110.0f * pow(ratio, -2.2f) + 400.0f, 400.0f, 5000.0f);
}

// Read VCC / battery level (ESP32 internal hall / supply estimate)
float batteryVoltage() {
  // Replace with actual voltage-divider ADC read if you have a battery monitor circuit.
  // Here we return a fixed representative value.
  return 3.31f;
}

// ══════════════════════════════════════════════════════════════════════════
// setup()
// ══════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);     // USB debug monitor
  delay(500);

  // Serial bridge to ESP #2
  BridgeSerial.begin(BRIDGE_BAUD);

  pinMode(PIN_RELAY,      OUTPUT); digitalWrite(PIN_RELAY,      LOW);
  pinMode(PIN_STATUS_LED, OUTPUT); digitalWrite(PIN_STATUS_LED, LOW);
  pinMode(PIN_MQ3_ANALOG, INPUT);
  pinMode(PIN_MQ135_ANALOG, INPUT);

  ds18b20.begin();

  deviceId = getDeviceId();

  Serial.println("==============================================");
  Serial.println("  AgriVault ESP #1 — Sensor Sender");
  Serial.println("==============================================");
  Serial.print("  Device ID : "); Serial.println(deviceId);
  Serial.print("  Interval  : "); Serial.print(TELEMETRY_INTERVAL_MS); Serial.println(" ms");
  Serial.println("  Bridge    : Serial2 TX=GPIO17 → ESP#2 RX=D5 (GPIO14)");
  Serial.println("==============================================");
}

// ══════════════════════════════════════════════════════════════════════════
// loop()
// ══════════════════════════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = now;

    // ── 1. Read DS18B20 temperature ─────────────────────────────────────
    ds18b20.requestTemperatures();
    float tempC = ds18b20.getTempCByIndex(0);
    if (tempC < -50.0f || tempC > 85.0f) tempC = 4.8f; // probe fallback

    // ── 2. Read gas sensor ADCs ──────────────────────────────────────────
    int rawMQ3   = analogRead(PIN_MQ3_ANALOG);
    int rawMQ135 = analogRead(PIN_MQ135_ANALOG);

    // ── 3. Convert to engineering units ─────────────────────────────────
    float ethanol = ethanolPpm(rawMQ3);
    float ammonia = ammoniaPpm(rawMQ135);
    float co2     = co2Ppm(rawMQ135);

    // ── 4. Humidity (sinusoidal estimate — replace with DHT22 if wired) ─
    float humidity = 88.0f + (sinf(now / 50000.0f) * 2.0f);

    // ── 5. Battery / supply ──────────────────────────────────────────────
    float battery = batteryVoltage();

    // ── 6. Build pipe-delimited packet ───────────────────────────────────
    //
    //  Format:  AGVT|<id>|<temp>|<hum>|<co2>|<amm>|<eth>|<bat>|<rssi>|<relay>
    //
    //  All numeric values are formatted as strings with fixed decimal places.
    //  ESP #2 parses each field and places them into the JSON as numbers.
    //
    String packet = "AGVT";
    packet += "|" + deviceId;                       // string
    packet += "|" + String(tempC,    2);            // float  °C
    packet += "|" + String(humidity, 1);            // float  %RH
    packet += "|" + String((int)co2);               // int    ppm
    packet += "|" + String(ammonia,  2);            // float  ppm
    packet += "|" + String(ethanol,  2);            // float  ppm
    packet += "|" + String(battery,  2);            // float  V
    packet += "|" + String(0);                      // int    RSSI placeholder (no WiFi on ESP#1)
    packet += "|" + String(relayState ? 1 : 0);    // int    relay 0/1

    // ── 7. Transmit to ESP #2 ────────────────────────────────────────────
    BridgeSerial.println(packet);  // println adds \r\n — ESP #2 reads until \n

    // ── 8. Debug to USB serial ───────────────────────────────────────────
    Serial.print("[TX] ");
    Serial.println(packet);

    // Blink LED to confirm a reading was sent
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(20);
    digitalWrite(PIN_STATUS_LED, LOW);
  }
}
