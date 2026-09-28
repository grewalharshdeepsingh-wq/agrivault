/*
 * AgriVault ESP #2 — JSON Forwarder Config
 *
 * Role: Receive pipe-delimited sensor data from ESP #1 over UART,
 *       build a proper AgriVault JSON payload, and POST to Vercel every 1s.
 *
 * Wiring from ESP #1:
 *   ESP #1 TX2 (GPIO 17) ──────► ESP #2 RX2 (GPIO 16)   ← receives data here
 *   ESP #1 RX2 (GPIO 16) ◄────── ESP #2 TX2 (GPIO 17)   ← optional ACK back
 *   ESP #1 GND            ──────► ESP #2 GND   (REQUIRED)
 */

#ifndef ESP2_CONFIG_H
#define ESP2_CONFIG_H

#include <Arduino.h>

// ── Wi-Fi credentials ─────────────────────────────────────────────────────
#define WIFI_SSID        "YourWiFiSSID"       // ← change to your Wi-Fi name
#define WIFI_PASSWORD    "YourWiFiPassword"   // ← change to your Wi-Fi password

// ── Vercel cloud endpoint ─────────────────────────────────────────────────
// Replace YOUR-PROJECT with your actual Vercel subdomain after deploying.
// Example: "https://agrivault-abc123.vercel.app/api/devices/telemetry"
#define CLOUD_API_URL    "https://YOUR-PROJECT.vercel.app/api/devices/telemetry"

// ── AgriVault tenant ID ───────────────────────────────────────────────────
#define FACILITY_ID      "fac-01"
#define HARDWARE_TYPE    "ESP32-DevKit-V1"   // hardware type of the forwarder node
#define FIRMWARE_VERSION "2.0.0"

// ── Serial bridge from ESP #1 ─────────────────────────────────────────────
// ESP32 hardware Serial2: RX=GPIO16, TX=GPIO17
// ESP8266: uses SoftwareSerial on D6/D7 (see sketch)
#define BRIDGE_BAUD      115200

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
