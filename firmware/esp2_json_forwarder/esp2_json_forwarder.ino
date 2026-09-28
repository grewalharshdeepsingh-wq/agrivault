/*
 * AgriVault — ESP #2 : JSON Forwarder
 * =====================================
 * Role    : Receive raw sensor data from ESP #1 via UART Serial2,
 *           parse each field into correct numeric types,
 *           build a standards-compliant AgriVault JSON payload,
 *           and POST it to the Vercel cloud endpoint every 1 second.
 *
 * ── Packet protocol from ESP #1 ──────────────────────────────────────────
 *
 *   Format (pipe-delimited, newline-terminated):
 *     AGVT|<deviceId>|<tempC>|<humidity>|<co2>|<ammonia>|<ethanol>|<battery>|<rssi>|<relayState>
 *
 *   Field types (all arrive as strings, parsed here into proper types):
 *     [0] header     → "AGVT"           (string sentinel — packet validity check)
 *     [1] deviceId   → string           e.g. "ESP32-A7F2C1"
 *     [2] tempC      → float (°C)       e.g. "4.82"
 *     [3] humidity   → float (%RH)      e.g. "88.2"
 *     [4] co2        → int   (ppm)      e.g. "1120"
 *     [5] ammonia    → float (ppm)      e.g. "1.80"
 *     [6] ethanol    → float (ppm)      e.g. "0.60"
 *     [7] battery    → float (V)        e.g. "3.31"
 *     [8] rssi       → int   (dBm)      e.g. "-58"  (ESP #1 has no WiFi — set -1 if N/A)
 *     [9] relayState → int   (0 or 1)   e.g. "0"
 *
 * ── JSON sent to Vercel ──────────────────────────────────────────────────
 *
 *   {
 *     "deviceId":    "ESP32-A7F2C1",        ← string
 *     "hardwareType":"ESP32-DevKit-V1",      ← string
 *     "facilityId":  "fac-01",              ← string
 *     "timestamp":   "2026-09-28T07:40:00Z",← string (ISO 8601 from NTP)
 *     "temperature": 4.82,                  ← number (float)
 *     "humidity":    88.2,                  ← number (float)
 *     "co2":         1120,                  ← number (int)
 *     "ethylene":    0.04,                  ← number (float, fixed estimate)
 *     "ammonia":     1.80,                  ← number (float)
 *     "ethanol":     0.60,                  ← number (float)
 *     "battery":     3.31,                  ← number (float)
 *     "rssi":        -58,                   ← number (int)
 *     "relayState":  0,                     ← number (int)
 *     "forwarderId": "ESP32-FORWARDER",     ← string (ESP #2 identity)
 *     "forwarderRssi": -62                  ← number (ESP #2 Wi-Fi signal)
 *   }
 *
 * ── Wiring ────────────────────────────────────────────────────────────────
 *   ESP #1 TX2 (GPIO 17) ──► ESP #2 RX2 (GPIO 16)   ← data flows here
 *   ESP #1 RX2 (GPIO 16) ◄── ESP #2 TX2 (GPIO 17)   ← optional ACK
 *   SHARED GND           ──► GND                     ← REQUIRED
 *
 * ── Libraries (install via Arduino Library Manager) ──────────────────────
 *   - None beyond the ESP32/ESP8266 core (HTTPClient is built-in)
 */

// ── Board-specific includes ───────────────────────────────────────────────
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <SoftwareSerial.h>
  SoftwareSerial BridgeSerial(D6, D7);   // RX=D6(GPIO12), TX=D7(GPIO13)
  #define BridgeSerial BridgeSerial
  WiFiClient wifiClient;
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #define BridgeSerial Serial2            // RX=GPIO16, TX=GPIO17
#else
  #error "Unsupported board — select ESP32 or ESP8266"
#endif

#include "config.h"

// ══════════════════════════════════════════════════════════════════════════
// Runtime state
// ══════════════════════════════════════════════════════════════════════════

String forwarderId;               // This ESP's own MAC-based ID
String incomingBuffer = "";       // Serial receive accumulator
unsigned long lastPostMs   = 0;
unsigned long lastWifiMs   = 0;
uint32_t      packetCount  = 0;
uint32_t      postOkCount  = 0;
uint32_t      postFailCount= 0;

// Last successfully parsed sensor reading
struct SensorReading {
  String deviceId    = "";
  float  tempC       = 0.0f;
  float  humidity    = 0.0f;
  int    co2         = 0;
  float  ammonia     = 0.0f;
  float  ethanol     = 0.0f;
  float  battery     = 3.3f;
  int    rssi        = 0;
  int    relayState  = 0;
  bool   valid       = false;
} lastReading;

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

// Build MAC-based forwarder ID  e.g.  "ESP32-FWDR-A1B2C3"
String getForwarderId() {
  uint8_t mac[6];
#if defined(ESP32)
  esp_efuse_mac_get_default(mac);
#else
  WiFi.macAddress(mac);
#endif
  char buf[20];
  snprintf(buf, sizeof(buf), "ESP32-FWDR-%02X%02X%02X", mac[3], mac[4], mac[5]);
  return String(buf);
}

// Connect / reconnect Wi-Fi
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] Connected — IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    Serial.println("\n[WiFi] Failed — will retry");
    digitalWrite(PIN_STATUS_LED, LOW);
  }
}

// ── Parse a pipe-delimited packet from ESP #1 ────────────────────────────
//
// Expected format:
//   AGVT|<deviceId>|<tempC>|<humidity>|<co2>|<ammonia>|<ethanol>|<battery>|<rssi>|<relayState>
//
// Returns true if the packet is valid and parsed successfully.
// All numeric fields arrive as ASCII strings and are converted here to
// their correct C++ numeric types (float / int) before JSON assembly.
//
bool parsePacket(const String& line, SensorReading& out) {
  // Validate header sentinel
  if (!line.startsWith(PACKET_HEADER)) {
    Serial.println("[PARSE] Bad header — ignored: " + line.substring(0, 8));
    return false;
  }

  // Split on '|'
  String fields[10];
  int    fieldCount = 0;
  int    start = 0;
  for (int i = 0; i <= line.length() && fieldCount < 10; i++) {
    if (i == (int)line.length() || line[i] == '|') {
      fields[fieldCount++] = line.substring(start, i);
      start = i + 1;
    }
  }

  if (fieldCount < 10) {
    Serial.print("[PARSE] Incomplete packet (");
    Serial.print(fieldCount);
    Serial.println(" fields, expected 10)");
    return false;
  }

  // fields[0] = "AGVT" (already validated)
  out.deviceId   = fields[1];                       // string  — kept as-is
  out.tempC      = fields[2].toFloat();             // string → float
  out.humidity   = fields[3].toFloat();             // string → float
  out.co2        = (int)fields[4].toFloat();        // string → int
  out.ammonia    = fields[5].toFloat();             // string → float
  out.ethanol    = fields[6].toFloat();             // string → float
  out.battery    = fields[7].toFloat();             // string → float
  out.rssi       = (int)fields[8].toFloat();        // string → int
  out.relayState = (int)fields[9].toFloat();        // string → int (0 or 1)
  out.valid      = true;

  return true;
}

// ── Build AgriVault-spec JSON from a SensorReading ───────────────────────
//
// All numeric fields are emitted as JSON numbers (no quotes) so the
// Vercel backend can store and compare them directly.
// String fields are enclosed in double quotes.
//
String buildJson(const SensorReading& r) {
  // ISO 8601 timestamp — uses millis() as offset from epoch 0 if no NTP.
  // For production, add an NTP library and format a real UTC timestamp.
  String ts = "1970-01-01T00:00:00Z"; // placeholder — replace with NTP

  String json = "{";

  // ── String fields ──────────────────────────────────────────────────────
  json += "\"deviceId\":\""      + r.deviceId                 + "\",";
  json += "\"hardwareType\":\""  + String(HARDWARE_TYPE)      + "\",";
  json += "\"facilityId\":\""    + String(FACILITY_ID)        + "\",";
  json += "\"timestamp\":\""     + ts                         + "\",";
  json += "\"forwarderId\":\""   + forwarderId                + "\",";

  // ── Numeric fields (no quotes — parsed to correct types in parsePacket) ─
  //    float fields: emitted with fixed decimal precision
  //    int   fields: emitted without decimal point
  json += "\"temperature\":"     + String(r.tempC,    2)      + ",";
  json += "\"humidity\":"        + String(r.humidity, 1)      + ",";
  json += "\"co2\":"             + String(r.co2)              + ",";
  json += "\"ethylene\":0.04,"    ;                             // fixed estimate
  json += "\"ammonia\":"         + String(r.ammonia,  2)      + ",";
  json += "\"ethanol\":"         + String(r.ethanol,  2)      + ",";
  json += "\"battery\":"         + String(r.battery,  2)      + ",";
  json += "\"rssi\":"            + String(r.rssi)             + ",";
  json += "\"relayState\":"      + String(r.relayState)       + ",";
  json += "\"forwarderRssi\":"   + String(WiFi.RSSI());

  json += "}";
  return json;
}

// ── HTTP POST to Vercel ───────────────────────────────────────────────────
bool postToVercel(const String& json) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] No WiFi — skipping POST");
    return false;
  }

  HTTPClient http;
#if defined(ESP8266)
  http.begin(wifiClient, CLOUD_API_URL);
#else
  http.begin(CLOUD_API_URL);
#endif
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  int code = http.POST(json);
  bool ok  = (code == 200 || code == 201);

  if (ok) {
    postOkCount++;
    Serial.print("[HTTP] Vercel ACK ");
    Serial.print(code);
    Serial.print(" | ok=");
    Serial.print(postOkCount);
    Serial.print(" fail=");
    Serial.println(postFailCount);
  } else {
    postFailCount++;
    Serial.print("[HTTP] POST failed code=");
    Serial.print(code);
    Serial.print(" fail=");
    Serial.println(postFailCount);
  }

  http.end();
  return ok;
}

// ══════════════════════════════════════════════════════════════════════════
// setup()
// ══════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Start serial bridge to ESP #1
  BridgeSerial.begin(BRIDGE_BAUD);
  BridgeSerial.setTimeout(SERIAL_TIMEOUT_MS);

  forwarderId = getForwarderId();

  Serial.println("==============================================");
  Serial.println("  AgriVault ESP #2 — JSON Forwarder");
  Serial.println("==============================================");
  Serial.print("  Forwarder ID : "); Serial.println(forwarderId);
  Serial.print("  Cloud URL    : "); Serial.println(CLOUD_API_URL);
  Serial.print("  Bridge       : Serial2 RX=GPIO16 ← ESP#1 TX");
  Serial.println("==============================================");

  connectWiFi();
}

// ══════════════════════════════════════════════════════════════════════════
// loop()
// ══════════════════════════════════════════════════════════════════════════
void loop() {

  // ── 1. Wi-Fi watchdog — reconnect if dropped ────────────────────────────
  if (millis() - lastWifiMs > 10000) {
    lastWifiMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Connection lost — reconnecting…");
      connectWiFi();
    }
  }

  // ── 2. Read incoming serial from ESP #1 ─────────────────────────────────
  //    Data arrives as a complete line ending with '\n'.
  //    We accumulate characters into incomingBuffer and process when '\n' seen.
  while (BridgeSerial.available()) {
    char c = BridgeSerial.read();

    if (c == '\n') {
      // Complete line received — strip trailing \r if present
      incomingBuffer.trim();

      if (incomingBuffer.length() > 4) {
        packetCount++;

        SensorReading r;
        if (parsePacket(incomingBuffer, r)) {
          lastReading = r;

          // ── 3. Build JSON ──────────────────────────────────────────────
          String json = buildJson(r);

          Serial.print("[JSON] ");
          Serial.println(json);

          // ── 4. POST to Vercel ──────────────────────────────────────────
          bool ok = postToVercel(json);

          // Blink LED: fast = success, slow = fail
          int blinkMs = ok ? 30 : 200;
          digitalWrite(PIN_STATUS_LED, HIGH);
          delay(blinkMs);
          digitalWrite(PIN_STATUS_LED, LOW);
        }
      }

      incomingBuffer = "";  // reset buffer for next line

    } else if (c != '\r') {
      // Normal character — append to buffer
      // Guard against buffer overflow (max reasonable packet < 256 chars)
      if (incomingBuffer.length() < 256) {
        incomingBuffer += c;
      } else {
        // Buffer overflow — packet is corrupt, discard
        Serial.println("[PARSE] Buffer overflow — discarding");
        incomingBuffer = "";
      }
    }
  }
}
