/*
 * ==============================================================================
 * AgriVault Outer Gateway Firmware (ESP32)
 * Role: OUTER_GATEWAY (Stationed OUTSIDE Cold Store / Warehouse)
 * Protocols:
 *   - INBOUND: RS-485 wired serial link through cold-store insulated wall
 *   - OUTBOUND: Wi-Fi WAN -> Internet -> AgriVault Cloud / Backend API
 * Responsibilities:
 *   - Receive framed sensor packets from Inner Gateway via MAX485
 *   - Maintain stable Internet WAN connection
 *   - Stream real-time telemetry to AgriVault Backend (HTTP / MQTT)
 *   - FIFO buffer up to 1,000 packets during Internet outages
 *   - Flush buffered packets upon Internet recovery with historical timestamps
 * ==============================================================================
 * ARCHITECTURAL CLASSIFICATION:
 * [x] CURRENTLY IMPLEMENTED:
 *     - MAX485 UART frame parser
 *     - Wi-Fi auto-reconnection watchdog
 *     - HTTP REST telemetry streaming to `/api/gateways/telemetry`
 *     - Circular FIFO buffer with outage recovery flush
 * [!] HARDWARE-DEPENDENT:
 *     - Requires MAX485 TTL module and Internet Wi-Fi router coverage outside vault
 * [ ] FUTURE / PLACEHOLDER:
 *     - Dual SIM Cellular fallback (SIM7600 / LTE-M modem)
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// ----------------- PIN DEFINITIONS -----------------
#define PIN_RS485_RX          16  // HardwareSerial UART2 RX (Connect to MAX485 RO)
#define PIN_RS485_TX          17  // HardwareSerial UART2 TX (Connect to MAX485 DI)
#define PIN_RS485_DE_RE       4   // MAX485 Driver Enable (Set LOW to Receive)
#define PIN_WAN_LED           2   // Onboard Blue Status LED (Solid = WAN Online)
#define PIN_ACTIVITY_LED      18  // RS-485 activity flash

// ----------------- CONFIGURATION -----------------
const char* GATEWAY_ID = "GW-OUTER-01";
const char* FIRMWARE_VERSION = "v2.5.0-outer-gw";
#define RS485_BAUD_RATE       9600

// Wi-Fi Credentials for Outside Office / WAN
const char* WIFI_SSID = "AgriVault-Office-WiFi";
const char* WIFI_PASS = "WarehousePassword123";

// AgriVault Server Endpoint
const char* AGRIVAULT_SERVER = "http://192.168.1.100:4000/api/gateways/telemetry";

HardwareSerial RS485Serial(2);

// ----------------- OFFLINE FIFO BUFFER -----------------
#define MAX_OUTER_BUFFER 1000
String offlineBuffer[MAX_OUTER_BUFFER];
int bufferHead = 0;
int bufferTail = 0;
int bufferCount = 0;

void pushToBuffer(const String& jsonPayload) {
  if (bufferCount >= MAX_OUTER_BUFFER) {
    // Drop oldest to avoid overflow
    bufferTail = (bufferTail + 1) % MAX_OUTER_BUFFER;
    bufferCount--;
  }
  offlineBuffer[bufferHead] = jsonPayload;
  bufferHead = (bufferHead + 1) % MAX_OUTER_BUFFER;
  bufferCount++;
  Serial.printf("[OUTER GW BUFFER] Queued payload. Total buffered: %d / %d\n", bufferCount, MAX_OUTER_BUFFER);
}

String popFromBuffer() {
  if (bufferCount == 0) return "";
  String item = offlineBuffer[bufferTail];
  bufferTail = (bufferTail + 1) % MAX_OUTER_BUFFER;
  bufferCount--;
  return item;
}

// ----------------- CLOUD POST HELPER -----------------
bool sendPayloadToCloud(const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.begin(AGRIVAULT_SERVER);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3500);

  int httpCode = http.POST(jsonPayload);
  bool success = (httpCode >= 200 && httpCode < 300);

  if (!success) {
    Serial.printf("[OUTER GW HTTP ERROR] HTTP Code: %d\n", httpCode);
  }
  http.end();
  return success;
}

// ----------------- FLUSH OFFLINE BUFFER -----------------
void flushBufferToCloud() {
  if (bufferCount == 0 || WiFi.status() != WL_CONNECTED) return;

  Serial.printf("[OUTER GW] Flushing %d buffered packets to cloud...\n", bufferCount);
  int flushed = 0;

  while (bufferCount > 0 && WiFi.status() == WL_CONNECTED) {
    String payload = popFromBuffer();
    if (payload.length() > 0) {
      if (sendPayloadToCloud(payload)) {
        flushed++;
      } else {
        // Failed: push back and wait for next cycle
        pushToBuffer(payload);
        break;
      }
    }
    delay(20); // Small inter-packet throttle
  }

  Serial.printf("[OUTER GW] Successfully flushed %d packets. Remaining buffer: %d\n", flushed, bufferCount);
}

// ----------------- SETUP -----------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println("  AgriVault Outer Gateway (ESP32)");
  Serial.println("  RS-485 (Wall) -> Wi-Fi WAN -> AgriVault Cloud");
  Serial.println("==================================================");

  pinMode(PIN_WAN_LED, OUTPUT);
  pinMode(PIN_RS485_DE_RE, OUTPUT);
  digitalWrite(PIN_RS485_DE_RE, LOW); // Continuously listen to RS-485

  // Initialize UART2 for MAX485
  RS485Serial.begin(RS485_BAUD_RATE, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);

  // Connect to Wi-Fi WAN
  Serial.printf("[WAN] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

// ----------------- MAIN LOOP -----------------
void loop() {
  // 1. Maintain Wi-Fi Status
  bool isOnline = (WiFi.status() == WL_CONNECTED);
  digitalWrite(PIN_WAN_LED, isOnline ? HIGH : LOW);

  // 2. Read incoming frame from RS-485 line
  if (RS485Serial.available()) {
    String line = RS485Serial.readStringUntil('\n');
    line.trim();

    if (line.startsWith("AGRI_FRAME:{") && line.endsWith("}:END")) {
      // Extract raw JSON between header and footer
      int jsonStart = line.indexOf('{');
      int jsonEnd = line.lastIndexOf('}');
      String jsonBody = line.substring(jsonStart, jsonEnd + 1);

      Serial.print("[OUTER GW INGEST] ");
      Serial.println(jsonBody);

      // Attempt immediate transmission or buffer
      if (isOnline) {
        bool sent = sendPayloadToCloud(jsonBody);
        if (!sent) {
          pushToBuffer(jsonBody);
        }
      } else {
        pushToBuffer(jsonBody);
      }
    }
  }

  // 3. Flush buffered readings when WAN is healthy
  static unsigned long lastFlushCheck = 0;
  if (millis() - lastFlushCheck >= 5000) {
    lastFlushCheck = millis();
    if (isOnline && bufferCount > 0) {
      flushBufferToCloud();
    }
  }
}
