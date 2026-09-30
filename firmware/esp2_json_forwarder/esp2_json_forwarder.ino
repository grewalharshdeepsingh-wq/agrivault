/*
 * ==============================================================================
 * ❄️ AgriVault ESP #2 — Dual-Node JSON Gateway & Cloud Forwarder
 * ==============================================================================
 *
 * Role:
 *   - Receives raw sensor packets from ESP #1 (Sensor Collector) via UART Serial2.
 *   - Auto-discovers on the AgriVault website immediately on power-up.
 *   - Encapsulates readings into the official AgriVault JSON schema.
 *   - Streams telemetry to the AgriVault server over Wi-Fi every 1 second.
 *
 * Easy Wi-Fi Configuration (No code re-flashing required!):
 *   Method 1 (Phone/Laptop SoftAP Web Portal):
 *     - If Wi-Fi fails to connect, or if you hold the FLASH/BOOT button (GPIO 0)
 *       for 3 seconds, ESP #2 creates a Wi-Fi Access Point: "AgriVault-ESP2-Setup".
 *     - Connect to it and visit http://192.168.4.1 in your browser.
 *     - Select your Wi-Fi, enter password, enter server URL, and click Save.
 *   Method 2 (USB Serial Console):
 *     - Open Serial Monitor at 115200 baud and type:
 *         WIFI=YourSSID,YourPassword
 *         SERVER=http://192.168.1.100:4000 (or https://your-app.vercel.app)
 *         STATUS  (checks current connection)
 *         RESET   (erases Wi-Fi and starts setup portal)
 *
 * Hardware Wiring from ESP #1:
 *   ESP #1 TX2 (GPIO 17) ──► ESP #2 RX (D5 on ESP8266, GPIO 5 on ESP32)
 *   ESP #1 GND           ──► ESP #2 GND  (REQUIRED: COMMON GROUND)
 * ==============================================================================
 */

#include "config.h"

// --- Architecture Specific Inclusions ---
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266WebServer.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClient.h>
  #include <WiFiClientSecure.h>
  #include <DNSServer.h>
  #include <EEPROM.h>
  #include <SoftwareSerial.h>
  typedef ESP8266WebServer WebServerType;
  SoftwareSerial BridgeSerial(BRIDGE_RX_PIN, BRIDGE_TX_PIN); // RX=D5(GPIO14), TX=D6(GPIO12)

#elif defined(ESP32)
  #include <WiFi.h>
  #include <WebServer.h>
  #include <HTTPClient.h>
  #include <WiFiClient.h>
  #include <WiFiClientSecure.h>
  #include <DNSServer.h>
  #include <EEPROM.h>
  typedef WebServer WebServerType;
  #define BridgeSerial Serial2

#else
  #error "Unsupported board — please select ESP32 or ESP8266 in Arduino IDE"
#endif

// --- EEPROM Configuration Structure ---
struct ForwarderConfig {
  char magic[8];        // "AGRV21" validation header
  char wifiSsid[34];    // Wi-Fi SSID
  char wifiPass[64];    // Wi-Fi Password
  char serverUrl[128];  // Server Base URL (e.g. "http://192.168.1.100:4000")
};

ForwarderConfig config;
WebServerType server(80);
DNSServer dnsServer;

bool inConfigMode = false;
String forwarderId = "";
String incomingBuffer = "";
unsigned long lastHeartbeatMs = 0;
unsigned long lastWifiCheckMs = 0;
unsigned long buttonPressStart = 0;
bool buttonHeld = false;

uint32_t packetCount   = 0;
uint32_t postOkCount   = 0;
uint32_t postFailCount = 0;

// Sensor reading structure from ESP #1
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

// ── Build unique MAC-derived Forwarder ID ──────────────────────────────────
String getForwarderId() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[20];
  #if defined(ESP8266)
    snprintf(buf, sizeof(buf), "ESP8266-%02X%02X%02X", mac[3], mac[4], mac[5]);
  #else
    snprintf(buf, sizeof(buf), "ESP32-%02X%02X%02X", mac[3], mac[4], mac[5]);
  #endif
  return String(buf);
}

// ── Sanitize Server URL & append /api/devices/telemetry ────────────────────
String getTelemetryEndpoint(String base) {
  base.trim();
  base.replace(" ", "");
  while (base.endsWith("/")) {
    base.remove(base.length() - 1);
  }
  // Strip duplicate subpaths if accidentally entered by user
  if (base.endsWith("/api/devices/telemetry")) {
    base.remove(base.length() - 22);
  } else if (base.endsWith("/devices/telemetry")) {
    base.remove(base.length() - 18);
  } else if (base.endsWith("/api/devices")) {
    base.remove(base.length() - 12);
  } else if (base.endsWith("/devices")) {
    base.remove(base.length() - 8);
  } else if (base.endsWith("/api")) {
    base.remove(base.length() - 4);
  }
  while (base.endsWith("/")) {
    base.remove(base.length() - 1);
  }

  // Prepend protocol if missing
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    if (base.indexOf(".vercel.app") >= 0 || base.indexOf(".com") >= 0 || base.indexOf(".io") >= 0) {
      base = "https://" + base;
    } else {
      base = "http://" + base;
    }
  }

  // If local IP without port, default port 4000
  int protoIdx = base.indexOf("://");
  String hostPart = (protoIdx >= 0) ? base.substring(protoIdx + 3) : base;
  if (base.startsWith("http://") && hostPart.indexOf(':') < 0 && hostPart.indexOf('.') >= 0 && hostPart.indexOf(".vercel.app") < 0) {
    base += ":4000";
  }

  return base + "/api/devices/telemetry";
}

// ── EEPROM Helpers ────────────────────────────────────────────────────────
void loadConfig() {
  EEPROM.begin(512);
  EEPROM.get(0, config);

  if (strcmp(config.magic, "AGRV21") != 0) {
    Serial.println(F("[EEPROM] No saved configuration. Loading defaults..."));
    memset(&config, 0, sizeof(ForwarderConfig));
    strncpy(config.magic, "AGRV21", sizeof(config.magic));
    strncpy(config.wifiSsid, DEFAULT_WIFI_SSID, sizeof(config.wifiSsid));
    strncpy(config.wifiPass, DEFAULT_WIFI_PASSWORD, sizeof(config.wifiPass));
    strncpy(config.serverUrl, DEFAULT_SERVER_URL, sizeof(config.serverUrl));
  } else {
    Serial.print(F("[EEPROM] Loaded Wi-Fi SSID: ")); Serial.println(config.wifiSsid);
    Serial.print(F("[EEPROM] Loaded Server: ")); Serial.println(config.serverUrl);
  }
}

void saveConfig() {
  strncpy(config.magic, "AGRV21", sizeof(config.magic));
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println(F("[EEPROM] Configuration saved successfully."));
}

void resetConfig() {
  memset(&config, 0, sizeof(ForwarderConfig));
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println(F("[EEPROM] Configuration erased."));
}

// ── SoftAP Captive Portal HTML ────────────────────────────────────────────
void handleRoot() {
  String html = F("<!DOCTYPE html><html><head>"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
    "<title>AgriVault Gateway Setup</title>"
    "<style>"
    "body{font-family:sans-serif;background:#090d16;color:#f1f5f9;padding:20px;max-width:480px;margin:auto;}"
    "h2{color:#10b981;}input,select{width:100%;padding:10px;margin:8px 0 16px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#fff;box-sizing:border-box;}"
    "button{width:100%;background:#10b981;color:#fff;border:none;padding:12px;font-size:16px;font-weight:bold;border-radius:6px;cursor:pointer;}"
    ".note{color:#94a3b8;font-size:13px;}"
    "</style></head><body>"
    "<h2>AgriVault Wi-Fi Setup</h2>"
    "<p>Configure the Wi-Fi network and AgriVault server for your ESP nodes.</p>"
    "<form method=\"POST\" action=\"/save\">"
    "<label><b>Wi-Fi Network (SSID):</b></label><br>"
    "<input type=\"text\" name=\"ssid\" value=\"");
  html += String(config.wifiSsid);
  html += F("\" placeholder=\"Your Wi-Fi SSID\" required autofocus><br>"
    "<label><b>Wi-Fi Password:</b></label><br>"
    "<input type=\"password\" name=\"pass\" value=\"\" placeholder=\"Network Password\"><br>"
    "<label><b>AgriVault Server Base URL:</b></label><br>"
    "<input type=\"text\" name=\"server\" value=\"");
  html += String(config.serverUrl);
  html += F("\" placeholder=\"http://192.168.1.100:4000 or https://app.vercel.app\" required><br>"
    "<p class=\"note\">Tip: For local PC monitoring use http://&lt;PC_IP&gt;:4000. For cloud use your Vercel URL.</p>"
    "<button type=\"submit\">Save & Connect</button>"
    "</form></body></html>");
  server.send(200, "text/html", html);
}

void handleSave() {
  if (server.hasArg("ssid")) {
    strncpy(config.wifiSsid, server.arg("ssid").c_str(), sizeof(config.wifiSsid) - 1);
  }
  if (server.hasArg("pass")) {
    strncpy(config.wifiPass, server.arg("pass").c_str(), sizeof(config.wifiPass) - 1);
  }
  if (server.hasArg("server")) {
    strncpy(config.serverUrl, server.arg("server").c_str(), sizeof(config.serverUrl) - 1);
  }

  saveConfig();

  String html = F("<!DOCTYPE html><html><body style=\"font-family:sans-serif;background:#090d16;color:#10b981;text-align:center;padding:40px;\">"
    "<h2>Configuration Saved!</h2>"
    "<p style=\"color:#f1f5f9;\">The ESP Gateway is restarting and connecting to your Wi-Fi...</p>"
    "</body></html>");
  server.send(200, "text/html", html);
  delay(1500);
  ESP.restart();
}

void startSoftAP() {
  inConfigMode = true;
  WiFi.disconnect();
  delay(100);

  String apName = "AgriVault-ESP2-" + forwarderId.substring(forwarderId.length() - 4);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str(), AP_PASSWORD);

  IPAddress apIP(192, 168, 4, 1);
  IPAddress netMsk(255, 255, 255, 0);
  WiFi.softAPConfig(apIP, apIP, netMsk);

  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", apIP);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
  });
  server.begin();

  Serial.println(F("\n========================================================"));
  Serial.print(F(" [SoftAP] Web Wizard Active: ")); Serial.println(apName);
  Serial.println(F(" Connect phone to Wi-Fi and open: http://192.168.4.1"));
  Serial.println(F("========================================================\n"));

  // Fast blink to show setup mode
  for (int i = 0; i < 6; i++) {
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    delay(100);
  }
}

// ── Connect to Wi-Fi ──────────────────────────────────────────────────────
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  if (strlen(config.wifiSsid) == 0) {
    Serial.println(F("[WiFi] No SSID configured. Entering SoftAP mode..."));
    startSoftAP();
    return false;
  }

  Serial.print(F("[WiFi] Connecting to: "));
  Serial.println(config.wifiSsid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(config.wifiSsid, config.wifiPass);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 25) {
    delay(400);
    Serial.print(F("."));
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("\n[WiFi] Connected! IP: "));
    Serial.println(WiFi.localIP());
    digitalWrite(PIN_STATUS_LED, HIGH);
    inConfigMode = false;
    return true;
  } else {
    Serial.println(F("\n[WiFi] Connection failed! Starting SoftAP portal..."));
    digitalWrite(PIN_STATUS_LED, LOW);
    startSoftAP();
    return false;
  }
}

// ── Transmit JSON Payload to AgriVault Server ──────────────────────────────
bool sendPayload(const String& json) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String endpoint = getTelemetryEndpoint(String(config.serverUrl));
  bool isHttps = endpoint.startsWith("https://");

  WiFiClient clientHttp;
  WiFiClientSecure clientHttps;

  if (isHttps) {
    #if defined(ESP8266)
      clientHttps.setInsecure();
      clientHttps.setBufferSizes(1024, 1024);
      clientHttps.setTimeout(HTTP_TIMEOUT_MS);
      http.begin(clientHttps, endpoint);
    #elif defined(ESP32)
      clientHttps.setInsecure();
      clientHttps.setTimeout(HTTP_TIMEOUT_MS);
      http.begin(clientHttps, endpoint);
    #endif
  } else {
    http.begin(clientHttp, endpoint);
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(json);
  bool ok = (code == 200 || code == 201);

  if (ok) {
    postOkCount++;
    Serial.print(F("[HTTP] ACK "));
    Serial.print(code);
    Serial.print(F(" | Sent to "));
    Serial.print(endpoint);
    Serial.print(F(" | ok="));
    Serial.println(postOkCount);
  } else {
    postFailCount++;
    Serial.print(F("[HTTP] POST Failed code="));
    Serial.print(code);
    Serial.print(F(" target="));
    Serial.println(endpoint);
  }

  http.end();
  return ok;
}

// ── Send Discovery / Heartbeat Packet to AgriVault ─────────────────────────
void sendDiscoveryHeartbeat() {
  String json = "{";
  json += "\"deviceId\":\""      + forwarderId           + "\",";
  json += "\"hardwareType\":\""  + String(HARDWARE_TYPE) + "\",";
  json += "\"facilityId\":\""    + String(FACILITY_ID)   + "\",";
  json += "\"rssi\":"            + String(WiFi.RSSI())   + ",";
  json += "\"battery\":3.30,";
  json += "\"capabilities\":[\"temperature\",\"humidity\",\"co2\",\"ammonia\",\"ethanol\",\"relay\"],";
  json += "\"temperature\":0,";
  json += "\"humidity\":0,";
  json += "\"co2\":0,";
  json += "\"status\":\"DISCOVERY_ONLINE\"";
  json += "}";

  Serial.println(F("[Discovery] Broadcasting online discovery beacon to AgriVault..."));
  sendPayload(json);
}

// ── Parse Pipe-delimited packet from ESP #1 ────────────────────────────────
bool parsePacket(const String& line, SensorReading& out) {
  if (!line.startsWith(PACKET_HEADER)) {
    return false;
  }

  String fields[10];
  int fieldCount = 0;
  int start = 0;

  for (int i = 0; i <= line.length() && fieldCount < 10; i++) {
    if (i == (int)line.length() || line[i] == '|') {
      fields[fieldCount++] = line.substring(start, i);
      start = i + 1;
    }
  }

  if (fieldCount < 10) return false;

  out.deviceId   = fields[1];
  out.tempC      = fields[2].toFloat();
  out.humidity   = fields[3].toFloat();
  out.co2        = (int)fields[4].toFloat();
  out.ammonia    = fields[5].toFloat();
  out.ethanol    = fields[6].toFloat();
  out.battery    = fields[7].toFloat();
  out.rssi       = (int)fields[8].toFloat();
  out.relayState = (int)fields[9].toFloat();
  out.valid      = true;

  return true;
}

// ── Assemble JSON from SensorReading ───────────────────────────────────────
String buildJson(const SensorReading& r) {
  String json = "{";
  json += "\"deviceId\":\""      + r.deviceId                 + "\",";
  json += "\"hardwareType\":\""  + String(HARDWARE_TYPE)      + "\",";
  json += "\"facilityId\":\""    + String(FACILITY_ID)        + "\",";
  json += "\"forwarderId\":\""   + forwarderId                + "\",";
  json += "\"temperature\":"     + String(r.tempC, 2)         + ",";
  json += "\"humidity\":"        + String(r.humidity, 1)      + ",";
  json += "\"co2\":"             + String(r.co2)              + ",";
  json += "\"ethylene\":0.04,";
  json += "\"ammonia\":"         + String(r.ammonia, 2)       + ",";
  json += "\"ethanol\":"         + String(r.ethanol, 2)       + ",";
  json += "\"battery\":"         + String(r.battery, 2)       + ",";
  json += "\"rssi\":"            + String(WiFi.RSSI())        + ",";
  json += "\"relayState\":"      + String(r.relayState)       + ",";
  json += "\"capabilities\":[\"temperature\",\"humidity\",\"co2\",\"ammonia\",\"ethanol\",\"relay\"]";
  json += "}";
  return json;
}

// ── Process Console Serial Commands from USB ──────────────────────────────
void processSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd.equalsIgnoreCase("STATUS")) {
    Serial.println(F("\n========== ESP #2 GATEWAY STATUS =========="));
    Serial.print(F("Device ID     : ")); Serial.println(forwarderId);
    Serial.print(F("WiFi Status   : ")); Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
    Serial.print(F("Current SSID  : ")); Serial.println(config.wifiSsid);
    Serial.print(F("Local IP      : ")); Serial.println(WiFi.localIP());
    Serial.print(F("Signal (RSSI) : ")); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
    Serial.print(F("Server URL    : ")); Serial.println(config.serverUrl);
    Serial.print(F("Telemetry URL : ")); Serial.println(getTelemetryEndpoint(String(config.serverUrl)));
    Serial.print(F("Packets Recv  : ")); Serial.println(packetCount);
    Serial.print(F("POST OK/Fail  : ")); Serial.print(postOkCount); Serial.print("/"); Serial.println(postFailCount);
    Serial.println(F("===========================================\n"));
  }
  else if (cmd.startsWith("WIFI=")) {
    String payload = cmd.substring(5);
    int comma = payload.indexOf(',');
    if (comma > 0) {
      String newSsid = payload.substring(0, comma);
      String newPass = payload.substring(comma + 1);
      newSsid.trim(); newPass.trim();
      strncpy(config.wifiSsid, newSsid.c_str(), sizeof(config.wifiSsid) - 1);
      strncpy(config.wifiPass, newPass.c_str(), sizeof(config.wifiPass) - 1);
      saveConfig();
      Serial.println(F("[Console] Wi-Fi updated! Reconnecting..."));
      connectWiFi();
    } else {
      Serial.println(F("[Console] Format error! Use: WIFI=YourSSID,YourPassword"));
    }
  }
  else if (cmd.startsWith("SERVER=")) {
    String newServer = cmd.substring(7);
    newServer.trim();
    strncpy(config.serverUrl, newServer.c_str(), sizeof(config.serverUrl) - 1);
    saveConfig();
    Serial.print(F("[Console] Server URL updated to: ")); Serial.println(config.serverUrl);
    sendDiscoveryHeartbeat();
  }
  else if (cmd.equalsIgnoreCase("RESET")) {
    Serial.println(F("[Console] Erasing EEPROM & starting SoftAP portal..."));
    resetConfig();
    startSoftAP();
  }
  else if (cmd.equalsIgnoreCase("HELP")) {
    Serial.println(F("\nAvailable Commands:"));
    Serial.println(F("  STATUS                  - View connection status & stats"));
    Serial.println(F("  WIFI=SSID,Password      - Change Wi-Fi credentials immediately"));
    Serial.println(F("  SERVER=http://IP:4000   - Change AgriVault server address"));
    Serial.println(F("  RESET                   - Clear settings and start setup portal"));
    Serial.println();
  }
}

// ── Physical Button Check (Hold BOOT/FLASH GPIO 0 for 3s to enter setup) ──
void checkResetButton() {
  if (digitalRead(PIN_RESET_BUTTON) == LOW) {
    if (!buttonHeld) {
      buttonHeld = true;
      buttonPressStart = millis();
    } else if (millis() - buttonPressStart > 3000) {
      Serial.println(F("\n[Button] Physical reset triggered! Starting SoftAP portal..."));
      buttonHeld = false;
      startSoftAP();
    }
  } else {
    buttonHeld = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// setup()
// ══════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);
  pinMode(PIN_RESET_BUTTON, INPUT_PULLUP);

  // Initialize UART bridge to ESP #1
  #if defined(ESP8266)
    BridgeSerial.begin(BRIDGE_BAUD);
    BridgeSerial.setTimeout(SERIAL_TIMEOUT_MS);
  #elif defined(ESP32)
    BridgeSerial.begin(BRIDGE_BAUD, SERIAL_8N1, BRIDGE_RX_PIN, BRIDGE_TX_PIN);
    BridgeSerial.setTimeout(SERIAL_TIMEOUT_MS);
  #endif

  loadConfig();
  forwarderId = getForwarderId();

  Serial.println(F("\n=============================================="));
  Serial.println(F("  ❄️ AgriVault ESP #2 — Cloud Forwarder Gateway"));
  Serial.println(F("=============================================="));
  Serial.print(F("  Device ID    : ")); Serial.println(forwarderId);
  Serial.print(F("  Config Target: ")); Serial.println(config.serverUrl);
  Serial.print(F("  Target API   : ")); Serial.println(getTelemetryEndpoint(String(config.serverUrl)));
  #if defined(ESP8266)
    Serial.println(F("  UART Bridge  : SoftwareSerial RX=D5 (GPIO14) ← ESP#1 TX"));
  #elif defined(ESP32)
    Serial.print(F("  UART Bridge  : Serial2 RX=GPIO")); Serial.print(BRIDGE_RX_PIN);
    Serial.println(F(" ← ESP#1 TX"));
  #endif
  Serial.println(F("==============================================\n"));

  if (connectWiFi()) {
    // Send immediate initial discovery beacon to AgriVault website
    sendDiscoveryHeartbeat();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// loop()
// ══════════════════════════════════════════════════════════════════════════
void loop() {
  // 1. Process USB Serial console commands
  processSerialCommands();

  // 2. Check physical button (Hold for 3s to enter SoftAP setup mode)
  checkResetButton();

  // 3. Handle SoftAP captive portal if in configuration mode
  if (inConfigMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    return;
  }

  // 4. Wi-Fi connection watchdog
  if (millis() - lastWifiCheckMs > 10000) {
    lastWifiCheckMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println(F("[WiFi] Link lost. Attempting reconnect..."));
      WiFi.reconnect();
    }
  }

  // 5. Periodic Discovery Heartbeat (every 15s if ESP #1 hasn't sent data)
  if (millis() - lastHeartbeatMs > HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = millis();
    if (packetCount == 0) {
      sendDiscoveryHeartbeat();
    }
  }

  // 6. Ingest incoming UART serial stream from ESP #1
  while (BridgeSerial.available()) {
    char c = BridgeSerial.read();

    if (c == '\n') {
      incomingBuffer.trim();

      if (incomingBuffer.length() > 4) {
        packetCount++;
        SensorReading r;

        if (parsePacket(incomingBuffer, r)) {
          lastReading = r;
          String json = buildJson(r);

          Serial.print(F("[Forwarding] "));
          Serial.println(json);

          bool ok = sendPayload(json);

          // Fast LED flash on successful transmission
          digitalWrite(PIN_STATUS_LED, ok ? HIGH : LOW);
          delay(25);
          digitalWrite(PIN_STATUS_LED, LOW);
        }
      }
      incomingBuffer = "";
    } else if (c != '\r') {
      if (incomingBuffer.length() < 256) {
        incomingBuffer += c;
      } else {
        incomingBuffer = "";
      }
    }
  }
}
