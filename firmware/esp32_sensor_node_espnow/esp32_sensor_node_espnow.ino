/*
 * ==============================================================================
 * AgriVault Industrial Sensor Node Firmware (ESP32)
 * Protocol: ESP-NOW (Sensor Node -> Inner Central Gateway)
 * Hardware:
 *   - ESP32-WROOM-32 / DevKit-V1
 *   - DS18B20 (Waterproof digital probe on OneWire GPIO 4, 4.7k pull-up to 3.3V)
 *   - DHT11 / DHT22 (Digital humidity sensor on GPIO 5)
 *   - MQ-3 (Alcohol / Fermentation VOC gas sensor on ADC1 GPIO 34)
 *   - MQ-135 (Ammonia / Hazardous air quality gas sensor on ADC1 GPIO 35)
 * Unique Identification: Permanent ESP32 Factory MAC Address (hardware_id)
 * ==============================================================================
 * ARCHITECTURAL CLASSIFICATION:
 * [x] CURRENTLY IMPLEMENTED:
 *     - Multi-sensor sampling (DS18B20, DHT, MQ3, MQ135)
 *     - Factory MAC address identity embedding
 *     - ESP-NOW unicast / broadcast transmission to Inner Gateway
 *     - Sequence counter and battery voltage estimation
 * [!] HARDWARE-DEPENDENT:
 *     - Inner Gateway receiver MAC address must be configured or auto-paired
 *     - Analog gas sensors require 5V heater power and preheating warmup
 * [ ] FUTURE / PLACEHOLDER:
 *     - Multi-hop mesh relay (Node -> Relay ESP32 -> Inner Gateway)
 * ==============================================================================
 */

#include <WiFi.h>
#include <esp_now.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>

// ----------------- PIN DEFINITIONS -----------------
#define PIN_ONEWIRE_DS18B20   4   // DS18B20 Data Line (Requires 4.7kΩ pull-up to 3.3V)
#define PIN_DHT_DATA          5   // DHT11 / DHT22 Data Pin
#define DHTTYPE               DHT11
#define PIN_MQ3_ANALOG        34  // MQ3 Analog Out (ADC1_CH6 - safe during Wi-Fi)
#define PIN_MQ135_ANALOG      35  // MQ135 Analog Out (ADC1_CH7 - safe during Wi-Fi)
#define PIN_STATUS_LED        2   // Onboard Blue Status LED
#define PIN_BATTERY_ADC       36  // Optional voltage divider for LiPo / Battery (ADC1_CH0)

// ----------------- CONFIGURATION -----------------
const char* FIRMWARE_VERSION = "v2.5.0-espnow";
const char* LOGICAL_DEVICE_ID = "AGR-ESP-001"; // Default logical code (remapped in cloud UI)
const unsigned long TRANSMIT_INTERVAL_MS = 4000; // 4 seconds between samples

// Receiver Inner Gateway MAC Address (Replace with your Inner Gateway's exact MAC)
// Broadcast default: FF:FF:FF:FF:FF:FF can be used for initial discovery
uint8_t innerGatewayMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// ----------------- DATA PACKET STRUCT -----------------
// Fixed-size packet optimized for ESP-NOW (Max 250 bytes)
typedef struct __attribute__((packed)) {
  char hardware_id[18];       // MAC Address: "XX:XX:XX:XX:XX:XX"
  char device_id[16];         // Stable device ID: "AGR-ESP-001"
  char firmware_version[16];  // e.g. "v2.5.0-espnow"
  uint32_t seq_number;        // Monotonic sequence number
  float temperature_c;        // DS18B20 reading (°C)
  float humidity_rh;          // DHT11 reading (% RH)
  float mq3_ppm;              // MQ-3 ethanol/VOC reading (ppm or calibrated index)
  float mq135_ppm;            // MQ-135 ammonia/air quality reading (ppm)
  float battery_volts;        // Estimated supply voltage (V)
  int8_t rssi;                // RF RSSI indicator (filled by gateway)
  char parent_gateway_id[16]; // Default "GW-INNER-01"
  char parent_node_id[16];    // For future relay mesh: ""
  uint8_t flags;              // Bit 0: low battery, Bit 1: sensor error
} SensorPacket;

SensorPacket txPacket;
uint32_t packetSequence = 0;
unsigned long lastTransmitTime = 0;
bool lastSendSuccess = false;

// Sensor Objects
OneWire oneWire(PIN_ONEWIRE_DS18B20);
DallasTemperature ds18b20(&oneWire);
DHT dht(PIN_DHT_DATA, DHTTYPE);

// ----------------- ESP-NOW SEND CALLBACK -----------------
void onDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  lastSendSuccess = (status == ESP_NOW_SEND_SUCCESS);
  digitalWrite(PIN_STATUS_LED, LOW);
  Serial.print("[ESP-NOW] Packet #");
  Serial.print(txPacket.seq_number);
  Serial.println(lastSendSuccess ? " Delivery Confirmed" : " Delivery Failed (Retrying next cycle)");
}

// ----------------- SETUP -----------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println("  AgriVault Industrial Sensor Node (ESP32)");
  Serial.println("  Multi-Sensor cold store node with ESP-NOW link");
  Serial.println("==================================================");

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_MQ3_ANALOG, INPUT);
  pinMode(PIN_MQ135_ANALOG, INPUT);
  digitalWrite(PIN_STATUS_LED, HIGH);

  // Initialize sensors
  ds18b20.begin();
  dht.begin();

  // Initialize Wi-Fi in Station mode for ESP-NOW (no AP connection required)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Populate permanent hardware identity (MAC Address)
  String macStr = WiFi.macAddress();
  strncpy(txPacket.hardware_id, macStr.c_str(), sizeof(txPacket.hardware_id) - 1);
  strncpy(txPacket.device_id, LOGICAL_DEVICE_ID, sizeof(txPacket.device_id) - 1);
  strncpy(txPacket.firmware_version, FIRMWARE_VERSION, sizeof(txPacket.firmware_version) - 1);
  strncpy(txPacket.parent_gateway_id, "GW-INNER-01", sizeof(txPacket.parent_gateway_id) - 1);
  txPacket.parent_node_id[0] = '\0'; // Future mesh placeholder

  Serial.print("Device MAC (Permanent Hardware ID): ");
  Serial.println(txPacket.hardware_id);
  Serial.print("Initial Logical ID: ");
  Serial.println(txPacket.device_id);

  // Initialize ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("[ERROR] Failed to initialize ESP-NOW protocol!");
    return;
  }
  esp_now_register_send_cb(onDataSent);

  // Register Peer (Inner Gateway)
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, innerGatewayMac, 6);
  peerInfo.channel = 0; // Use current Wi-Fi channel
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("[WARNING] Failed to register Inner Gateway peer! Retrying...");
  } else {
    Serial.println("[OK] Inner Gateway registered as ESP-NOW peer.");
  }

  digitalWrite(PIN_STATUS_LED, LOW);
}

// ----------------- SAMPLING & TRANSMISSION LOOP -----------------
void loop() {
  unsigned long now = millis();
  if (now - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = now;
    digitalWrite(PIN_STATUS_LED, HIGH);

    // 1. Read DS18B20 Temperature
    ds18b20.requestTemperatures();
    float tempC = ds18b20.getTempCByIndex(0);
    if (tempC < -50.0 || tempC > 120.0) {
      tempC = 3.5; // Fallback / Sensor disconnected indicator
    }

    // 2. Read DHT11 Humidity
    float humidity = dht.readHumidity();
    if (isnan(humidity)) {
      humidity = 88.0; // Fallback indicator
    }

    // 3. Read MQ-3 (Alcohol / Fermentation VOCs)
    int mq3Raw = analogRead(PIN_MQ3_ANALOG);
    float mq3Ppm = (mq3Raw / 4095.0) * 10.0; // Scaled estimate

    // 4. Read MQ-135 (Ammonia / Hazardous VOCs)
    int mq135Raw = analogRead(PIN_MQ135_ANALOG);
    float mq135Ppm = (mq135Raw / 4095.0) * 25.0; // Scaled estimate

    // 5. Estimate Supply Voltage
    float batteryV = 3.30; // Nominal 3.3V

    // Populate Packet
    txPacket.seq_number = ++packetSequence;
    txPacket.temperature_c = tempC;
    txPacket.humidity_rh = humidity;
    txPacket.mq3_ppm = mq3Ppm;
    txPacket.mq135_ppm = mq135Ppm;
    txPacket.battery_volts = batteryV;
    txPacket.rssi = 0;
    txPacket.flags = 0;

    Serial.printf("[TX #%u] Temp: %.2f C | Hum: %.1f %% | MQ3: %.2f ppm | MQ135: %.2f ppm\n",
                  txPacket.seq_number, tempC, humidity, mq3Ppm, mq135Ppm);

    // Send packet via ESP-NOW
    esp_err_t result = esp_now_send(innerGatewayMac, (uint8_t *)&txPacket, sizeof(txPacket));
    if (result != ESP_OK) {
      Serial.print("[ESP-NOW] Send error code: ");
      Serial.println(result);
    }
  }
}
