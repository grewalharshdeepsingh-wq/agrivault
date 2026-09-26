#ifndef AGRIVAULT_CONFIG_H
#define AGRIVAULT_CONFIG_H

// --- Wi-Fi Configuration ---
#define WIFI_SSID           "AgriVault-Local-Mesh-5G"
#define WIFI_PASSWORD       "agrivault2026"

// --- AgriVault Cloud MQTT Settings (Connect directly over Internet) ---
#define MQTT_BROKER_HOST    "192.168.1.100" // AgriVault Server IP or Domain (over Internet)
#define MQTT_BROKER_PORT    1883
#define MQTT_USERNAME       "agrivault_node"
#define MQTT_PASSWORD       "node_secure_token"

// --- AgriVault Multi-Tenant Hierarchy IDs ---
#define FACILITY_ID         "fac-01"
#define HARDWARE_TYPE       "ESP32-DevKit-V1"
#define FIRMWARE_VERSION    "1.2.0"

// --- Hardware Pin Definitions ---
// DS18B20 1-Wire Temperature Sensor (requires 4.7k pull-up resistor to 3.3V)
#define PIN_DS18B20         4

// Analog Gas Sensors (ADC1 channels safe to read with Wi-Fi active)
#define PIN_MQ3_ANALOG      34  // GPIO 34 (ADC1_CH6) - Ethanol & ripening volatiles
#define PIN_MQ135_ANALOG    35  // GPIO 35 (ADC1_CH7) - Ammonia, air quality, CO2

// Actuator & Status Pins
#define PIN_RELAY           26  // 5V 1-Channel Relay (High-level active)
#define PIN_STATUS_LED      2   // Onboard Blue LED

// --- Telemetry Intervals ---
#define TELEMETRY_INTERVAL_MS 5000   // Send reading every 5 seconds
#define HEARTBEAT_INTERVAL_MS 15000  // Heartbeat every 15 seconds

#endif // AGRIVAULT_CONFIG_H
