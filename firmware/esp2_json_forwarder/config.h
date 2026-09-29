/*
 * AgriVault ESP #2 — JSON Forwarder Config
 *
 * Role: Receive pipe-delimited sensor data from ESP #1 over UART,
 *       build a proper AgriVault JSON payload, and POST to Vercel every 1s.
 *
 * Wiring from ESP #1:
 *   ESP #1 TX2 (GPIO 17) ──────► ESP #2 RX (D5 / GPIO 14)   ← receives data here
 *   ESP #1 RX2 (GPIO 16) ◄────── ESP #2 TX (D6 / GPIO 12)   ← optional ACK back
 *   ESP #1 GND            ──────► ESP #2 GND                 (REQUIRED)
 */

#ifndef ESP2_CONFIG_H
#define ESP2_CONFIG_H

#include <Arduino.h>

// ── Wi-Fi credentials ─────────────────────────────────────────────────────
#define WIFI_SSID        "Computer-Lab"       // ← change to your Wi-Fi name
#define WIFI_PASSWORD    "Drishti@543"   // ← change to your Wi-Fi password

// ── Vercel cloud endpoint ─────────────────────────────────────────────────
// Replace YOUR-PROJECT with your actual Vercel subdomain after deploying.
// Example: "https://agrivault-abc123.vercel.app/api/devices/telemetry"
#define CLOUD_API_URL    "https://agrivault-six.vercel.app"

// ── AgriVault tenant ID ───────────────────────────────────────────────────
#define FACILITY_ID      "fac-01"
#if defined(ESP8266)
  #define HARDWARE_TYPE    "ESP8266-NodeMCU"   // hardware type of the forwarder node
#else
  #define HARDWARE_TYPE    "ESP32-DevKit-V1"
#endif
#define FIRMWARE_VERSION "2.0.0"

// ── Serial bridge from ESP #1 ─────────────────────────────────────────────
// Bridge pins configured to D5 (RX) and D6 (TX)
#define BRIDGE_BAUD      115200

#if defined(ESP8266)
  // ESP8266 NodeMCU pins: D5 = GPIO14, D6 = GPIO12
  #define BRIDGE_RX_PIN    D5    // GPIO 14: connect to ESP #1 TX (GPIO 17)
  #define BRIDGE_TX_PIN    D6    // GPIO 12: connect to ESP #1 RX (GPIO 16)
#elif defined(ESP32)
  // ESP32: D5 (GPIO 5) and D6 (mapped to safe GPIO 18, since GPIO 6 is SPI flash)
  #define BRIDGE_RX_PIN    5     // GPIO 5 (D5)
  #define BRIDGE_TX_PIN    18    // GPIO 18 (safe GPIO for TX)
#endif

// ── Timing ────────────────────────────────────────────────────────────────
// Maximum time (ms) to wait for a complete line from ESP #1 before timeout
#define SERIAL_TIMEOUT_MS  1500

// ── HTTP timeout ──────────────────────────────────────────────────────────
#define HTTP_TIMEOUT_MS    5000

// ── Status LED ────────────────────────────────────────────────────────────
#define PIN_STATUS_LED   2   // Built-in blue LED

// ── Packet header sentinel ────────────────────────────────────────────────
// Every valid packet from ESP #1 starts with this string
#define PACKET_HEADER    "AGVT"

#endif // ESP2_CONFIG_H
