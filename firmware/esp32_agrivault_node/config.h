#ifndef AGRIVAULT_ESP32_CONFIG_H
#define AGRIVAULT_ESP32_CONFIG_H

#include <Arduino.h>

// ==============================================================================
// ❄️ SENSOR TELEMETRY CONTAINER (Zero-Fabrication Architecture)
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

#define FIRMWARE_VERSION       "v2.4.0-provision"
#define HARDWARE_TYPE          "ESP32-DevKit-V1"
#define DEFAULT_FACILITY_ID    "fac-01"

// Default Backend URL fallback (editable via Captive Portal without recompiling)
#define DEFAULT_BACKEND_URL    "http://192.168.1.100:4000"

// Telemetry transmit interval (in milliseconds)
#define TELEMETRY_INTERVAL_MS  5000   // 5 seconds
#define HEARTBEAT_INTERVAL_MS  15000  // 15 seconds

// ==============================================================================
// PIN DEFINITIONS (Optimized for ESP32-WROOM-32 / DevKit-V1)
// ==============================================================================
#define PIN_STATUS_LED         2   // Built-in Blue LED (GPIO 2)
#define PIN_BOOT_BUTTON        0   // Physical BOOT button (GPIO 0) - Hold 5s for Wi-Fi Reset
#define PIN_DS18B20            4   // OneWire Digital Temp Probe (GPIO 4)
#define PIN_DHT11              32  // DHT11 Digital Temp & Humidity (GPIO 32)
#define PIN_MQ135_GAS          34  // MQ-135 Air Quality Sensor (ADC1 Channel 6, GPIO 34)
#define PIN_MQ3_GAS            35  // MQ-3 Volatiles/Gas Sensor (ADC1 Channel 7, GPIO 35)
#define PIN_RELAY              26  // Relay Module Actuator (GPIO 26, Active HIGH)

// AP Provisioning defaults
#define AP_SSID_PREFIX         "Agrivault-Setup-"
#define AP_PASSWORD            ""  // Open for quick smartphone/laptop captive onboarding

// Watchdogs & Timing
#define BUTTON_HOLD_TIME_MS    5000  // 5 seconds hold to force AP setup mode
#define WIFI_CONNECT_TIMEOUT_MS 15000 // 15 seconds before falling back to AP setup

#endif // AGRIVAULT_ESP32_CONFIG_H
