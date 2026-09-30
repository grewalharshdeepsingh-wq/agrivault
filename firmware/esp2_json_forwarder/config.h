/*
 * AgriVault ESP #2 — JSON Forwarder Config
 *
 * Role: Receives pipe-delimited sensor data from ESP #1 over UART,
 *       builds a standards-compliant AgriVault JSON payload, and
 *       POSTs to the AgriVault server over Wi-Fi every 1 second.
 *
 * Easy Wi-Fi Configuration (No code re-flashing needed!):
 *   1. SoftAP Captive Portal: If Wi-Fi fails to connect, or if you hold
 *      the FLASH/BOOT button (GPIO 0) for 3s, connect your phone to
 *      "AgriVault-ESP2-Setup" and visit http://192.168.4.1 to configure.
 *   2. USB Serial Console: Open Serial Monitor at 115200 baud and type:
 *      WIFI=YourSSID,YourPassword
 *      SERVER=http://192.168.1.100:4000 (or https://your-domain.vercel.app)
 *
 * Hardware Wiring from ESP #1:
 *   ESP #1 TX2 (GPIO 17) ──────► ESP #2 RX (D5 / GPIO 14 on ESP8266, GPIO 5 on ESP32)
 *   ESP #1 GND            ──────► ESP #2 GND  (REQUIRED: COMMON GROUND)
 */

#ifndef ESP2_CONFIG_H
#define ESP2_CONFIG_H

#include <Arduino.h>

// ── Default Wi-Fi credentials (fallback if EEPROM empty) ───────────────────
#define DEFAULT_WIFI_SSID        "Computer-Lab"       // Default network name
#define DEFAULT_WIFI_PASSWORD    "Drishti@543"        // Default network password

// ── Default AgriVault server target ─────────────────────────────────────────
// For local network running: "http://<YOUR_COMPUTER_IP>:4000"
// For Vercel cloud deployment: "https://<YOUR-PROJECT>.vercel.app"
#define DEFAULT_SERVER_URL       "https://agrivault-six.vercel.app"

// ── SoftAP Captive Portal Settings ─────────────────────────────────────────
#define AP_SSID_PREFIX           "AgriVault-ESP2-Setup"
#define AP_PASSWORD              ""  // Open network for effortless mobile setup

// ── Hardware Pins ──────────────────────────────────────────────────────────
#define PIN_STATUS_LED           2   // Built-in blue LED
#define PIN_RESET_BUTTON         0   // FLASH / BOOT button (GPIO 0) - hold 3s for setup

// ── AgriVault Tenant ID ───────────────────────────────────────────────────
#define FACILITY_ID              "fac-01"

#if defined(ESP8266)
  #define HARDWARE_TYPE          "ESP8266-NodeMCU"
#else
  #define HARDWARE_TYPE          "ESP32-DevKit-V1"
#endif

#define FIRMWARE_VERSION         "2.1.0-mesh"

// ── Serial bridge from ESP #1 ─────────────────────────────────────────────
#define BRIDGE_BAUD              115200

#if defined(ESP8266)
  // ESP8266 NodeMCU pins: D5 = GPIO14, D6 = GPIO12
  #define BRIDGE_RX_PIN          D5    // GPIO 14: connect to ESP #1 TX
  #define BRIDGE_TX_PIN          D6    // GPIO 12: optional ACK
#elif defined(ESP32)
  // ESP32: GPIO 5 (RX) and GPIO 18 (TX)
  #define BRIDGE_RX_PIN          5     // GPIO 5 (connect to ESP #1 TX2 GPIO 17)
  #define BRIDGE_TX_PIN          18    // GPIO 18
#endif

// ── Timing & Timeouts ─────────────────────────────────────────────────────
#define SERIAL_TIMEOUT_MS        1500
#define HTTP_TIMEOUT_MS          8000
#define HEARTBEAT_INTERVAL_MS    15000 // Standalone discovery heartbeat if ESP1 quiet

// ── Packet sentinel from ESP #1 ───────────────────────────────────────────
#define PACKET_HEADER            "AGVT"

#endif // ESP2_CONFIG_H
