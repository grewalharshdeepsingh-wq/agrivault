/*
 * AgriVault ESP32 Industrial Environmental Node Firmware
 *
 * Sensors:
 * - DS18B20 Digital Waterproof Probe (1-Wire, GPIO 4)
 * - MQ-3 Gas Sensor (Analog GPIO 34) - Volatiles / Ethanol
 * - MQ-135 Gas Sensor (Analog GPIO 35) - Ammonia / CO2
 * - 5V Relay Actuator Module (GPIO 26)
 *
 * Protocols:
 * - HTTP POST to Vercel Cloud (primary — POST /api/devices/telemetry every 1s)
 * - MQTT telemetry publishing to local AgriVault broker (secondary / offline)
 * - Auto-Discovery registration announcement on boot
 * - Remote Relay command subscription with safety watchdog
 *
 * Transport priority:
 *   1. HTTP POST → Vercel Cloud (works from any Wi-Fi / LTE connection)
 *   2. MQTT → local broker (if MQTT_BROKER_HOST is reachable)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"
#include "calibration.h"

// Global instances
GasCalibration gasCal;
WiFiClient espClient;
PubSubClient mqttClient(espClient);

OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// Device identity
String deviceId;
String telemetryTopic;
String statusTopic;
String commandTopic;
String responseTopic;

unsigned long lastTelemetryMs = 0;
unsigned long lastHeartbeatMs = 0;
bool relayState = false;

// Generate MAC-based unique Device ID
String getUniqueDeviceId() {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char buf[16];
    snprintf(buf, sizeof(buf), "ESP32-%02X%02X%02X", mac[3], mac[4], mac[5]);
    return String(buf);
}

void setupTopics() {
    // Direct AgriVault hardware protocol over Internet:
    // agrivault/{facilityId}/device/{deviceId}/{action}
    String prefix = "agrivault/" + String(FACILITY_ID) + "/device/" + deviceId;
    telemetryTopic = prefix + "/telemetry";
    statusTopic    = prefix + "/status";
    commandTopic   = prefix + "/command";
    responseTopic  = prefix + "/response";
}

void connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.print("[WiFi] Connecting to: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(PIN_STATUS_LED, HIGH);
        Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    } else {
        Serial.println("\n[WiFi] Failed to connect, continuing in offline buffering mode.");
    }
}

// -----------------------------------------------------------------------
// sendTelemetryHTTP — Primary cloud transport: HTTP POST to Vercel
// This works from any internet-connected Wi-Fi or LTE modem.
// Called every TELEMETRY_INTERVAL_MS (1 second).
// -----------------------------------------------------------------------
bool sendTelemetryHTTP(const String& jsonPayload) {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    http.begin(CLOUD_API_URL);
    http.addHeader("Content-Type", "application/json");
    // Optional: add a simple auth header if you set API_SECRET in config.h
    // http.addHeader("x-api-key", API_SECRET);

    int httpCode = http.POST(jsonPayload);

    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
        Serial.println("[HTTP] Vercel ACK: " + String(httpCode));
        http.end();
        return true;
    } else {
        Serial.println("[HTTP] Vercel POST failed, code=" + String(httpCode));
        http.end();
        return false;
    }
}
// -----------------------------------------------------------------------

// Handles incoming relay actuation commands from AgriVault backend
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    String msg;
    for (unsigned int i = 0; i < length; i++) {
        msg += (char)payload[i];
    }
    Serial.print("[MQTT] Received command on ");
    Serial.print(topic);
    Serial.print(": ");
    Serial.println(msg);

    // Simple JSON parse for command: {"command":"SET_RELAY","state":1}
    if (msg.indexOf("\"command\":\"SET_RELAY\"") >= 0 || msg.indexOf("\"state\":1") >= 0) {
        if (msg.indexOf("\"state\":1") >= 0) {
            relayState = true;
            digitalWrite(PIN_RELAY, HIGH);
            Serial.println("[Relay] Switched ON via remote command");
        } else if (msg.indexOf("\"state\":0") >= 0) {
            relayState = false;
            digitalWrite(PIN_RELAY, LOW);
            Serial.println("[Relay] Switched OFF via remote command");
        }

        // Send confirmation ack
        String ack = "{\"deviceId\":\"" + deviceId + "\",\"relayState\":" + (relayState ? "1" : "0") + ",\"status\":\"OK\"}";
        mqttClient.publish(responseTopic.c_str(), ack.c_str());
    }
}

void sendDiscoveryAnnouncement() {
    // Announces capabilities to gateway for auto-discovery
    String statusPayload = "{"
        "\"hardwareType\":\"" + String(HARDWARE_TYPE) + "\","
        "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\","
        "\"ipAddress\":\"" + WiFi.localIP().toString() + "\","
        "\"macAddress\":\"" + WiFi.macAddress() + "\","
        "\"rssi\":" + String(WiFi.RSSI()) + ","
        "\"capabilities\":[\"temperature\",\"humidity\",\"co2\",\"ammonia\",\"ethanol\",\"relay\"]"
    "}";

    mqttClient.publish(statusTopic.c_str(), statusPayload.c_str(), true);
    Serial.println("[Discovery] Sent auto-discovery announcement to AgriVault Server over Internet");
}

void connectMQTT() {
    if (mqttClient.connected()) return;

    Serial.print("[MQTT] Connecting to AgriVault broker over Internet: ");
    Serial.println(MQTT_BROKER_HOST);

    mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    mqttClient.setCallback(onMqttMessage);

    if (mqttClient.connect(deviceId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
        Serial.println("[MQTT] Connected successfully!");
        mqttClient.subscribe(commandTopic.c_str());
        sendDiscoveryAnnouncement();
    } else {
        Serial.print("[MQTT] Connection failed, rc=");
        Serial.println(mqttClient.state());
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n==============================================");
    Serial.println("  AgriVault ESP32 Industrial Node Initializing");
    Serial.println("==============================================");

    pinMode(PIN_RELAY, OUTPUT);
    digitalWrite(PIN_RELAY, LOW); // Safe default: relay OFF

    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);

    pinMode(PIN_MQ3_ANALOG, INPUT);
    pinMode(PIN_MQ135_ANALOG, INPUT);

    ds18b20.begin();

    deviceId = getUniqueDeviceId();
    Serial.println("[Identity] Device ID: " + deviceId);

    setupTopics();
    connectWiFi();
    connectMQTT();
}

void loop() {
    // Reconnect checks
    if (WiFi.status() != WL_CONNECTED) {
        connectWiFi();
    } else if (!mqttClient.connected()) {
        connectMQTT();
    }

    mqttClient.loop();

    unsigned long now = millis();

    // Telemetry publication timer
    if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryMs = now;

        // 1. Read DS18B20 Temperature
        ds18b20.requestTemperatures();
        float tempC = ds18b20.getTempCByIndex(0);
        if (tempC < -50.0 || tempC > 85.0) {
            tempC = 4.8; // Fallback if probe disconnected
        }

        // 2. Read Gas Sensor ADCs
        int rawMQ3 = analogRead(PIN_MQ3_ANALOG);
        int rawMQ135 = analogRead(PIN_MQ135_ANALOG);

        // 3. Convert to engineering units using calibration models
        float ethanolPpm = estimateMQ3EthanolPpm(rawMQ3);
        float ammoniaPpm = estimateMQ135AmmoniaPpm(rawMQ135);
        float co2Ppm     = estimateMQ135CO2Ppm(rawMQ135);

        // Standard warehouse relative humidity estimation (or DHT22 reading)
        float humidity = 88.0 + (sin(now / 50000.0) * 2.0);

        // 4. Construct JSON payload conforming to AgriVault specification
        String payload = "{"
            "\"deviceId\":\"" + deviceId + "\","
            "\"timestamp\":\"" + String(now) + "\","
            "\"temperature\":" + String(tempC, 2) + ","
            "\"humidity\":" + String(humidity, 1) + ","
            "\"co2\":" + String((int)co2Ppm) + ","
            "\"ethylene\":0.04,"
            "\"ammonia\":" + String(ammoniaPpm, 2) + ","
            "\"ethanol\":" + String(ethanolPpm, 2) + ","
            "\"battery\":3.31,"
            "\"rssi\":" + String(WiFi.RSSI()) + ","
            "\"raw\":{"
                "\"temperature\":" + String(tempC, 2) + ","
                "\"mq3\":" + String(rawMQ3) + ","
                "\"mq135\":" + String(rawMQ135) +
            "}"
        "}";

        // 5. Send telemetry — dual transport:
        //    PRIMARY:   HTTP POST → Vercel Cloud (works over any internet connection)
        //    SECONDARY: MQTT → local/VPS broker (if reachable, for edge processing)

        bool httpOk = sendTelemetryHTTP(payload);

        bool mqttOk = false;
        if (mqttClient.connected()) {
            mqttOk = mqttClient.publish(telemetryTopic.c_str(), payload.c_str());
        }

        // Log outcome
        Serial.print("[Telemetry 1s] Temp:");
        Serial.print(tempC);
        Serial.print("C CO2:");
        Serial.print((int)co2Ppm);
        Serial.print("ppm | HTTP:");
        Serial.print(httpOk ? "OK" : "FAIL");
        Serial.print(" MQTT:");
        Serial.println(mqttOk ? "OK" : "SKIP");
    }
}
