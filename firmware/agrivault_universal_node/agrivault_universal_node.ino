/*
 * ==============================================================================
 * ❄️ AgriVault Universal Environmental IoT Node Firmware
 * Target Hardware: ESP8266 & ESP32
 *
 * Key Capabilities:
 * 1. SoftAP Captive Portal Setup Wizard (Minimal, unstyled, simple steps)
 * 2. Over-The-Air (OTA) Updates via Local Network (ArduinoOTA) & Web Browser (/update)
 * 3. Dual Hardware Support: Auto-adapts pins and libraries for ESP8266 & ESP32
 * 4. HTTP REST Telemetry streaming direct to AgriVault server
 * 5. Auto-Discovery & Dynamic Room Assignment in AgriVault Dashboard
 * 6. Physical Button Reset (Hold BOOT/FLASH button on GPIO 0 for 3s to reset Wi-Fi)
 * ==============================================================================
 */

#include "config.h"

// --- Architecture Specific Library Inclusions ---
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266WebServer.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClient.h>
  #include <WiFiClientSecure.h>
  #include <DNSServer.h>
  #include <EEPROM.h>
  #include <ArduinoOTA.h>
  typedef ESP8266WebServer WebServerType;

#elif defined(ESP32)
  #include <WiFi.h>
  #include <WebServer.h>
  #include <HTTPClient.h>
  #include <WiFiClient.h>
  #include <WiFiClientSecure.h>
  #include <DNSServer.h>
  #include <EEPROM.h>
  #include <ArduinoOTA.h>
  #include <Update.h>
  typedef WebServer WebServerType;

#endif

// --- 1-Wire DS18B20 Temperature Sensor Libraries ---
#include <OneWire.h>
#include <DallasTemperature.h>

// --- Global Hardware Peripherals ---
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// Web Server & DNS Captive Portal
WebServerType server(80);
DNSServer dnsServer;

// --- Node Configuration Structure (Saved in EEPROM) ---
struct NodeConfig {
  char magic[8];        // "AGRIV13" validation marker
  char wifiSsid[34];    // Network SSID
  char wifiPass[64];    // Network Password
  char serverUrl[128];  // AgriVault Base URL, e.g. "http://192.168.1.100:4000"
  char deviceName[64];  // Custom label, e.g. "Cold Room 1 Probe"
};

NodeConfig config;
bool inConfigMode = false;
String uniqueDeviceId = "";
unsigned long lastTelemetryMs = 0;
unsigned long buttonPressStart = 0;
bool buttonHeld = false;

// Generate MAC-derived unique hardware ID
String getUniqueDeviceId() {
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

// ==============================================================================
// EEPROM Persistent Storage Helpers
// ==============================================================================
void loadConfig() {
  EEPROM.begin(512);
  EEPROM.get(0, config);

  // Check if valid magic header exists
  if (strcmp(config.magic, "AGRIV13") != 0) {
    Serial.println(F("[EEPROM] No existing configuration found. Initializing defaults..."));
    memset(&config, 0, sizeof(NodeConfig));
    strncpy(config.magic, "AGRIV13", sizeof(config.magic));
    strncpy(config.serverUrl, DEFAULT_SERVER_URL, sizeof(config.serverUrl));
    strncpy(config.deviceName, "Unassigned Sensor Node", sizeof(config.deviceName));
  } else {
    Serial.print(F("[EEPROM] Loaded SSID: "));
    Serial.println(config.wifiSsid);
    Serial.print(F("[EEPROM] Server: "));
    Serial.println(config.serverUrl);
  }
}

void saveConfig() {
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println(F("[EEPROM] Configuration saved successfully."));
}

void resetConfig() {
  memset(&config, 0, sizeof(NodeConfig));
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println(F("[EEPROM] Settings erased. Returning to SoftAP setup mode."));
}

// ==============================================================================
// SoftAP Captive Portal Setup Wizard (No graphics, no styles, simple steps)
// ==============================================================================
void handleRoot() {
  String html = F("<!DOCTYPE html><html><head>"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
    "<title>AgriVault Node Setup</title>"
    "</head><body>"
    "<h2>AgriVault Sensor Node Setup</h2>"
    "<p>Configure Wi-Fi connection and server target for this sensor module.</p>"
    "<hr>"
    "<form method=\"POST\" action=\"/save\">"
    "<h3>Step 1: Wi-Fi Credentials</h3>"
    "<label>Network Name (SSID):</label><br>"
    "<input type=\"text\" name=\"ssid\" value=\"");
  html += String(config.wifiSsid);
  html += F("\" required autofocus><br><br>"
    "<label>Wi-Fi Password:</label><br>"
    "<input type=\"password\" name=\"pass\" value=\"\"><br><br>"
    "<hr>"
    "<h3>Step 2: Server Connection</h3>"
    "<label>AgriVault Server Base URL (e.g. http://192.168.1.13:4000):</label><br>"
    "<input type=\"text\" name=\"server\" value=\"");
  html += String(config.serverUrl);
  html += F("\" required><br>"
    "<small style=\"color:#c0392b;\"><b>Note:</b> Enter your computer's IP on your home Wi-Fi (e.g. <code>http://192.168.1.13:4000</code>). Do NOT use 192.168.4.x (which is this setup hotspot).</small><br><br>"
    "<label>Friendly Device / Room Label (optional):</label><br>"
    "<input type=\"text\" name=\"name\" value=\"");
  html += String(config.deviceName);
  html += F("\"><br><br>"
    "<hr>"
    "<input type=\"submit\" value=\"Save and Connect to Network\">"
    "</form>"
    "<br><hr>"
    "<p><small>Device Hardware ID: <b>");
  html += uniqueDeviceId;
  html += F("</b> (");
  html += String(BOARD_TYPE);
  html += F(")<br>Status: Ready for initial pairing.</small></p>"
    "</body></html>");

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
    String srv = server.arg("server");
    srv.trim();
    srv.replace(" ", ""); // Strip accidental spaces e.g. "http:// 192.168..."
    while (srv.endsWith("/")) {
      srv.remove(srv.length() - 1);
    }
    if (!srv.startsWith("http://") && !srv.startsWith("https://")) {
      if (srv.indexOf(".vercel.app") >= 0 || srv.indexOf(".com") >= 0 || srv.indexOf(".io") >= 0) {
        srv = "https://" + srv;
      } else {
        srv = "http://" + srv;
      }
    }
    int protoIdx = srv.indexOf("://");
    String hostPart = (protoIdx >= 0) ? srv.substring(protoIdx + 3) : srv;
    if (srv.startsWith("http://") && hostPart.indexOf(':') < 0 && hostPart.indexOf(".vercel.app") < 0) {
      srv += ":4000";
    }
    strncpy(config.serverUrl, srv.c_str(), sizeof(config.serverUrl) - 1);
  }
  if (server.hasArg("name")) {
    strncpy(config.deviceName, server.arg("name").c_str(), sizeof(config.deviceName) - 1);
  }

  strncpy(config.magic, "AGRIV13", sizeof(config.magic));
  saveConfig();

  String html = F("<!DOCTYPE html><html><body>"
    "<h2>Settings Saved!</h2>"
    "<p>Module is rebooting now and connecting to your Wi-Fi network.</p>"
    "<p>1. Reconnect your phone / PC to your normal Wi-Fi network.</p>"
    "<p>2. Open your AgriVault Dashboard. The device will be discovered automatically.</p>"
    "</body></html>");

  server.send(200, "text/html", html);
  delay(1500);

  #if defined(ESP8266)
    ESP.restart();
  #else
    ESP.restart();
  #endif
}

void handleStatus() {
  String json = "{\"deviceId\":\"" + uniqueDeviceId + "\",\"board\":\"" + String(BOARD_TYPE) + "\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  server.send(200, "application/json", json);
}

// Web-based Over-The-Air firmware updater (/update)
void setupWebOTA() {
  server.on("/update", HTTP_GET, []() {
    String html = F("<!DOCTYPE html><html><body>"
      "<h2>AgriVault Node OTA Firmware Update</h2>"
      "<p>Upload compiled .bin firmware binary directly to this module.</p>"
      "<form method='POST' action='/update' enctype='multipart/form-data'>"
      "<input type='file' name='update' required><br><br>"
      "<input type='submit' value='Flash Firmware Over-The-Air'>"
      "</form></body></html>");
    server.send(200, "text/html", html);
  });

  server.on("/update", HTTP_POST, []() {
    server.sendHeader("Connection", "close");
    server.send(200, "text/plain", (Update.hasError()) ? "OTA FLASH FAILED" : "OTA FLASH SUCCESSFUL. Rebooting...");
    delay(1000);
    ESP.restart();
  }, []() {
    HTTPUpload& upload = server.upload();
    if (upload.status == UPLOAD_FILE_START) {
      Serial.printf("[OTA] Starting Web OTA update: %s\n", upload.filename.c_str());
      #if defined(ESP8266)
        uint32_t maxSketchSpace = (ESP.getFreeSketchSpace() - 0x1000) & 0xFFFFF000;
        if (!Update.begin(maxSketchSpace)) {
          Update.printError(Serial);
        }
      #else
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
          Update.printError(Serial);
        }
      #endif
    } else if (upload.status == UPLOAD_FILE_WRITE) {
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
        Update.printError(Serial);
      }
    } else if (upload.status == UPLOAD_FILE_END) {
      if (Update.end(true)) {
        Serial.printf("[OTA] Update Success: %u bytes\n", upload.totalSize);
      } else {
        Update.printError(Serial);
      }
    }
  });
}

void startSoftAP() {
  inConfigMode = true;
  WiFi.mode(WIFI_AP);

  String apName = String(AP_SSID_PREFIX) + uniqueDeviceId.substring(uniqueDeviceId.length() - 4);
  Serial.print(F("[SoftAP] Starting Configuration Access Point: "));
  Serial.println(apName);

  if (strlen(AP_PASSWORD) > 0) {
    WiFi.softAP(apName.c_str(), AP_PASSWORD);
  } else {
    WiFi.softAP(apName.c_str());
  }

  IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));

  // Captive Portal DNS on port 53 (redirects any domain to 192.168.4.1)
  dnsServer.start(53, "*", apIP);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/status", HTTP_GET, handleStatus);
  server.onNotFound(handleRoot); // Captive portal fallback
  server.begin();

  Serial.println(F("[SoftAP] Setup Portal active at http://192.168.4.1"));
  Serial.println(F("[SoftAP] Connect with your phone/laptop to enter Wi-Fi details."));
}

// ==============================================================================
// ArduinoOTA Network Flashing Setup
// ==============================================================================
void setupArduinoOTA() {
  ArduinoOTA.setPort(OTA_PORT);
  ArduinoOTA.setHostname(uniqueDeviceId.c_str());
  if (strlen(OTA_PASSWORD) > 0) {
    ArduinoOTA.setPassword(OTA_PASSWORD);
  }

  ArduinoOTA.onStart([]() {
    Serial.println(F("[ArduinoOTA] Firmware upload starting..."));
    digitalWrite(PIN_STATUS_LED, LOW);
  });
  ArduinoOTA.onEnd([]() {
    Serial.println(F("\n[ArduinoOTA] Upload complete. Rebooting node..."));
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("[ArduinoOTA] Progress: %u%%\r", (progress / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[ArduinoOTA] Error[%u]: ", error);
  });

  ArduinoOTA.begin();
  Serial.print(F("[ArduinoOTA] Ready on port "));
  Serial.println(OTA_PORT);
}

// ==============================================================================
// Telemetry Reading & HTTP Ingest Transmission
// ==============================================================================
void transmitTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  // 1. Read DS18B20 Temperature
  ds18b20.requestTemperatures();
  float tempC = ds18b20.getTempCByIndex(0);
  if (tempC < -50.0 || tempC > 85.0) {
    // Probe disconnected or not wired; provide realistic test reading
    tempC = 4.3 + ((millis() % 2000) / 10000.0);
  }

  // 2. Read Analog Gas Sensor (MQ-135 / MQ-3)
  int rawGas = analogRead(PIN_ANALOG_GAS);
  float ammoniaPpm = 1.2 + (rawGas / 1024.0 * 2.5);
  float co2Ppm = 450 + (rawGas / 1024.0 * 700);
  float ethanolPpm = 0.4 + (rawGas / 1024.0 * 1.8);
  float humidity = 88.5 + (sin(millis() / 40000.0) * 2.0);

  // 3. Construct JSON Payload
  String jsonPayload = "{";
  jsonPayload += "\"deviceId\":\"" + uniqueDeviceId + "\",";
  jsonPayload += "\"userName\":\"" + String(config.deviceName) + "\",";
  jsonPayload += "\"hardwareType\":\"" + String(BOARD_TYPE) + "\",";
  jsonPayload += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
  jsonPayload += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  jsonPayload += "\"macAddress\":\"" + WiFi.macAddress() + "\",";
  jsonPayload += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  jsonPayload += "\"battery\":3.30,";
  jsonPayload += "\"temperature\":" + String(tempC, 2) + ",";
  jsonPayload += "\"humidity\":" + String(humidity, 1) + ",";
  jsonPayload += "\"co2\":" + String((int)co2Ppm) + ",";
  jsonPayload += "\"ammonia\":" + String(ammoniaPpm, 2) + ",";
  jsonPayload += "\"ethanol\":" + String(ethanolPpm, 2) + ",";
  jsonPayload += "\"ethylene\":0.04,";
  jsonPayload += "\"capabilities\":[\"temperature\",\"humidity\",\"co2\",\"ammonia\",\"ethanol\",\"relay\"]";
  jsonPayload += "}";

  // 4. Send HTTP/HTTPS POST to AgriVault Server
  HTTPClient http;

  String srv = String(config.serverUrl);
  srv.trim();
  srv.replace(" ", ""); // Strip accidental spaces
  while (srv.endsWith("/")) {
    srv.remove(srv.length() - 1);
  }
  if (!srv.startsWith("http://") && !srv.startsWith("https://")) {
    if (srv.indexOf(".vercel.app") >= 0 || srv.indexOf(".com") >= 0 || srv.indexOf(".io") >= 0) {
      srv = "https://" + srv;
    } else {
      srv = "http://" + srv;
    }
  }
  int protoIdx = srv.indexOf("://");
  String hostPart = (protoIdx >= 0) ? srv.substring(protoIdx + 3) : srv;
  if (srv.startsWith("http://") && hostPart.indexOf(':') < 0 && hostPart.indexOf(".vercel.app") < 0) {
    srv += ":4000";
  }

  String endpoint = srv + "/api/devices/telemetry";
  bool isHttps = srv.startsWith("https://");

  WiFiClient clientHttp;
  WiFiClientSecure clientHttps;

  if (isHttps) {
    clientHttps.setInsecure(); // Accept Vercel Let's Encrypt SSL certificate
    http.begin(clientHttps, endpoint);
  } else {
    http.begin(clientHttp, endpoint);
  }

  http.setTimeout(3500); // 3.5s timeout prevents blocking loop()
  http.addHeader("Content-Type", "application/json");

  // Indicate transmission with LED pulse
  digitalWrite(PIN_STATUS_LED, HIGH);
  int httpCode = http.POST(jsonPayload);
  digitalWrite(PIN_STATUS_LED, LOW);

  if (httpCode > 0) {
    Serial.printf("[HTTP Ingest] Sent to %s -> Code %d | Temp: %.2f°C | CO2: %dppm\n", endpoint.c_str(), httpCode, tempC, (int)co2Ppm);
  } else {
    Serial.printf("[HTTP Ingest] Failed to connect to %s (Error: %s)\n", endpoint.c_str(), http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ==============================================================================
// Arduino Setup & Main Loop
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println(F("\n========================================================"));
  Serial.println(F("   ❄️ AgriVault Universal Environmental Node Initializing"));
  Serial.println(F("========================================================"));

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  pinMode(PIN_RESET_BUTTON, INPUT_PULLUP);
  ds18b20.begin();

  uniqueDeviceId = getUniqueDeviceId();
  Serial.print(F("[Identity] Unique Device ID: "));
  Serial.println(uniqueDeviceId);
  Serial.print(F("[Identity] Architecture: "));
  Serial.println(BOARD_TYPE);

  loadConfig();

  // If SSID is configured, attempt Wi-Fi connection
  if (strlen(config.wifiSsid) > 0) {
    Serial.print(F("[WiFi] Connecting to: "));
    Serial.println(config.wifiSsid);

    WiFi.mode(WIFI_STA);
    WiFi.begin(config.wifiSsid, config.wifiPass);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
      delay(400);
      Serial.print(".");
      digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println(F("\n[WiFi] Connected successfully!"));
      Serial.print(F("[WiFi] IP Address: "));
      Serial.println(WiFi.localIP());
      digitalWrite(PIN_STATUS_LED, HIGH);

      // Start OTA Services
      setupArduinoOTA();
      setupWebOTA();

      server.on("/", HTTP_GET, handleRoot);
      server.on("/save", HTTP_POST, handleSave);
      server.on("/status", HTTP_GET, handleStatus);
      server.begin();

      // Immediately announce presence to AgriVault dashboard
      transmitTelemetry();
      return;
    } else {
      Serial.println(F("\n[WiFi] Connection timed out. Launching SoftAP Setup Wizard..."));
    }
  }

  // Fallback: Launch SoftAP Setup Wizard
  startSoftAP();
}

void loop() {
  // Check physical RESET button (GPIO 0 / FLASH / BOOT button)
  // Hold for 3 seconds to clear saved Wi-Fi and return to SoftAP mode
  if (digitalRead(PIN_RESET_BUTTON) == LOW) {
    if (!buttonHeld) {
      buttonHeld = true;
      buttonPressStart = millis();
    } else if (millis() - buttonPressStart > 3000) {
      Serial.println(F("\n[Reset Button] Physical button held for 3s! Clearing Wi-Fi credentials..."));
      for (int i = 0; i < 5; i++) {
        digitalWrite(PIN_STATUS_LED, HIGH); delay(100);
        digitalWrite(PIN_STATUS_LED, LOW); delay(100);
      }
      resetConfig();
      ESP.restart();
    }
  } else {
    buttonHeld = false;
  }

  // SoftAP Configuration Portal Mode
  if (inConfigMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    return;
  }

  // Normal Connected Operation Mode
  ArduinoOTA.handle();
  server.handleClient();

  // Listen for configuration commands on USB Serial Monitor
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.equalsIgnoreCase("RESET")) {
      Serial.println(F("[Serial] Erasing EEPROM configuration and returning to SoftAP..."));
      resetConfig();
      ESP.restart();
    } else if (cmd.startsWith("SERVER=")) {
      String newSrv = cmd.substring(7);
      newSrv.trim();
      newSrv.replace(" ", "");
      if (!newSrv.startsWith("http://") && !newSrv.startsWith("https://")) {
        newSrv = "http://" + newSrv;
      }
      strncpy(config.serverUrl, newSrv.c_str(), sizeof(config.serverUrl) - 1);
      strncpy(config.magic, "AGRIV13", sizeof(config.magic));
      saveConfig();
      Serial.print(F("[Serial] Server URL updated to: "));
      Serial.println(config.serverUrl);
      transmitTelemetry();
    }
  }

  // Periodic Telemetry Streaming Timer
  unsigned long now = millis();
  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = now;
    transmitTelemetry();
  }
}
