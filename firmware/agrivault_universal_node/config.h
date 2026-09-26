#ifndef AGRIVAULT_UNIVERSAL_CONFIG_H
#define AGRIVAULT_UNIVERSAL_CONFIG_H

#include <Arduino.h>

// ==============================================================================
// AgriVault Universal Node Configuration (ESP8266 & ESP32)
// ==============================================================================

// Default fallback server address (can be changed anytime in SoftAP setup wizard)
// Direct connection over Internet / LAN to AgriVault Server
#define DEFAULT_SERVER_URL   "http://192.168.1.100:4000"
#define DEFAULT_FACILITY_ID  "fac-01"
#define FIRMWARE_VERSION     "1.3.0-ota"

// Telemetry streaming interval in milliseconds (default: every 5 seconds)
#define TELEMETRY_INTERVAL_MS 5000

// SoftAP Captive Portal configuration
#define AP_SSID_PREFIX       "AgriVault-Node-"
#define AP_PASSWORD          ""  // Open network for quick setup, or set password e.g. "agrivault123"

// Over-The-Air (OTA) password for network flashing security
#define OTA_PASSWORD         "agrivault2026"
#define OTA_PORT             8266

// ==============================================================================
// Hardware Pin Definitions (Conditional for ESP8266 vs ESP32)
// ==============================================================================
#if defined(ESP8266)
  // ESP8266 (NodeMCU / Wemos D1 Mini / ESP-12E)
  #define BOARD_TYPE          "ESP8266-NodeMCU"
  #define PIN_STATUS_LED      2   // Built-in Blue LED (Active LOW on ESP8266)
  #define PIN_RESET_BUTTON    0   // FLASH button (GPIO 0) - Hold 3s to reset Wi-Fi
  #define PIN_DS18B20         4   // D2 / GPIO 4 (1-Wire digital waterproof probe)
  #define PIN_RELAY           14  // D5 / GPIO 14 (Optional relay control)
  #define PIN_ANALOG_GAS      A0  // A0 (ADC0 0-1V / 0-3.3V on NodeMCU)

#elif defined(ESP32)
  // ESP32 (DevKit-V1 / NodeMCU-32S / ESP32-WROOM)
  #define BOARD_TYPE          "ESP32-DevKit-V1"
  #define PIN_STATUS_LED      2   // Built-in Blue LED
  #define PIN_RESET_BUTTON    0   // BOOT button (GPIO 0) - Hold 3s to reset Wi-Fi
  #define PIN_DS18B20         4   // GPIO 4 (1-Wire digital waterproof probe)
  #define PIN_RELAY           26  // GPIO 26 (Optional relay actuator)
  #define PIN_ANALOG_GAS      34  // GPIO 34 (ADC1_CH6 - Safe with Wi-Fi active)
  #define PIN_ANALOG_GAS2     35  // GPIO 35 (ADC1_CH7 - Optional second gas probe)

#else
  #error "Unsupported hardware platform! Please compile with ESP8266 or ESP32 board selected."
#endif

#endif // AGRIVAULT_UNIVERSAL_CONFIG_H
