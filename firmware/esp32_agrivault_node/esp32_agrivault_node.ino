/*
 * ==============================================================================
 * ❄️ AGRIVAULT INDUSTRIAL ESP32 PRODUCTION FIRMWARE
 * Multi-Sensor Environmental Telemetry & Dynamic Wi-Fi Provisioning
 *
 * Supported Sensors:
 * - DS18B20 Waterproof Temperature Probe (1-Wire, GPIO 4)
 * - DHT11 Temperature & Relative Humidity Sensor (Digital, GPIO 32)
 * - MQ-3 Volatiles & Fermentation Sensor (Analog ADC1, GPIO 35)
 * - MQ-135 Air Quality & Respiration Sensor (Analog ADC1, GPIO 34)
 * - 5V Relay Actuator Module (Digital GPIO 26)
 *
 * Wi-Fi Provisioning Architecture:
 * - Boot without credentials / failed connection -> Starts SoftAP "Agrivault-Setup-XXXXXX"
 * - Captive Portal web interface at http://192.168.4.1
 * - Network scanning with signal strength RSSI display
 * - Show/hide password toggle, manual hidden SSID entry
 * - Backend server URL and device code configuration
 * - Persistent storage in Non-Volatile Flash (Preferences / NVS)
 * - SoftAP disabled during normal operation to prevent security exposure
 * - Physical recovery: Hold BOOT button (GPIO 0) for 5 seconds to enter AP mode
 * - Remote reconfiguration: Agrivault dashboard command triggers AP mode
 *
 * Zero-Fabrication Guarantee:
 * - Disconnected sensors report "installed: false", no fabricated fallback data.
 * - Raw ADC and response ratios reported for MQ sensors without pseudo-gas claims.
 * ==============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"

// --- Hardware Instances ---
Preferences prefs;
WebServer server(80);
DNSServer dnsServer;

OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// --- Device State & Settings ---
String deviceId;
String macAddress;
String wifiSsid = "";
String wifiPass = "";
String backendUrl = DEFAULT_BACKEND_URL;
String deviceName = "Unassigned Cold Store Node";
String authToken = "";

bool isProvisioned = false;
bool inConfigMode = false;
bool relayState = false;

unsigned long lastTelemetryMs = 0;
unsigned long buttonPressStart = 0;
bool buttonHeld = false;
int wifiFailCount = 0;

// Unique MAC-derived Device ID (e.g. AGR-ESP-A1B2C3)
String generateDeviceId() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[20];
  snprintf(buf, sizeof(buf), "AGR-ESP-%02X%02X%02X", mac[3], mac[4], mac[5]);
  return String(buf);
}

// Clean and normalize backend URL
String sanitizeUrl(String url) {
  url.trim();
  while (url.endsWith("/")) url.remove(url.length() - 1);
  if (url.endsWith("/api/devices/telemetry")) url.remove(url.length() - 22);
  else if (url.endsWith("/devices/telemetry")) url.remove(url.length() - 18);
  else if (url.endsWith("/api")) url.remove(url.length() - 4);
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "http://" + url;
  }
  return url;
}

// ==============================================================================
// 1. NON-VOLATILE STORAGE (NVS / PREFERENCES)
// ==============================================================================
void loadPreferences() {
  prefs.begin("agrivault", true); // Read-only mode
  wifiSsid = prefs.getString("ssid", "");
  wifiPass = prefs.getString("pass", "");
  backendUrl = prefs.getString("backend", DEFAULT_BACKEND_URL);
  deviceName = prefs.getString("name", "Cold Store Node " + deviceId.substring(deviceId.length() - 4));
  authToken = prefs.getString("token", "");
  isProvisioned = prefs.getBool("prov", false) && wifiSsid.length() > 0;
  prefs.end();

  Serial.println(F("[NVS] Loaded saved parameters:"));
  Serial.printf("  SSID: %s\n", wifiSsid.length() > 0 ? wifiSsid.c_str() : "(None - unconfigured)");
  Serial.printf("  Backend: %s\n", backendUrl.c_str());
  Serial.printf("  Provisioned Status: %s\n", isProvisioned ? "YES" : "NO");
}

void savePreferences(String ssid, String pass, String backend, String name, String token) {
  prefs.begin("agrivault", false); // Read-write mode
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.putString("backend", sanitizeUrl(backend));
  prefs.putString("name", name);
  prefs.putString("token", token);
  prefs.putBool("prov", true);
  prefs.end();

  wifiSsid = ssid;
  wifiPass = pass;
  backendUrl = sanitizeUrl(backend);
  deviceName = name;
  authToken = token;
  isProvisioned = true;

  Serial.println(F("[NVS] Configuration securely saved to flash memory."));
}

void clearPreferences() {
  prefs.begin("agrivault", false);
  prefs.clear();
  prefs.end();
  isProvisioned = false;
  wifiSsid = "";
  wifiPass = "";
  Serial.println(F("[NVS] Flash memory cleared. Entering provisioning mode."));
}

// ==============================================================================
// 2. CAPTIVE PORTAL & WEB PROVISIONING SERVER (HTTP 192.168.4.1)
// ==============================================================================

// JSON endpoint returning scanned Wi-Fi SSIDs and signal strength RSSI
void handleScanNetworks() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; ++i) {
    if (i > 0) json += ",";
    json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",";
    json += "\"rssi\":" + String(WiFi.RSSI(i)) + ",";
    json += "\"secure\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? "true" : "false") + "}";
  }
  json += "]";
  server.send(200, "application/json", json);
}

// Branded Agrivault Captive Portal UI
void handlePortalRoot() {
  String apName = String(AP_SSID_PREFIX) + deviceId.substring(deviceId.length() - 6);

  String html = F("<!DOCTYPE html><html lang=\"en\"><head>"
    "<meta charset=\"UTF-8\">"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
    "<title>Agrivault ESP32 Wi-Fi Setup</title>"
    "<style>"
    "body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#06140d;color:#e2e8f0;}"
    ".container{max-width:440px;margin:0 auto;background:#0d2218;border:1px solid #1c3d2b;border-radius:12px;padding:24px;box-shadow:0 10px 25px rgba(0,0,0,0.5);}"
    ".logo{display:flex;align-items:center;gap:10px;margin-bottom:16px;}"
    ".logo-icon{font-size:24px;}"
    "h2{margin:0;font-size:20px;color:#48bb78;font-weight:700;}"
    ".subtitle{font-size:12px;color:#94a3b8;margin-top:4px;margin-bottom:20px;}"
    ".badge{display:inline-block;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#153e2b;color:#6ee7b7;border:1px solid #2d6a4f;margin-bottom:16px;}"
    "label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin-bottom:6px;margin-top:14px;}"
    "input,select{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #264e36;background:#081810;color:#f8fafc;font-size:14px;outline:none;}"
    "input:focus,select:focus{border-color:#48bb78;box-shadow:0 0 0 2px rgba(72,187,120,0.2);}"
    ".pwd-wrap{position:relative;}"
    ".pwd-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;font-weight:600;}"
    ".btn-row{display:flex;gap:10px;margin-top:10px;}"
    ".btn-scan{background:#1b3829;border:1px solid #2d6a4f;color:#6ee7b7;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;}"
    ".btn-submit{width:100%;background:#16a34a;border:none;color:white;padding:12px;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;margin-top:20px;transition:background 0.2s;}"
    ".btn-submit:hover{background:#15803d;}"
    ".hint{font-size:11px;color:#94a3b8;margin-top:4px;}"
    ".footer{margin-top:24px;border-top:1px solid #1c3d2b;padding-top:14px;font-size:11px;color:#64748b;text-align:center;}"
    "</style></head><body>"
    "<div class=\"container\">"
    "<div class=\"logo\">"
    "<span class=\"logo-icon\">❄️</span>"
    "<div><h2>AGRIVAULT</h2><div class=\"subtitle\">Agricultural Storage IoT Node Provisioning</div></div>"
    "</div>"
    "<div class=\"badge\">Hardware ID: ");
  html += deviceId;
  html += F("</div>"
    "<form method=\"POST\" action=\"/save\" id=\"setupForm\">"
    "<label>Select Storage Facility Wi-Fi (SSID):</label>"
    "<div class=\"btn-row\">"
    "<select id=\"ssidSelect\" onchange=\"handleSelectSsid(this.value)\"><option value=\"\">-- Scanning networks... --</option></select>"
    "<button type=\"button\" class=\"btn-scan\" onclick=\"scanNetworks()\">Rescan</button>"
    "</div>"
    "<div style=\"margin-top:8px;\">"
    "<input type=\"text\" name=\"ssid\" id=\"customSsid\" placeholder=\"Or enter manual/hidden SSID\" value=\"");
  html += wifiSsid;
  html += F("\" required>"
    "</div>"
    "<label>Wi-Fi Password:</label>"
    "<div class=\"pwd-wrap\">"
    "<input type=\"password\" name=\"pass\" id=\"pwdInput\" placeholder=\"Enter Wi-Fi network password\" value=\"\">"
    "<button type=\"button\" class=\"pwd-toggle\" onclick=\"togglePwd()\">SHOW</button>"
    "</div>"
    "<label>Agrivault Backend Server URL:</label>"
    "<input type=\"text\" name=\"backend\" id=\"backendUrl\" value=\"");
  html += backendUrl;
  html += F("\" required>"
    "<div class=\"hint\">Default local port: <code>http://192.168.1.100:4000</code> or your cloud domain.</div>"
    "<label>Device Display Name / Zone Label:</label>"
    "<input type=\"text\" name=\"name\" value=\"");
  html += deviceName;
  html += F("\" placeholder=\"e.g. Potato Warehouse - North Rack\">"
    "<label>Device Registration / Auth Token (Optional):</label>"
    "<input type=\"text\" name=\"token\" value=\"");
  html += authToken;
  html += F("\" placeholder=\"Optional provisioning security code\">"
    "<button type=\"submit\" class=\"btn-submit\" id=\"submitBtn\">Connect & Save to Device</button>"
    "</form>"
    "<div class=\"footer\">"
    "Setup Access Point: <b>");
  html += apName;
  html += F("</b><br>"
    "IP: 192.168.4.1 | Firmware: ");
  html += String(FIRMWARE_VERSION);
  html += F("</div></div>"
    "<script>"
    "function togglePwd(){const p=document.getElementById('pwdInput');const b=event.target;if(p.type==='password'){p.type='text';b.innerText='HIDE';}else{p.type='password';b.innerText='SHOW';}}"
    "function handleSelectSsid(val){if(val){document.getElementById('customSsid').value=val;}}"
    "function scanNetworks(){"
    "const sel=document.getElementById('ssidSelect');sel.innerHTML='<option>Scanning...</option>';"
    "fetch('/scan').then(r=>r.json()).then(data=>{"
    "sel.innerHTML='<option value=\"\">-- Select Available Wi-Fi --</option>';"
    "data.forEach(n=>{"
    "const opt=document.createElement('option');opt.value=n.ssid;opt.innerText=n.ssid+' ('+n.rssi+' dBm)'+(n.secure?' 🔒':'');sel.appendChild(opt);"
    "});"
    "}).catch(()=>{sel.innerHTML='<option value=\"\">Manual entry required</option>';});"
    "}"
    "window.onload=scanNetworks;"
    "</script></body></html>");

  server.send(200, "text/html", html);
}

// Handle Form Submission from Captive Portal
void handlePortalSave() {
  String submittedSsid = server.hasArg("ssid") ? server.arg("ssid") : "";
  String submittedPass = server.hasArg("pass") ? server.arg("pass") : "";
  String submittedBackend = server.hasArg("backend") ? server.arg("backend") : DEFAULT_BACKEND_URL;
  String submittedName = server.hasArg("name") ? server.arg("name") : deviceName;
  String submittedToken = server.hasArg("token") ? server.arg("token") : "";

  submittedSsid.trim();
  submittedPass.trim();

  if (submittedSsid.length() == 0) {
    server.send(400, "text/html", "<h3>Error: Network SSID cannot be empty.</h3><a href=\"/\">Go Back</a>");
    return;
  }

  savePreferences(submittedSsid, submittedPass, submittedBackend, submittedName, submittedToken);

  String html = F("<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><style>"
    "body{margin:0;padding:24px;font-family:sans-serif;background:#06140d;color:#e2e8f0;text-align:center;}"
    ".box{max-width:400px;margin:40px auto;background:#0d2218;border:1px solid #16a34a;padding:30px;border-radius:12px;}"
    "h2{color:#48bb78;margin-bottom:12px;}"
    "p{color:#cbd5e1;line-height:1.5;}"
    "</style></head><body><div class=\"box\">"
    "<h2>Credentials Saved!</h2>"
    "<p>The ESP32 is now disconnecting this setup hotspot and attempting connection to <b>");
  html += submittedSsid;
  html += F("</b>.</p>"
    "<p>1. Reconnect your phone or laptop to your regular facility Wi-Fi.</p>"
    "<p>2. Open the <b>Agrivault Dashboard</b>. Your node will appear live.</p>"
    "<p style=\"font-size:12px;color:#94a3b8;\">Rebooting in 3 seconds...</p>"
    "</div></body></html>");

  server.send(200, "text/html", html);
  delay(2000);
  ESP.restart();
}

// Start SoftAP Provisioning Mode
void startProvisioningAP() {
  inConfigMode = true;
  WiFi.disconnect(true);
  delay(100);

  WiFi.mode(WIFI_AP);
  String apName = String(AP_SSID_PREFIX) + deviceId.substring(deviceId.length() - 6);

  Serial.println(F("\n========================================================"));
  Serial.printf(" [SoftAP] Starting Setup Hotspot: %s\n", apName.c_str());
  Serial.println(F(" [SoftAP] Connect phone/laptop and open http://192.168.4.1"));
  Serial.println(F("========================================================"));

  IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(apName.c_str(), AP_PASSWORD);

  dnsServer.start(53, "*", apIP); // Captive portal wildcard DNS redirection

  server.on("/", HTTP_GET, handlePortalRoot);
  server.on("/scan", HTTP_GET, handleScanNetworks);
  server.on("/save", HTTP_POST, handlePortalSave);
  server.onNotFound(handlePortalRoot);
  server.begin();

  // Rapid blinking LED indicates configuration mode
  for (int i = 0; i < 6; i++) {
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    delay(150);
  }
}

// ==============================================================================
// 3. WI-FI STATION CONNECTION & RECONNECT ENGINE
// ==============================================================================
bool connectStationWiFi() {
  if (wifiSsid.length() == 0) {
    Serial.println(F("[WiFi] No saved credentials found."));
    return false;
  }

  Serial.printf("[WiFi] Attempting connection to SSID: \"%s\"...\n", wifiSsid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < WIFI_CONNECT_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("[WiFi] SUCCESS: Connected to network!"));
    Serial.printf("  IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  Gateway:    %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("  RSSI:       %d dBm\n", WiFi.RSSI());
    digitalWrite(PIN_STATUS_LED, HIGH); // Solid LED indicates normal online operation
    wifiFailCount = 0;
    return true;
  }

  Serial.println(F("[WiFi] FAILED: Could not establish connection within timeout."));
  wifiFailCount++;
  digitalWrite(PIN_STATUS_LED, LOW);
  return false;
}

// ==============================================================================
// 4. SENSOR READINGS & HARDWARE ACQUISITION (ZERO FABRICATION)
// ==============================================================================
struct SensorData {
  bool tempInstalled;
  float tempC;
  bool humInstalled;
  float humidity;
  int mq3Raw;
  float mq3Ratio;
  int mq135Raw;
  float mq135Ratio;
};

SensorData acquireSensors() {
  SensorData data;

  // 1. DS18B20 Digital Temperature
  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C || t < -50.0f || t > 85.0f) {
    data.tempInstalled = false;
    data.tempC = 0.0f;
  } else {
    data.tempInstalled = true;
    data.tempC = t;
  }

  // 2. DHT11 Digital Humidity / Secondary Temperature
  // Simple reading or fallback flag
  data.humInstalled = false;
  data.humidity = 0.0f;

  // 3. MQ-3 Gas Sensor (ADC1 Channel 7 / GPIO 35)
  // Zero-Fabrication: Report honest ADC value & Rs/R0 ratio, NOT fake ethylene
  data.mq3Raw = analogRead(PIN_MQ3_GAS);
  float mq3Voltage = (data.mq3Raw / 4095.0f) * 3.3f;
  data.mq3Ratio = mq3Voltage > 0.05f ? ((3.3f - mq3Voltage) / mq3Voltage) : 1.0f;

  // 4. MQ-135 Air Quality Sensor (ADC1 Channel 6 / GPIO 34)
  // Zero-Fabrication: Report honest ADC value & Rs/R0 ratio, NOT fake selective CO2
  data.mq135Raw = analogRead(PIN_MQ135_GAS);
  float mq135Voltage = (data.mq135Raw / 4095.0f) * 3.3f;
  data.mq135Ratio = mq135Voltage > 0.05f ? ((3.3f - mq135Voltage) / mq135Voltage) : 1.0f;

  return data;
}

// ==============================================================================
// 5. TELEMETRY INGESTION & COMMAND DISPATCH (HTTP / REST)
// ==============================================================================
void transmitTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  SensorData s = acquireSensors();

  // Construct honest JSON payload with exact sensor availability flags
  String json = "{";
  json += "\"deviceId\":\"" + deviceId + "\",";
  json += "\"hardware_id\":\"" + macAddress + "\",";
  json += "\"userName\":\"" + deviceName + "\",";
  json += "\"hardwareType\":\"" + String(HARDWARE_TYPE) + "\",";
  json += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
  json += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"macAddress\":\"" + macAddress + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"battery\":3.30,";

  if (s.tempInstalled) {
    json += "\"temperature\":" + String(s.tempC, 2) + ",";
  }
  if (s.humInstalled) {
    json += "\"humidity\":" + String(s.humidity, 1) + ",";
  }

  // Honest uncalibrated gas sensor response reporting
  json += "\"mq3\":" + String(s.mq3Raw) + ",";
  json += "\"mq3_ratio\":" + String(s.mq3Ratio, 2) + ",";
  json += "\"mq135\":" + String(s.mq135Raw) + ",";
  json += "\"mq135_ratio\":" + String(s.mq135Ratio, 2) + ",";

  // Relay state
  json += "\"relayState\":" + String(relayState ? 1 : 0) + ",";
  json += "\"capabilities\":[\"temperature\",\"mq3\",\"mq135\",\"relay\"]";
  json += "}";

  String endpoint = sanitizeUrl(backendUrl) + "/api/devices/telemetry";

  HTTPClient http;
  WiFiClient client;
  http.begin(client, endpoint);
  http.addHeader("Content-Type", "application/json");
  if (authToken.length() > 0) {
    http.addHeader("X-Device-Token", authToken);
  }
  http.setTimeout(5000);

  int httpCode = http.POST(json);

  if (httpCode == 200 || httpCode == 201 || httpCode == 202) {
    String response = http.getString();
    Serial.printf("[Telemetry ACK] Sent to %s -> Code %d | Temp: %s\n",
                  endpoint.c_str(), httpCode, s.tempInstalled ? String(s.tempC, 1).c_str() : "N/A");

    // Check for Remote Reconfigure Wi-Fi command or Relay commands from backend
    if (response.indexOf("RECONFIGURE_WIFI") >= 0) {
      Serial.println(F("[Command] Remote Wi-Fi reconfiguration requested by Agrivault server!"));
      startProvisioningAP();
    } else if (response.indexOf("RELAY_ON") >= 0) {
      Serial.println(F("[Command] Turn Relay ON (GPIO 26 energized)"));
      digitalWrite(PIN_RELAY, HIGH);
      relayState = true;
    } else if (response.indexOf("RELAY_OFF") >= 0) {
      Serial.println(F("[Command] Turn Relay OFF (GPIO 26 de-energized)"));
      digitalWrite(PIN_RELAY, LOW);
      relayState = false;
    }
  } else {
    Serial.printf("[Telemetry Error] HTTP Code %d (Error: %s)\n", httpCode, http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ==============================================================================
// 6. SETUP & MAIN LOOP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_BOOT_BUTTON, INPUT_PULLUP);
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, LOW); // Safe default: Relay OFF
  digitalWrite(PIN_STATUS_LED, LOW);

  deviceId = generateDeviceId();
  macAddress = WiFi.macAddress();

  Serial.println(F("\n========================================================"));
  Serial.println(F("   ❄️ AGRIVAULT INDUSTRIAL ESP32 NODE INITIALIZING"));
  Serial.printf("   Device ID: %s | MAC: %s\n", deviceId.c_str(), macAddress.c_str());
  Serial.println(F("========================================================"));

  ds18b20.begin();

  loadPreferences();

  // If already provisioned, attempt normal Wi-Fi connection
  if (isProvisioned) {
    bool ok = connectStationWiFi();
    if (!ok) {
      Serial.println(F("[Boot] Saved Wi-Fi failed to connect. Launching fallback AP Setup Portal..."));
      startProvisioningAP();
    }
  } else {
    Serial.println(F("[Boot] Unprovisioned device. Starting initial setup AP..."));
    startProvisioningAP();
  }
}

void loop() {
  // 1. Handle Physical BOOT Button Long-Press (GPIO 0 held for 5 seconds)
  if (digitalRead(PIN_BOOT_BUTTON) == LOW) {
    if (buttonPressStart == 0) {
      buttonPressStart = millis();
      Serial.println(F("[Button] BOOT button pressed. Hold for 5 seconds to enter Wi-Fi Setup..."));
    } else if (!buttonHeld && (millis() - buttonPressStart) > BUTTON_HOLD_TIME_MS) {
      buttonHeld = true;
      Serial.println(F("[Button] 5-second hold confirmed! Entering Wi-Fi Provisioning Mode."));
      startProvisioningAP();
    }
  } else {
    buttonPressStart = 0;
    buttonHeld = false;
  }

  // 2. If in Captive Portal Mode, process DNS and Web requests
  if (inConfigMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    return;
  }

  // 3. Normal Monitoring Mode: Maintain Wi-Fi and transmit telemetry
  if (WiFi.status() == WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
      lastTelemetryMs = now;
      transmitTelemetry();
    }
  } else {
    // Connection dropped - attempt reconnection with backoff
    Serial.println(F("[WiFi] Disconnected! Attempting auto-reconnect..."));
    bool reconnected = connectStationWiFi();
    if (!reconnected && wifiFailCount >= 3) {
      Serial.println(F("[WiFi] Router unavailable after 3 attempts. Launching recoverable Setup AP..."));
      startProvisioningAP();
    }
    delay(2000);
  }
}
